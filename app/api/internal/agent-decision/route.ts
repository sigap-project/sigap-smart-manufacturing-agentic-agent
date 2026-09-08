import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitSigapEvent } from "@/lib/events";
import { validateInternalApiKey, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/agent-decision
 * Dipanggil oleh Layanan Orkestrasi Agen (AWS Bedrock / LangGraph)
 * setiap kali satu langkah penalaran deduktif selesai diproses.
 *
 * Header:
 *   x-api-key: <INTERNAL_API_KEY>
 *
 * Payload:
 *   {
 *     "inspectionId": "INS-2026-8842",
 *     "step": "02",
 *     "stepName": "MEMORY",
 *     "input": { "lotId": "#B-2026-0730", "historyWindow": "8m" },
 *     "output": { "recurringDefectsCount": 3, "vendorRisk": "High" },
 *     "decision": "Analisis korelasi temporal: 3 anomali serupa terdeteksi dalam 8 menit terakhir pada lot yang sama.",
 *     "latencyMs": 82
 *   }
 */
export async function POST(request: NextRequest) {
  // 1. Verifikasi API Key Internal
  const auth = validateInternalApiKey(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const {
      inspectionId,
      step,
      stepName,
      input,
      output,
      decision,
      latencyMs,
    } = body;

    if (!decision && !stepName) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'decision' atau 'stepName' wajib disertakan.",
        },
        { status: 400 }
      );
    }

    // 2. Resolusi parent Inspection
    let targetInspection = inspectionId
      ? await prisma.inspection.findFirst({
          where: {
            OR: [
              { id: inspectionId },
              { id: { endsWith: inspectionId } },
            ],
          },
        })
      : null;

    // Jika tidak ditemukan atau inspectionId kosong, kaitkan ke inspeksi terbaru
    if (!targetInspection) {
      targetInspection = await prisma.inspection.findFirst({
        orderBy: { timestamp: "desc" },
      });
    }

    // Jika database belum memiliki rekaman inspeksi sama sekali, buatkan rekaman default
    if (!targetInspection) {
      let batch = await prisma.batch.findFirst();
      if (!batch) {
        batch = await prisma.batch.create({
          data: {
            lotId: "#B-2026-0730",
            productType: "Bracket Motor A7",
            status: "held",
          },
        });
      }

      targetInspection = await prisma.inspection.create({
        data: {
          batchId: batch.id,
          defectClass: "warna_abnormal",
          defectDetected: true,
          confidence: 94.2,
          agentReasoningTrace: [],
        },
      });
    }

    const cleanStep = String(step || "01").padStart(2, "0");
    const cleanStepName = String(stepName || "DECISION").toUpperCase();
    const cleanDecision =
      decision ||
      (typeof output === "string"
        ? output
        : "Langkah penalaran agen selesai diproses.");

    // 3. Simpan baris ke tabel AgentLog
    const newAgentLog = await prisma.agentLog.create({
      data: {
        inspectionId: targetInspection.id,
        step: cleanStep,
        stepName: cleanStepName,
        input: input || null,
        output: output || null,
        decision: cleanDecision,
        latencyMs: typeof latencyMs === "number" ? latencyMs : null,
      },
    });

    // 4. Perbarui kolom JSON agentReasoningTrace pada parent Inspection
    const currentTrace = Array.isArray(targetInspection.agentReasoningTrace)
      ? (targetInspection.agentReasoningTrace as any[])
      : [];

    const newStepItem = {
      step: cleanStep,
      phase: cleanStepName,
      title: `${cleanStepName} Phase`,
      detail: cleanDecision,
      latency: latencyMs ? `${latencyMs}ms` : undefined,
    };

    // Ganti langkah yang sama jika sudah ada, atau tambahkan di akhir
    const existingIndex = currentTrace.findIndex(
      (t) => t.step === cleanStep || t.phase === cleanStepName
    );
    const updatedTrace =
      existingIndex >= 0
        ? currentTrace.map((t, idx) => (idx === existingIndex ? newStepItem : t))
        : [...currentTrace, newStepItem];

    await prisma.inspection.update({
      where: { id: targetInspection.id },
      data: {
        agentReasoningTrace: updatedTrace,
      },
    });

    // 5. Picu Broadcast SSE live ke panel reasoning trace UI
    emitSigapEvent("agent:log", {
      inspectionId: targetInspection.id,
      step: cleanStep,
      stepName: cleanStepName,
      decision: cleanDecision,
      traces: updatedTrace,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Langkah penalaran [${cleanStep}. ${cleanStepName}] berhasil dicatat.`,
        data: {
          id: newAgentLog.id,
          inspectionId: targetInspection.id,
          step: newAgentLog.step,
          stepName: newAgentLog.stepName,
          decision: newAgentLog.decision,
          latencyMs: newAgentLog.latencyMs,
          timestamp: newAgentLog.timestamp.toISOString(),
          traces: updatedTrace,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in /api/internal/agent-decision:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mencatat keputusan penalaran agen",
      },
      { status: 500 }
    );
  }
}
