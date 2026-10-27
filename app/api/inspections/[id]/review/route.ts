import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse, verifyMutationAuth } from "@/lib/auth";
import { formatInspectionRecord, formatBatchRecord } from "@/lib/formatters";
import { emitSigapEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/inspections/[id]/review
 * Supervisor manual review of an optical inspection result.
 * Enforces:
 * 1. Actor must be authenticated supervisor.
 * 2. CSRF enforcement on session cookie mutations.
 * 3. Required reviewOutcome, non-empty reason, and expectedBatchVersion.
 * 4. Parameterized row lock on Batch row.
 * 5. Requeues workflow on confirmed_defect; invalidates unexecuted proposals on confirmed_ok.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required for inspection review");
  }
  if (actor.role !== "supervisor") {
    return forbiddenResponse("Only supervisors can conduct inspection manual reviews");
  }

  const csrfCheck = verifyMutationAuth(request, actor);
  if (!csrfCheck.authorized) {
    return NextResponse.json({ success: false, error: csrfCheck.error }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON body is required" },
      { status: 400 }
    );
  }

  const { reviewOutcome, reason, expectedBatchVersion } = body;

  if (
    reviewOutcome !== "confirmed_ok" &&
    reviewOutcome !== "confirmed_defect" &&
    reviewOutcome !== "unresolved"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "reviewOutcome must be 'confirmed_ok', 'confirmed_defect', or 'unresolved'",
      },
      { status: 422 }
    );
  }

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json(
      { success: false, error: "reason is required and cannot be empty" },
      { status: 422 }
    );
  }

  if (typeof expectedBatchVersion !== "number") {
    return NextResponse.json(
      { success: false, error: "expectedBatchVersion is required and must be a number" },
      { status: 422 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const inspection = await tx.inspection.findUnique({
          where: { id },
          include: { batch: true, workflowRun: true },
        });

        if (!inspection) {
          return { error: "NOT_FOUND", status: 404, message: "Inspection not found" };
        }

        // Lock Batch row
        await tx.$executeRaw`SELECT id FROM "Batch" WHERE id = ${inspection.batchId} FOR UPDATE`;

        const batch = await tx.batch.findUnique({
          where: { id: inspection.batchId },
        });

        if (!batch) {
          return { error: "NOT_FOUND", status: 404, message: "Batch not found" };
        }

        if (batch.version !== expectedBatchVersion) {
          return {
            error: "VERSION_CONFLICT",
            status: 409,
            message: `Stale batch version conflict: expected ${expectedBatchVersion}, current ${batch.version}`,
          };
        }

        const newStatus =
          reviewOutcome === "confirmed_ok"
            ? "Lolos QC"
            : reviewOutcome === "confirmed_defect"
            ? "Ditahan"
            : "Pending Review";

        const updated = await tx.inspection.update({
          where: { id },
          data: {
            reviewOutcome,
            reviewReason: reason,
            reviewedAt: new Date(),
            reviewedBy: actor.id,
            status: newStatus,
          },
          include: { batch: true },
        });

        // Effective aggregate updates
        let defectCountDelta = 0;
        if (reviewOutcome === "confirmed_defect" && inspection.outcome !== "defect") {
          defectCountDelta = 1;
        } else if (reviewOutcome === "confirmed_ok" && inspection.outcome === "defect") {
          defectCountDelta = -1;
        }

        const updatedBatch = await tx.batch.update({
          where: { id: batch.id },
          data: {
            defectCount: defectCountDelta !== 0 ? { increment: defectCountDelta } : undefined,
            status: reviewOutcome === "confirmed_defect" ? "held" : batch.status,
            storageZone: reviewOutcome === "confirmed_defect" ? "quarantine" : batch.storageZone,
            version: { increment: 1 },
          },
        });

        // Requeue workflow if confirmed_defect
        if (reviewOutcome === "confirmed_defect" && inspection.workflowRun) {
          await tx.workflowRun.update({
            where: { id: inspection.workflowRun.id },
            data: { status: "queued", attempts: 0 },
          });
        }

        // Invalidate unexecuted proposals if confirmed_ok
        if (reviewOutcome === "confirmed_ok") {
          await tx.dispatchRecord.updateMany({
            where: {
              batchId: batch.id,
              status: "pending_approval",
            },
            data: {
              status: "rejected",
              approvedBy: `Invalidated by confirmed_ok review: ${reason}`,
            },
          });
        }

        // Record trace in AgentLog
        await tx.agentLog.create({
          data: {
            inspectionId: inspection.id,
            runId: inspection.workflowRun?.id,
            sequence: 99,
            step: "99",
            stepName: "DECISION",
            stage: "DECISION",
            kind: "decision",
            status: "completed",
            input: { reviewOutcome, reason },
            output: {
              reviewedBy: actor.id,
              reviewedAt: new Date().toISOString(),
              batchVersion: updatedBatch.version,
            },
            latencyMs: 0,
          },
        });

        return { error: null, inspection: updated, batch: updatedBatch };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    if (result.error) {
      return NextResponse.json(
        { success: false, code: result.error, error: result.message },
        { status: result.status }
      );
    }

    const formatted = formatInspectionRecord(result.inspection);
    emitSigapEvent("batch:status_changed", formatBatchRecord(result.batch));
    emitSigapEvent("inspection:created", formatted);

    return NextResponse.json({
      success: true,
      data: formatted,
      message: `Inspeksi ${id} berhasil ditinjau sebagai '${reviewOutcome}'`,
    });
  } catch (err) {
    console.error("[PATCH /api/inspections/[id]/review Unexpected Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error reviewing inspection",
      },
      { status: 500 }
    );
  }
}
