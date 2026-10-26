import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/devices/[id]/binding
 * Supervisor command to bind device to an active manufacturing batch.
 * Requires fresh paused or idle heartbeat and zero queue depth.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required");
  }
  if (actor.role !== "supervisor") {
    return forbiddenResponse("Only supervisors can update station device bindings");
  }

  const { id } = await params;
  const body = await request.json();
  const { batchId, expectedBindingVersion } = body;

  if (!batchId || typeof batchId !== "string") {
    return NextResponse.json({ success: false, error: "batchId is required" }, { status: 400 });
  }

  const [device, targetBatch] = await Promise.all([
    prisma.device.findUnique({ where: { id } }),
    prisma.batch.findUnique({ where: { id: batchId } }),
  ]);

  if (!device) {
    return NextResponse.json({ success: false, error: "Device not found" }, { status: 404 });
  }
  if (!targetBatch) {
    return NextResponse.json({ success: false, error: "Target batch not found" }, { status: 404 });
  }

  // Version check
  if (typeof expectedBindingVersion === "number" && device.bindingVersion !== expectedBindingVersion) {
    return NextResponse.json(
      {
        success: false,
        error: `Binding version conflict: expected ${expectedBindingVersion}, current ${device.bindingVersion}`,
      },
      { status: 409 }
    );
  }

  // Heartbeat freshness check (lastSeen within 30 seconds)
  const now = Date.now();
  if (!device.lastSeenAt || now - device.lastSeenAt.getTime() > 30000) {
    return NextResponse.json(
      { success: false, error: "Device is offline or heartbeat is stale (> 30s ago)" },
      { status: 409 }
    );
  }

  const hb = (device.lastHeartbeat as Record<string, unknown>) || {};
  if (hb.queueDepth && (hb.queueDepth as number) > 0) {
    return NextResponse.json(
      { success: false, error: `Device queue is not empty (depth: ${hb.queueDepth}). Flush queue first.` },
      { status: 409 }
    );
  }

  const updated = await prisma.device.update({
    where: { id },
    data: {
      batchId: targetBatch.id,
      bindingVersion: { increment: 1 },
      stateVersion: { increment: 1 },
    },
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
}
