import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

/**
 * GET /api/agent/logs
 * Returns persisted agent logs with sequence, runId, toolCallId, stage, kind, status, timestamps, and latency.
 * Supports filters: inspectionId, runId, afterSequence.
 * Page size bounded to 200 max.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inspectionId = searchParams.get("inspectionId")?.trim();
    const runId = searchParams.get("runId")?.trim();
    const afterSequenceParam = searchParams.get("afterSequence");
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.max(1, Math.min(200, isNaN(rawLimit) ? 50 : rawLimit));

    const where: Record<string, unknown> = {};

    if (runId) {
      where.runId = runId;
    }

    if (inspectionId) {
      where.inspectionId = inspectionId;
    }

    if (afterSequenceParam && !isNaN(parseInt(afterSequenceParam, 10))) {
      where.sequence = { gt: parseInt(afterSequenceParam, 10) };
    }

    const logs = await prisma.agentLog.findMany({
      where,
      include: {
        inspection: {
          select: {
            id: true,
            batchId: true,
            defectClass: true,
            confidence: true,
            status: true,
            outcome: true,
          },
        },
      },
      orderBy: [{ sequence: "asc" }, { startedAt: "asc" }],
      take: limit,
    });

    const data = logs.map((l) => {
      const startedAtIso = l.startedAt ? new Date(l.startedAt).toISOString() : new Date(l.timestamp).toISOString();
      const completedAtIso = l.completedAt ? new Date(l.completedAt).toISOString() : null;
      const formattedTime = formatTimestampWIB(l.startedAt || l.timestamp);

      return {
        id: l.id,
        runId: l.runId || null,
        sequence: l.sequence,
        toolCallId: l.toolCallId || null,
        stage: l.stage || l.stepName,
        stepName: l.stepName,
        step: l.step,
        kind: l.kind,
        status: l.status,
        startedAt: startedAtIso,
        completedAt: completedAtIso,
        timestamp: formattedTime,
        rawDate: startedAtIso,
        input: l.input,
        output: l.output,
        decision: l.decision || null,
        latencyMs: l.latencyMs ?? null,
        latency: l.latencyMs ? `${l.latencyMs}ms` : undefined,
        // Legacy display helper fields
        phase: l.stage || l.stepName,
        title: `${l.stage || l.stepName} Phase`,
        detail:
          l.decision ||
          (l.kind === "model_usage"
            ? "Model turn completed."
            : l.output && typeof l.output === "object"
            ? JSON.stringify(l.output, null, 2)
            : "Agent deduction step completed."),
        inspection: l.inspection,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      total: data.length,
      source: "database_agent_logs",
    });
  } catch (error) {
    console.error("[GET /api/agent/logs Unexpected Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error retrieving agent logs",
      },
      { status: 500 }
    );
  }
}
