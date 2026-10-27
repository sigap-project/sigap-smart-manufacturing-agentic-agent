import { NextRequest, NextResponse } from "next/server";
import { validateInternalApiKey, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST & GET /api/mock/sap/qm
 * Persistent SAP QM Simulator: Quality Notification
 * Resulting State: "OPEN"
 * Protected by server-only internal authentication.
 */
export async function POST(req: NextRequest) {
  const auth = validateInternalApiKey(req);
  if (!auth.authorized) {
    return unauthorizedResponse("Simulator requires valid internal authentication");
  }

  try {
    const body = await req.json();
    const { actionKey, payloadHash, targetId } = body;

    if (!actionKey || !payloadHash) {
      return NextResponse.json(
        { success: false, error: "actionKey and payloadHash are required" },
        { status: 400 }
      );
    }

    if (!targetId || typeof targetId !== "string" || !targetId.trim()) {
      return NextResponse.json(
        { success: false, error: "targetId is required and cannot be empty" },
        { status: 422 }
      );
    }

    // Require matching authorized DispatchRecord
    const dispatch = await prisma.dispatchRecord.findUnique({
      where: { actionKey },
    });

    if (!dispatch) {
      return NextResponse.json(
        { success: false, error: "No matching DispatchRecord found for actionKey" },
        { status: 403 }
      );
    }

    if (
      dispatch.status !== "queued" &&
      dispatch.status !== "executing" &&
      dispatch.status !== "verifying" &&
      dispatch.status !== "verified"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `DispatchRecord is in '${dispatch.status}' state; must be approved/queued/executing to write to simulator`,
        },
        { status: 403 }
      );
    }

    if (dispatch.payloadHash && dispatch.payloadHash !== payloadHash) {
      return NextResponse.json(
        { success: false, error: "Payload hash does not match approved DispatchRecord" },
        { status: 409 }
      );
    }

    // Idempotency check in persistent SimulatorRecord
    const existing = await prisma.simulatorRecord.findUnique({
      where: { actionKey },
    });

    if (existing) {
      if (existing.payloadHash === payloadHash) {
        return NextResponse.json({
          success: true,
          externalId: existing.externalId,
          resultingState: existing.resultingState,
          actionKey: existing.actionKey,
          targetId: existing.targetId,
          mode: "simulator",
          idempotent: true,
        });
      }
      return NextResponse.json(
        { success: false, error: "Conflicting payload hash for existing action key" },
        { status: 409 }
      );
    }

    const externalId = `QM-NOTIF-${payloadHash.slice(0, 8).toUpperCase()}`;

    try {
      const record = await prisma.simulatorRecord.create({
        data: {
          actionKey,
          payloadHash,
          targetId: String(targetId).trim(),
          externalId,
          actionType: "CREATE_QUALITY_NOTIFICATION",
          resultingState: "OPEN",
        },
      });

      return NextResponse.json({
        success: true,
        externalId: record.externalId,
        resultingState: record.resultingState,
        actionKey: record.actionKey,
        targetId: record.targetId,
        mode: "simulator",
        idempotent: false,
      });
    } catch (createErr: unknown) {
      // Handle concurrent race
      if (typeof createErr === "object" && createErr !== null && "code" in createErr && createErr.code === "P2002") {
        const raced = await prisma.simulatorRecord.findUnique({ where: { actionKey } });
        if (raced && raced.payloadHash === payloadHash) {
          return NextResponse.json({
            success: true,
            externalId: raced.externalId,
            resultingState: raced.resultingState,
            actionKey: raced.actionKey,
            targetId: raced.targetId,
            mode: "simulator",
            idempotent: true,
          });
        }
        return NextResponse.json(
          { success: false, error: "Conflicting actionKey write race in simulator" },
          { status: 409 }
        );
      }
      throw createErr;
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Simulator write failure" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = validateInternalApiKey(req);
  if (!auth.authorized) {
    return unauthorizedResponse("Simulator requires valid internal authentication");
  }

  const { searchParams } = new URL(req.url);
  const actionKey = searchParams.get("actionKey");

  if (!actionKey) {
    return NextResponse.json({ success: false, error: "Missing actionKey" }, { status: 400 });
  }

  const record = await prisma.simulatorRecord.findUnique({
    where: { actionKey },
  });

  if (!record) {
    return NextResponse.json({ success: false, error: "Record not found in simulator" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    externalId: record.externalId,
    resultingState: record.resultingState,
    targetId: record.targetId,
    actionKey: record.actionKey,
    mode: "simulator",
  });
}
