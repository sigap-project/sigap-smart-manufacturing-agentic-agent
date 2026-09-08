import { NextRequest, NextResponse } from "next/server";
import { findDispatchById, formatDispatchRecord } from "../helper";

// -----------------------------------------------------------------------------
// GET /api/dispatch/[id]
// Mengambil rincian detail 1 catatan dispatch tiket ERP beserta data batch terkait
// -----------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const dispatch = await findDispatchById(id);

    if (!dispatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Tiket dispatch dengan ID '${id}' tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: formatDispatchRecord(dispatch),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data tiket dispatch",
      },
      { status: 500 }
    );
  }
}
