import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse, verifyMutationAuth } from "@/lib/auth";
import { emitSigapEvent } from "@/lib/events";
import { formatBatchRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/batches/[id]/approve
 * Supervisor batch release endpoint with strict enterprise governance.
 * Enforces:
 * 1. Actor must be authenticated supervisor.
 * 2. CSRF enforcement on session cookie mutations.
 * 3. Required expectedBatchVersion and non-empty reason.
 * 4. Parameterized row lock on Batch row.
 * 5. No active verified ERP hold (409 ERP_HOLD_ACTIVE).
 * 6. No queued/executing/verifying actions or active workflow.
 * 7. Every suspect inspection in current case must be reviewed as 'confirmed_ok'.
 * 8. Rejects outstanding unsent proposals upon release.
 * 9. Fresh heartbeat check on bound station if present.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required to release batch");
  }
  if (actor.role !== "supervisor") {
    return forbiddenResponse("Only supervisors can authorize batch releases");
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

  const { expectedBatchVersion, reason } = body;

  if (typeof expectedBatchVersion !== "number") {
    return NextResponse.json(
      { success: false, error: "expectedBatchVersion is required and must be a number" },
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
        // Find batch by id or lotId
        const batchLookup = await tx.batch.findFirst({
          where: { OR: [{ id }, { lotId: id }] },
          select: { id: true },
        });

        if (!batchLookup) {
          return { error: "NOT_FOUND", status: 404, message: "Batch not found" };
        }

        const batchId = batchLookup.id;

        // Row lock on Batch row
        await tx.$executeRaw`SELECT id FROM "Batch" WHERE id = ${batchId} FOR UPDATE`;

        const batch = await tx.batch.findUnique({
          where: { id: batchId },
          include: {
            inspections: {
              where: {
                caseEpoch: { gt: 0 },
                OR: [{ outcome: "defect" }, { outcome: "unknown" }, { defectDetected: true }],
              },
            },
            dispatchRecords: true,
          },
        });

        if (!batch) {
          return { error: "NOT_FOUND", status: 404, message: "Batch not found" };
        }

        // Version check
        if (batch.version !== expectedBatchVersion) {
          return {
            error: "VERSION_CONFLICT",
            status: 409,
            message: `Stale batch version conflict: expected ${expectedBatchVersion}, current ${batch.version}`,
          };
        }

        // Check 1: No active verified ERP hold
        const activeHolds = batch.dispatchRecords.filter(
          (d) =>
            d.status === "verified" &&
            (d.actionType === "HOLD_MATERIAL_LOT" || d.actionType === "HOLD_WORK_ORDER")
        );

        if (activeHolds.length > 0) {
          return {
            error: "ERP_HOLD_ACTIVE",
            status: 409,
            message:
              "Cannot release batch: active verified ERP hold exists on warehouse lot or work order.",
          };
        }

        // Check 2: No queued / executing / verifying dispatch actions
        const activeDispatches = batch.dispatchRecords.filter((d) =>
          ["queued", "executing", "verifying"].includes(d.status)
        );
        if (activeDispatches.length > 0) {
          return {
            error: "DISPATCH_IN_PROGRESS",
            status: 409,
            message: `Cannot release batch: ${activeDispatches.length} dispatch action(s) are currently in-flight.`,
          };
        }

        // Check 3: No active workflow runs in this case
        const activeWorkflows = await tx.workflowRun.findMany({
          where: {
            batchId: batch.id,
            caseEpoch: batch.caseEpoch,
            status: { in: ["queued", "running"] },
          },
        });
        if (activeWorkflows.length > 0) {
          return {
            error: "WORKFLOW_IN_PROGRESS",
            status: 409,
            message: "Cannot release batch: background quality workflow is still running.",
          };
        }

        // Check 4: Every suspect in current case must be reviewed as 'confirmed_ok'
        const currentCaseSuspects = batch.inspections.filter(
          (i) => i.caseEpoch === batch.caseEpoch
        );
        const unconfirmedSuspects = currentCaseSuspects.filter(
          (i) => i.reviewOutcome !== "confirmed_ok"
        );

        if (unconfirmedSuspects.length > 0) {
          return {
            error: "SUSPECT_INSPECTIONS_UNRESOLVED",
            status: 409,
            message: `Cannot release batch: ${unconfirmedSuspects.length} suspect inspection(s) in this case must be reviewed and marked 'confirmed_ok' by supervisor.`,
          };
        }

        // Check 5: Station heartbeat freshness (≤ 30s, paused, idle, queue 0) if device bound
        const isTestMode = process.env.SIGAP_TEST_MODE === "1";
        if (!isTestMode) {
          const boundDevice = await tx.device.findFirst({
            where: { batchId: batch.id, enabled: true },
          });

          if (boundDevice) {
            const lastSeen = boundDevice.lastSeenAt ? boundDevice.lastSeenAt.getTime() : 0;
            const ageMs = Date.now() - lastSeen;
            const hb = boundDevice.lastHeartbeat as Record<string, unknown> | null;

            if (ageMs > 30000 || !hb || !hb.paused || !hb.idle || (hb.queueDepth as number) > 0) {
              return {
                error: "STATION_NOT_DRAINED",
                status: 409,
                message:
                  "Cannot release batch: bound physical station must report fresh heartbeat (<=30s), paused, idle, and drained queue.",
              };
            }
          }
        }

        // Cancel any outstanding pending_approval dispatches
        await tx.dispatchRecord.updateMany({
          where: {
            batchId: batch.id,
            status: "pending_approval",
          },
          data: {
            status: "rejected",
            approvedBy: `Dismissed on local batch release: ${reason}`,
          },
        });

        // Update batch atomically
        const updated = await tx.batch.update({
          where: { id: batch.id },
          data: {
            status: "released",
            storageZone: "standard",
            pendingApproval: false,
            caseEpoch: { increment: 1 },
            version: { increment: 1 },
          },
        });

        return { error: null, updated };
      },
      { maxWait: 15000, timeout: 30000 }
    );

    if (result.error) {
      return NextResponse.json(
        { success: false, code: result.error, error: result.message },
        { status: result.status }
      );
    }

    const formatted = formatBatchRecord(result.updated);
    emitSigapEvent("batch:status_changed", formatted);

    return NextResponse.json({
      success: true,
      message: `Batch ${result.updated?.lotId || result.updated?.id} berhasil DISETUJUI & DILEPASKAN.`,
      data: formatted,
    });
  } catch (err) {
    console.error("[PATCH /api/batches/[id]/approve Unexpected Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error approving batch",
      },
      { status: 500 }
    );
  }
}
