import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitSigapEvent } from "@/lib/events";
import { validateInternalApiKey, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/agent-decision
 * Dipanggil oleh Layanan Orkestrasi Agen (AWS Bedrock / LangGraph)
 * setiap kali satu langkah penalaran deduktif selesai diproses.
 * Terproteksi header Authorization: Bearer <INTERNAL_API_KEY> atau x-api-key
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

    const cleanStep = String(step || "01").padStart(2, "0");
    const cleanStepName = String(stepName || "DECISION").toUpperCase();
    const cleanDecision =
      decision ||
      (typeof output === "string"
        ? output
        : "Langkah penalaran agen selesai diproses.");

    const logId = `LOG-${Date.now().toString().slice(-6)}`;
    const stepItem = {
      step: cleanStep,
      phase: cleanStepName,
      title: `${cleanStepName} Phase`,
      detail: cleanDecision,
      latency: latencyMs ? `${latencyMs}ms` : undefined,
    };

    // Upayakan persistensi ke Prisma jika DB aktif
    try {
      let targetInspection = inspectionId
        ? await prisma.inspection.findFirst({
            where: {
              OR: [{ id: inspectionId }, { id: { endsWith: inspectionId } }],
            },
          })
        : null;

      if (!targetInspection) {
        targetInspection = await prisma.inspection.findFirst({
          orderBy: { timestamp: "desc" },
        });
      }

      if (targetInspection) {
        await prisma.agentLog.create({
          data: {
            id: logId,
            inspectionId: targetInspection.id,
            step: cleanStep,
            stepName: cleanStepName,
            input: input || null,
            output: output || null,
            decision: cleanDecision,
            latencyMs: typeof latencyMs === "number" ? latencyMs : null,
          },
        });

        const currentTrace = Array.isArray(targetInspection.agentReasoningTrace)
          ? (targetInspection.agentReasoningTrace as any[])
          : [];
        const existingIdx = currentTrace.findIndex(
          (t) => t.step === cleanStep || t.phase === cleanStepName
        );
        const updatedTrace =
          existingIdx >= 0
            ? currentTrace.map((t, idx) => (idx === existingIdx ? stepItem : t))
            : [...currentTrace, stepItem];

        await prisma.inspection.update({
          where: { id: targetInspection.id },
          data: { agentReasoningTrace: updatedTrace },
        });
      }
    } catch (dbErr) {
      console.warn("[sigapStore] DB offline, mencatat agent-decision di memori event:", dbErr);
    }

    // Broadcast SSE live ke UI
    emitSigapEvent("agent:log", {
      inspectionId: inspectionId || "INS-LIVE",
      step: cleanStep,
      stepName: cleanStepName,
      decision: cleanDecision,
      traces: [stepItem],
    });

    return NextResponse.json(
      {
        success: true,
        message: `Langkah penalaran [${cleanStep}. ${cleanStepName}] berhasil dicatat.`,
        data: {
          id: logId,
          inspectionId: inspectionId || "INS-LIVE",
          step: cleanStep,
          stepName: cleanStepName,
          decision: cleanDecision,
          latencyMs: latencyMs ?? 80,
          timestamp: new Date().toISOString(),
          traces: [stepItem],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in /api/internal/agent-decision:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mencatat keputusan penalaran agen",
      },
      { status: 500 }
    );
  }
}
