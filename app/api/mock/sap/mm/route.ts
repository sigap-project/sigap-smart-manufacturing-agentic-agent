import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ticketId = `MM-HOLD-${Math.floor(10000 + Math.random() * 90000)}`;

    return NextResponse.json({
      d: {
        TicketId: ticketId,
        SupplierId: body.supplierId || "SUPP-KRAKATAU-09",
        Status: "BLOCKED_FOR_RECEIPT",
        ReasonCode: "EXCESSIVE_DEFECT_RATE",
        QuarantineBatchId: body.batchId || "#B-UNKNOWN",
        AutoReviewInDays: 7,
        CreatedAt: new Date().toISOString(),
      },
      ticketId,
      status: "SUCCESS",
      message: `Supplier ${body.supplierId || "SUPP-KRAKATAU-09"} placed on Quality Block in SAP MM mock layer.`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
