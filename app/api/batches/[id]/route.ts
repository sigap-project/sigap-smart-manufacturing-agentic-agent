import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET /api/batches/[id]
// Mengambil rincian detail 1 batch berdasarkan CUID database maupun lotId (#B-2026-0730)
// -----------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = await sigapStore.getBatchById(id);

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
      data: batch,
    });
  } catch (error) {
    console.error("[GET /api/batches/[id] Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil data detail batch",
      },
      { status: 500 }
    );
  }
}
