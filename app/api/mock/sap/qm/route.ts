import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST & GET /api/mock/sap/qm
 * Persistent SAP QM Simulator: Quality Notification
 * Resulting State: "OPEN"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionKey, payloadHash, targetId = "MAT-IMP-9842", details = {} } = body;

    if (!actionKey || !payloadHash) {
      return NextResponse.json(
        { success: false, error: "actionKey and payloadHash are required" },
        { status: 400 }
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
    const record = await prisma.simulatorRecord.create({
      data: {
        actionKey,
        payloadHash,
        targetId: String(targetId),
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
      mode: "simulator",
      idempotent: false,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Simulator write failure" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actionKey = searchParams.get("actionKey");

  if (!actionKey) {
    return NextResponse.json({ success: false, error: "Missing actionKey" }, { status: 400 });
  }

  const record = await prisma.simulatorRecord.findUnique({
    where: { actionKey },
  });

  if (!record) {
    return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    externalId: record.externalId,
    resultingState: record.resultingState,
    targetId: record.targetId,
    actionKey: record.actionKey,
  });
}
