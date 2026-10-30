import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse, verifyMutationAuth } from "@/lib/auth";
import { emitSigapEvent } from "@/lib/events";
import { formatDispatchRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/dispatch/[id]/approve
 * Supervisor authorization endpoint for proposed quality actions.
 * Enforces:
 * 1. Actor must be authenticated supervisor.
 * 2. CSRF enforcement on session cookie mutations.
 * 3. Required expectedRevision, expectedBatchVersion, and non-empty reason.
 * 4. Parameterized row lock on Batch row.
 * 5. Recomputes defect eligibility before approval (withdrawn defect cannot authorize stale action).
 * 6. Transitions status atomically from 'pending_approval' to 'queued' for worker execution.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required to approve dispatch");
  }
  if (actor.role !== "supervisor") {
    return forbiddenResponse("Only supervisors can authorize enterprise ERP dispatches");
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

        // Idempotent return if already queued, executing, or verified
        if (["queued", "executing", "verifying", "verified"].includes(dispatch.status)) {
          return { error: null, dispatch, idempotent: true };
        }

        if (dispatch.status !== "pending_approval") {
          return {
            error: "INVALID_STATE",
            status: 409,
            message: `Cannot approve dispatch in status '${dispatch.status}'`,
          };
        }

        // Version & revision checks
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

        // Recompute eligibility against the policy snapshot the proposal was made under
        const run = dispatch.runId
          ? await tx.workflowRun.findUnique({
              where: { id: dispatch.runId },
              select: { inspectionId: true, policySnapshot: true },
            })
          : null;
        const policy = (run?.policySnapshot ?? {}) as {
          slidingWindowMinutes?: number;
          escalationDefectTrigger?: number;
        };
        const trigger = policy.escalationDefectTrigger ?? 3;
        const windowMs = (policy.slidingWindowMinutes ?? 8) * 60 * 1000;
        const now = Date.now();
        const windowInspections = await tx.inspection.findMany({
          where: {
            batchId: batch.id,
            caseEpoch: batch.caseEpoch,
            capturedAt: { gte: new Date(now - windowMs), lte: new Date(now) },
          },
          select: { itemId: true, outcome: true, reviewOutcome: true },
        });

        const effectiveDefects = new Set<string>();
        for (const insp of windowInspections) {
          if (insp.reviewOutcome === "confirmed_defect") {
            if (insp.itemId) effectiveDefects.add(insp.itemId);
          } else if (insp.reviewOutcome !== "confirmed_ok") {
            if (insp.outcome === "defect" && insp.itemId) effectiveDefects.add(insp.itemId);
          }
        }

        const defectCount = effectiveDefects.size;
        if (
          (dispatch.actionType === "HOLD_MATERIAL_LOT" || dispatch.actionType === "HOLD_WORK_ORDER") &&
          defectCount < trigger
        ) {
          return {
            error: "PROPOSAL_INELIGIBLE",
            status: 409,
            message: `Action '${dispatch.actionType}' is no longer eligible: defect count is ${defectCount} (requires ${trigger}).`,
          };
        }

        // Transition atomically to 'queued'
        const updated = await tx.dispatchRecord.update({
          where: { id },
          data: {
            status: "queued",
            approvedBy: `${actor.id}: ${reason}`,
            revision: { increment: 1 },
          },
          include: { batch: true },
        });

        // Record trace in AgentLog
        if (dispatch.runId) {
          if (run?.inspectionId) {
            await tx.agentLog.create({
              data: {
                inspectionId: run.inspectionId,
                runId: dispatch.runId,
                sequence: 98,
                step: "05",
                stepName: "DISPATCH",
                stage: "DISPATCH",
                kind: "approval",
                status: "completed",
                decision: `Supervisor ${actor.id} approved ${dispatch.actionType} (${defectCount} of ${trigger} defects in window); queued for SAP dispatch.`,
                input: { actionKey: dispatch.actionKey, approvedBy: actor.id, reason },
                output: { status: "queued", revision: updated.revision },
                latencyMs: 0,
              },
            });
          }
        }

        return { error: null, dispatch: updated, idempotent: false };
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
      message: `Tiket ${result.dispatch?.id} berhasil DISETUJUI & DIANTRIKAN untuk eksekusi.`,
      data: formatted,
      idempotent: result.idempotent,
    });
  } catch (err) {
    console.error("[PATCH /api/dispatch/[id]/approve Unexpected Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error approving dispatch",
      },
      { status: 500 }
    );
  }
}
