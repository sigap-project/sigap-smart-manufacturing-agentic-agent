import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET /api/inspections/[id]
// Mengambil rincian detail 1 rekaman inspeksi beserta jejak penalaran agen
// -----------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const inspection = await sigapStore.getInspectionById(id);

    if (!inspection) {
      return NextResponse.json(
        {
          success: false,
          error: `Rekaman inspeksi dengan ID '${id}' tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    console.error("[GET /api/inspections/[id] Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil detail inspeksi",
      },
      { status: 500 }
    );
  }
}
