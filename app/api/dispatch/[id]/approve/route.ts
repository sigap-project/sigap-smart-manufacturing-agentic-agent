import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { emitSigapEvent } from "@/lib/events";
import { formatDispatchRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/dispatch/[id]/approve
 * Supervisor authorization endpoint for proposed quality actions.
 * Transitions status atomically from 'pending_approval' to 'queued' for worker execution.
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

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body optional
  }

  const { expectedRevision, expectedBatchVersion, reason } = body;

  const existing = await prisma.dispatchRecord.findUnique({
    where: { id },
    include: { batch: true },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: "Dispatch record not found" }, { status: 404 });
  }

  // Idempotent return if already approved/queued/verified
  if (["queued", "executing", "verifying", "verified"].includes(existing.status)) {
    return NextResponse.json({
      success: true,
      data: formatDispatchRecord(existing),
      message: "Action already approved and queued for execution",
    });
  }

  if (existing.status !== "pending_approval") {
    return NextResponse.json(
      { success: false, error: `Cannot approve action in status '${existing.status}'` },
      { status: 409 }
    );
  }

  // Check expected revision & batch version
  if (typeof expectedRevision === "number" && existing.revision !== expectedRevision) {
    return NextResponse.json(
      {
        success: false,
        error: `Stale revision conflict: expected ${expectedRevision}, current ${existing.revision}`,
      },
      { status: 409 }
    );
  }

  if (typeof expectedBatchVersion === "number" && existing.batch.version !== expectedBatchVersion) {
    return NextResponse.json(
      {
        success: false,
        error: `Stale batch version conflict: expected ${expectedBatchVersion}, current ${existing.batch.version}`,
      },
      { status: 409 }
    );
  }

  const updated = await prisma.dispatchRecord.update({
    where: { id },
    data: {
      status: "queued",
      approvedBy: `${actor.id} (Supervisor)`,
      revision: { increment: 1 },
    },
    include: { batch: true },
  });

  const formatted = formatDispatchRecord(updated);
  emitSigapEvent("dispatch:status_changed", formatted);

  return NextResponse.json({
    success: true,
    message: `Tiket ${updated.id} (${updated.consumer}) berhasil disetujui & diantrikan ke ERP.`,
    data: formatted,
  });
}
