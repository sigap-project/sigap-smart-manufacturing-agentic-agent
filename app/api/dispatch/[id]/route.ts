import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET /api/dispatch/[id]
// Mengambil rincian detail 1 tiket dispatch ERP
// -----------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dispatch = await sigapStore.getDispatchById(id);

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
      data: dispatch,
    });
  } catch (error) {
    console.error("[GET /api/dispatch/[id] Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil rincian tiket dispatch",
      },
      { status: 500 }
    );
  }
}
