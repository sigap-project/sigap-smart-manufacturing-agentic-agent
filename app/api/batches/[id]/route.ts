import { NextRequest, NextResponse } from "next/server";
import { findBatchByIdOrLot, formatBatchRecord } from "../helper";

// -----------------------------------------------------------------------------
// GET /api/batches/[id]
// Mengambil detail 1 rekaman batch beserta riwayat inspeksi & dispatch records.
// Parameter [id] dapat berupa CUID database maupun lotId (e.g. #B-2026-0730)
// -----------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const batch = await findBatchByIdOrLot(id);

    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          error: `Batch dengan ID atau Lot '${id}' tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: formatBatchRecord(batch),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data detail batch",
      },
      { status: 500 }
    );
  }
}
