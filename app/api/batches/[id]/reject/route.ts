import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// PATCH /api/batches/[id]/reject
// Menolak batch menjadi status 'rejected' dan mengisolasi ke Zona Karantina
// -----------------------------------------------------------------------------
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await sigapStore.rejectBatch(id);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Batch tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Batch ${updated.lotId || updated.id} DITOLAK dan dialihkan ke Zona Karantina.`,
      data: updated,
    });
  } catch (error) {
    console.error("[PATCH /api/batches/[id]/reject Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memproses penolakan batch",
      },
      { status: 500 }
    );
  }
}
