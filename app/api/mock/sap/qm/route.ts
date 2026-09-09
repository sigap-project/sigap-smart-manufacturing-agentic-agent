import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ticketId = `QM-NOTIF-${Math.floor(10000 + Math.random() * 90000)}`;

    return NextResponse.json({
      d: {
        TicketId: ticketId,
        NotificationType: body.notificationType || "F2",
        MaterialNumber: body.materialNumber || "MAT-IMPELLER-C300",
        DefectCode: body.defectCode || "DEF-CAST-01",
        BatchId: body.batchId || "#B-UNKNOWN",
        Status: "CreatedInSAP",
        ShortText: `Notifikasi Cacat SIGAP: ${body.defectCode} pada Lot ${body.batchId}`,
        ReportedBy: "SIGAP_AUTONOMOUS_VISION_AGENT",
        CreatedAt: new Date().toISOString(),
      },
      ticketId,
      status: "SUCCESS",
      message: `Quality Notification ${ticketId} created in SAP QM mock layer.`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
