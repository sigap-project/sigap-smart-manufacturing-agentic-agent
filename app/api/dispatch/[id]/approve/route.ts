import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findDispatchById, formatDispatchRecord } from "../../helper";
import { emitSigapEvent } from "@/lib/events";

// -----------------------------------------------------------------------------
// PATCH /api/dispatch/[id]/approve
// Menyetujui tiket dispatch yang berstatus Pending Approval:
// - status: "Dispatched"
// - approvedBy: nama supervisor peninjau
// - dispatchedAt: waktu persetujuan
// - sapResponse: simulasi penerimaan berhasil dari SAP Gateway
// -----------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingDispatch = await findDispatchById(id);

    if (!existingDispatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Tiket dispatch dengan ID '${id}' tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    let approvedBy = "Budi Pratama (QC Supervisor)";
    try {
      const body = await request.json();
      if (body && body.approvedBy) {
        approvedBy = body.approvedBy;
      }
    } catch {
      // Body opsional jika hanya panggilan PATCH kosong
    }

    const updatedDispatch = await prisma.dispatchRecord.update({
      where: { id: existingDispatch.id },
      data: {
        status: "Dispatched",
        approvedBy,
        dispatchedAt: new Date(),
        sapResponse: {
          status: "APPROVED_AND_SYNCED",
          code: 200,
          message: `Tiket disetujui oleh ${approvedBy} dan diteruskan ke SAP Gateway.`,
          timestamp: new Date().toISOString(),
        },
      },
      include: {
        batch: true,
      },
    });

    const formatted = formatDispatchRecord(updatedDispatch);

    // Broadcast status tiket dispatch yang disetujui ke seluruh klien SSE
    emitSigapEvent("dispatch:status_changed", formatted);

    return NextResponse.json({
      success: true,
      message: `Tiket dispatch ${updatedDispatch.id} berhasil DISETUJUI dan DIKIRIM ke modul ${updatedDispatch.consumer}.`,
      data: formatted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memproses persetujuan tiket dispatch",
      },
      { status: 500 }
    );
  }
}
