import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper untuk memformat timestamp ke standar WIB (Asia/Jakarta)
function formatTimestampWIB(date: Date | string | null | undefined): string {
  const d = date ? new Date(date) : new Date();
  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(d) + " WIB"
  );
}

// -----------------------------------------------------------------------------
// GET /api/agent/logs
// Read-only endpoint untuk mengambil jejak deduksi penalaran bertahap agen AI.
// Query Params:
//   - inspectionId (opsional): filter berdasarkan ID inspeksi spesifik
//   - limit (opsional, default: 50): batasan jumlah rekaman
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inspectionIdParam = searchParams.get("inspectionId");
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    const where: any = {};
    if (inspectionIdParam && inspectionIdParam.trim()) {
      where.inspectionId = inspectionIdParam.trim();
    }

    // 1. Ambil entri dari tabel AgentLog
    const logs = await prisma.agentLog.findMany({
      where,
      include: {
        inspection: {
          include: {
            batch: true,
          },
        },
      },
      orderBy: [
        { timestamp: "desc" },
        { step: "asc" },
      ],
      take: limitParam,
    });

    // 2. Jika tabel AgentLog memiliki data, format dan kembalikan
    if (logs.length > 0) {
      const formattedLogs = logs.map((log: any) => {
        const rawDate = log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString();
        return {
          id: log.id,
          inspectionId: log.inspectionId,
          step: log.step,
          stepName: log.stepName,
          phase: log.stepName, // alias untuk komponen UI
          title: `${log.stepName} Phase Analysis`,
          detail: log.decision || (typeof log.output === "object" ? JSON.stringify(log.output) : "Langkah deduksi penalaran agen."),
          latency: log.latencyMs ? `${log.latencyMs}ms` : undefined,
          latencyMs: log.latencyMs ?? null,
          input: log.input,
          output: log.output,
          decision: log.decision,
          timestamp: formatTimestampWIB(log.timestamp),
          rawDate,
          inspection: log.inspection
            ? {
                id: log.inspection.id,
                batchId: log.inspection.batchId,
                lotId: log.inspection.batch?.lotId || log.inspection.batchId,
                productType: log.inspection.batch?.productType || "Bracket Motor A7",
                defectClass: log.inspection.defectClass,
                confidence: log.inspection.confidence,
                status: log.inspection.status,
              }
            : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: formattedLogs,
        total: formattedLogs.length,
        source: "database_agent_logs",
      });
    }

    // 3. Smart Fallback: Jika inspectionId diberikan namun belum ada baris AgentLog terpisah,
    // baca langkah dari Inspection.agentReasoningTrace (JSON Array)
    if (inspectionIdParam && inspectionIdParam.trim()) {
      const inspection = await prisma.inspection.findUnique({
        where: { id: inspectionIdParam.trim() },
        include: { batch: true },
      });

      if (inspection && Array.isArray(inspection.agentReasoningTrace) && inspection.agentReasoningTrace.length > 0) {
        const traces = inspection.agentReasoningTrace as Array<{
          step: string;
          phase: string;
          title: string;
          detail: string;
          latency?: string;
        }>;

        const syntheticLogs = traces.map((t, idx) => {
          const latencyNum = t.latency ? parseInt(t.latency.replace(/\D/g, ""), 10) : null;
          return {
            id: `trace-${inspection.id}-${t.step || idx + 1}`,
            inspectionId: inspection.id,
            step: t.step || `0${idx + 1}`,
            stepName: t.phase || "ANALYSIS",
            phase: t.phase || "ANALYSIS",
            title: t.title || `Langkah ${t.step}`,
            detail: t.detail || "",
            latency: t.latency || (latencyNum ? `${latencyNum}ms` : undefined),
            latencyMs: latencyNum,
            input: null,
            output: { trace: t.detail },
            decision: inspection.defectClass,
            timestamp: formatTimestampWIB(inspection.timestamp),
            rawDate: new Date(inspection.timestamp).toISOString(),
            inspection: {
              id: inspection.id,
              batchId: inspection.batchId,
              lotId: inspection.batch?.lotId || inspection.batchId,
              productType: inspection.batch?.productType || "Bracket Motor A7",
              defectClass: inspection.defectClass,
              confidence: inspection.confidence,
              status: inspection.status,
            },
          };
        });

        return NextResponse.json({
          success: true,
          data: syntheticLogs,
          total: syntheticLogs.length,
          source: "database_inspection_trace",
        });
      }
    }

    // 4. Jika tidak ada hasil
    return NextResponse.json({
      success: true,
      data: [],
      total: 0,
      source: "database",
      message: inspectionIdParam
        ? `Tidak ditemukan log penalaran untuk inspection ID '${inspectionIdParam}'.`
        : "Belum ada catatan log agen di database.",
    });
  } catch (error) {
    console.warn("Koneksi DB agent logs offline:", error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        total: 0,
        error: error instanceof Error ? error.message : "Gagal mengambil log penalaran agen",
      },
      { status: 500 }
    );
  }
}
