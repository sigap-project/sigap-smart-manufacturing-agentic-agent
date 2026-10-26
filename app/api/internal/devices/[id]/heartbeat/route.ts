import { NextRequest, NextResponse } from "next/server";
import { validateDeviceToken, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/devices/[id]/heartbeat
 * Periodic device health & telemetry beacon (every 10s).
 * Protected by device bearer token.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateDeviceToken(request, id);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error || "Device unauthorized");
  }

  try {
    const body = await request.json();
    const {
      queueDepth = 0,
      cameraHealthy = true,
      modelHealthy = true,
      modelVersion = "",
      idle = true,
      paused = false,
      lastEventId,
      localAlert = false,
    } = body;

    const device = await prisma.device.upsert({
      where: { id },
      update: {
        lastSeenAt: new Date(),
        lastHeartbeat: {
          queueDepth,
          cameraHealthy,
          modelHealthy,
          modelVersion,
          idle,
          paused,
          lastEventId,
          localAlert,
          receivedAt: new Date().toISOString(),
        },
      },
      create: {
        id,
        tokenHash: "provisioned-via-preflight",
        enabled: true,
        bindingVersion: 1,
        stateVersion: 1,
        lastSeenAt: new Date(),
        lastHeartbeat: {
          queueDepth,
          cameraHealthy,
          modelHealthy,
          modelVersion,
          idle,
          paused,
          lastEventId,
          localAlert,
          receivedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        stateVersion: device.stateVersion,
        bindingVersion: device.bindingVersion,
        batchId: device.batchId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to record heartbeat" },
      { status: 500 }
    );
  }
}
