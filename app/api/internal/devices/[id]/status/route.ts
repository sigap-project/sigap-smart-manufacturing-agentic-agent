import { NextRequest, NextResponse } from "next/server";
import { validateDeviceToken, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/devices/[id]/status
 * Low-latency device polling endpoint (every 2s).
 * Returns current binding, version, and case status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await validateDeviceToken(request, id);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error || "Device unauthorized");
  }

  const device = await prisma.device.findUnique({
    where: { id },
  });

  if (!device) {
    return NextResponse.json({ success: false, error: "Device not found" }, { status: 404 });
  }

  let batchStatus = "unknown";
  let caseEpoch = 1;
  let latestInspectionId: string | undefined;

  if (device.batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: device.batchId },
      include: {
        inspections: {
          take: 1,
          orderBy: { receivedAt: "desc" },
          select: { id: true },
        },
      },
    });
    if (batch) {
      batchStatus = batch.status;
      caseEpoch = batch.caseEpoch;
      latestInspectionId = batch.inspections[0]?.id;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      batchId: device.batchId,
      bindingVersion: device.bindingVersion,
      stateVersion: device.stateVersion,
      caseEpoch,
      batchStatus,
      latestInspectionId,
      validForMs: 10000,
    },
  });
}
