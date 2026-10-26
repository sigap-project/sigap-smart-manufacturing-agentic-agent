import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { emitSigapEvent } from "@/lib/events";
import { formatDispatchRecord } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/dispatch/[id]/reject
 * Supervisor rejection endpoint for proposed quality actions.
 * Transitions status to 'rejected' with mandatory reason.
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

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body optional
  }

  const { reason = "Rejected by supervisor review" } = body;

  const existing = await prisma.dispatchRecord.findUnique({
    where: { id },
    include: { batch: true },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: "Dispatch record not found" }, { status: 404 });
  }

  if (["verified", "executing"].includes(existing.status)) {
    return NextResponse.json(
      { success: false, error: `Cannot reject action already in state '${existing.status}'` },
      { status: 409 }
    );
  }

  const updated = await prisma.dispatchRecord.update({
    where: { id },
    data: {
      status: "rejected",
      approvedBy: `${actor.id} (Rejected: ${String(reason)})`,
      revision: { increment: 1 },
    },
    include: { batch: true },
  });

  const formatted = formatDispatchRecord(updated);
  emitSigapEvent("dispatch:status_changed", formatted);

  return NextResponse.json({
    success: true,
    message: `Tiket ${updated.id} berhasil DITOLAK.`,
    data: formatted,
  });
}
