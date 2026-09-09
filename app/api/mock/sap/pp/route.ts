import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ticketId = `PP-ORDER-${Math.floor(10000 + Math.random() * 90000)}`;

    return NextResponse.json({
      d: {
        TicketId: ticketId,
        WorkOrderId: body.workOrderId || "WO-2026-8819",
        Action: "HOLD_DISPATCH",
        AdjustDefectCount: body.defectCount || 12,
        Status: "ScheduleAdjusted",
        Reason: `Auto-hold by SIGAP Agent due to defect escalation on batch ${body.batchId || "#B-UNKNOWN"}`,
        CreatedAt: new Date().toISOString(),
      },
      ticketId,
      status: "SUCCESS",
      message: `Production Order ${body.workOrderId || "WO-2026-8819"} rescheduled in SAP PP mock layer.`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
