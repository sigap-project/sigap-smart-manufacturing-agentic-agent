import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBatchByIdOrLot, formatBatchRecord } from "../../helper";
import { emitSigapEvent } from "@/lib/events";

// -----------------------------------------------------------------------------
// PATCH /api/batches/[id]/reject
// Menolak batch (Human Rejection / Escalation):
// - status: "rejected"
// - pendingApproval: false
// - storageZone: "quarantine"
// - slaSeconds: null
// -----------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingBatch = await findBatchByIdOrLot(id);

    if (!existingBatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Batch dengan ID atau Lot '${id}' tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    const updatedBatch = await prisma.batch.update({
      where: { id: existingBatch.id },
      data: {
        status: "rejected",
        pendingApproval: false,
        storageZone: "quarantine",
        slaSeconds: null,
        escalationScore: Math.max(existingBatch.escalationScore ?? 0, 0.85),
      },
      include: {
        inspections: {
          orderBy: { timestamp: "desc" },
          take: 20,
        },
        dispatchRecords: {
          orderBy: { dispatchedAt: "desc" },
        },
      },
    });

    const formatted = formatBatchRecord(updatedBatch);

    // Broadcast perubahan status batch ke seluruh klien SSE
    emitSigapEvent("batch:status_changed", formatted);

    return NextResponse.json({
      success: true,
      message: `Batch ${updatedBatch.lotId} DITOLAK dan dialihkan ke Zona Karantina. Tiket notifikasi mutu diteruskan ke SAP QM.`,
      data: formatted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memproses penolakan batch",
      },
      { status: 500 }
    );
  }
}
