import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { emitSigapEvent } from "@/lib/events";
import { formatBatchRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/batches/[id]/approve
 * Supervisor batch release endpoint with strict enterprise governance.
 * Enforces:
 * 1. Actor must be authenticated supervisor.
 * 2. No active verified ERP hold on the batch (409 ERP_HOLD_ACTIVE).
 * 3. Every suspect inspection in current case must be reviewed as 'confirmed_ok'.
 * 4. Rejects outstanding unsent proposals upon release.
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

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body optional
  }

  const { expectedBatchVersion, reason = "Supervisor confirmed visual clearance" } = body;

  const batch = await prisma.batch.findFirst({
    where: { OR: [{ id }, { lotId: id }] },
    include: {
      inspections: {
        where: {
          OR: [{ outcome: "defect" }, { outcome: "unknown" }, { defectDetected: true }],
        },
      },
      dispatchRecords: true,
    },
  });

  if (!batch) {
    return NextResponse.json({ success: false, error: "Batch tidak ditemukan" }, { status: 404 });
  }

  if (typeof expectedBatchVersion === "number" && batch.version !== expectedBatchVersion) {
    return NextResponse.json(
      {
        success: false,
        error: `Stale batch version conflict: expected ${expectedBatchVersion}, current ${batch.version}`,
      },
      { status: 409 }
    );
  }

  // Check 1: No active verified ERP hold
  const activeHolds = batch.dispatchRecords.filter(
    (d) =>
      d.status === "verified" &&
      (d.actionType === "HOLD_MATERIAL_LOT" || d.actionType === "HOLD_WORK_ORDER")
  );

  if (activeHolds.length > 0) {
    return NextResponse.json(
      {
        success: false,
        code: "ERP_HOLD_ACTIVE",
        error: "Cannot release batch: active verified ERP hold exists on warehouse lot or work order.",
      },
      { status: 409 }
    );
  }

  // Check 2: Every suspect inspection in current case must be reviewed as confirmed_ok
  const unresolvedSuspects = batch.inspections.filter(
    (i) => i.reviewOutcome !== "confirmed_ok"
  );

  if (unresolvedSuspects.length > 0) {
    return NextResponse.json(
      {
        success: false,
        code: "SUSPECT_INSPECTIONS_UNRESOLVED",
        error: `Cannot release batch: ${unresolvedSuspects.length} suspect inspection(s) must be reviewed and marked 'confirmed_ok' by supervisor.`,
      },
      { status: 409 }
    );
  }

  // Dismiss any outstanding pending_approval dispatches
  await prisma.dispatchRecord.updateMany({
    where: {
      batchId: batch.id,
      status: "pending_approval",
    },
    data: {
      status: "rejected",
      approvedBy: `Dismissed on local batch release: ${reason}`,
    },
  });

  const updated = await prisma.batch.update({
    where: { id: batch.id },
    data: {
      status: "released",
      storageZone: "standard",
      pendingApproval: false,
      caseEpoch: { increment: 1 },
      version: { increment: 1 },
    },
  });

  const formatted = formatBatchRecord(updated);
  emitSigapEvent("batch:status_changed", formatted);

  return NextResponse.json({
    success: true,
    message: `Batch ${updated.lotId || updated.id} berhasil DISETUJUI & DILEPASKAN untuk perakitan.`,
    data: formatted,
  });
}
