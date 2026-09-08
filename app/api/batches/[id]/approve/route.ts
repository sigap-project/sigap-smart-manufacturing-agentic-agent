import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBatchByIdOrLot, formatBatchRecord } from "../../helper";
import { emitSigapEvent } from "@/lib/events";

// -----------------------------------------------------------------------------
// PATCH /api/batches/[id]/approve
// Mengesahkan batch (Human Approval):
// - status: "released"
// - pendingApproval: false
// - storageZone: "standard"
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
        status: "released",
        pendingApproval: false,
        storageZone: "standard",
        slaSeconds: null,
        escalationScore: Math.min(existingBatch.escalationScore ?? 0, 0.15),
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
      message: `Batch ${updatedBatch.lotId} berhasil DISETUJUI & DILEPASKAN untuk perakitan.`,
      data: formatted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memproses persetujuan batch",
      },
      { status: 500 }
    );
  }
}
