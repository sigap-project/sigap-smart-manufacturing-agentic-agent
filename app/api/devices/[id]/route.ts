import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/devices/[id]
 * Read-only device status and heartbeat telemetry for UI dashboard.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Authentication required to inspect device telemetry");
  }

  const { id } = await params;
  const device = await prisma.device.findUnique({
    where: { id },
    select: {
      id: true,
      enabled: true,
      batchId: true,
      bindingVersion: true,
      stateVersion: true,
      lastSeenAt: true,
      lastHeartbeat: true,
    },
  });

  if (!device) {
    return NextResponse.json({ success: false, error: "Device not found" }, { status: 404 });
  }

  const isOnline = device.lastSeenAt
    ? Date.now() - device.lastSeenAt.getTime() < 30000
    : false;

  return NextResponse.json({
    success: true,
    data: {
      ...device,
      isOnline,
    },
  });
}
