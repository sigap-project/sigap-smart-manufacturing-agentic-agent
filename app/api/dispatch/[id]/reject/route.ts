import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse, verifyMutationAuth } from "@/lib/auth";
import { emitSigapEvent } from "@/lib/events";
import { formatDispatchRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/dispatch/[id]/reject
 * Supervisor rejection endpoint for proposed quality actions.
 * Enforces:
 * 1. Actor must be authenticated supervisor.
 * 2. CSRF enforcement on session cookie mutations.
 * 3. Required expectedRevision, expectedBatchVersion, and non-empty reason.
 * 4. Parameterized row lock on Batch row.
 * 5. Rejection cancels proposal without claiming SAP execution.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required to reject dispatch");
  }
  if (actor.role !== "supervisor") {
    return forbiddenResponse("Only supervisors can reject enterprise actions");
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

  const { expectedRevision, expectedBatchVersion, reason } = body;

  if (typeof expectedRevision !== "number" || typeof expectedBatchVersion !== "number") {
    return NextResponse.json(
      { success: false, error: "expectedRevision and expectedBatchVersion are required numbers" },
      { status: 422 }
    );
  }

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json(
      { success: false, error: "reason is required and cannot be empty" },
      { status: 422 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const dispatch = await tx.dispatchRecord.findUnique({
          where: { id },
          include: { batch: true },
        });

        if (!dispatch) {
          return { error: "NOT_FOUND", status: 404, message: "Dispatch record not found" };
        }

        // Lock Batch row
        await tx.$executeRaw`SELECT id FROM "Batch" WHERE id = ${dispatch.batchId} FOR UPDATE`;

        const batch = await tx.batch.findUnique({
          where: { id: dispatch.batchId },
        });

        if (!batch) {
          return { error: "NOT_FOUND", status: 404, message: "Batch not found" };
        }

        if (["verified", "executing"].includes(dispatch.status)) {
          return {
            error: "CANNOT_REJECT_IN_FLIGHT",
            status: 409,
            message: `Cannot reject action already in state '${dispatch.status}'`,
          };
        }

        if (dispatch.revision !== expectedRevision) {
          return {
            error: "REVISION_CONFLICT",
            status: 409,
            message: `Stale dispatch revision conflict: expected ${expectedRevision}, current ${dispatch.revision}`,
          };
        }

        if (batch.version !== expectedBatchVersion) {
          return {
            error: "VERSION_CONFLICT",
            status: 409,
            message: `Stale batch version conflict: expected ${expectedBatchVersion}, current ${batch.version}`,
          };
        }

        const updated = await tx.dispatchRecord.update({
          where: { id },
          data: {
            status: "rejected",
            approvedBy: `${actor.id} (Rejected: ${String(reason)})`,
            revision: { increment: 1 },
          },
          include: { batch: true },
        });

        // Record trace in AgentLog
        if (dispatch.runId) {
          const run = await tx.workflowRun.findUnique({
            where: { id: dispatch.runId },
            select: { inspectionId: true },
          });
          if (run?.inspectionId) {
            await tx.agentLog.create({
              data: {
                inspectionId: run.inspectionId,
                runId: dispatch.runId,
                sequence: 97,
                step: "05",
                stepName: "DISPATCH",
                stage: "DISPATCH",
                kind: "decision",
                status: "completed",
                decision: `Supervisor ${actor.id} rejected ${dispatch.actionType}: ${reason}. No SAP action executed.`,
                input: { actionKey: dispatch.actionKey, rejectedBy: actor.id, reason },
                output: { status: "rejected", revision: updated.revision },
                latencyMs: 0,
              },
            });
          }
        }

        return { error: null, dispatch: updated };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    if (result.error) {
      return NextResponse.json(
        { success: false, code: result.error, error: result.message },
        { status: result.status }
      );
    }

    const formatted = formatDispatchRecord(result.dispatch);
    emitSigapEvent("dispatch:status_changed", formatted);

    return NextResponse.json({
      success: true,
      message: `Tiket ${result.dispatch?.id} berhasil DITOLAK.`,
      data: formatted,
    });
  } catch (err) {
    console.error("[PATCH /api/dispatch/[id]/reject Unexpected Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error rejecting dispatch",
      },
      { status: 500 }
    );
  }
}
