import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// PATCH /api/batches/[id]/approve
// Mengesahkan batch karantina menjadi status 'released' (Human-in-the-Loop)
// -----------------------------------------------------------------------------
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await sigapStore.approveBatch(id);

    return NextResponse.json({
      success: true,
      message: `Batch ${updated.lotId || updated.id} berhasil DISETUJUI & DILEPASKAN untuk perakitan.`,
      data: updated,
    });
  } catch (error) {
    console.error("[PATCH /api/batches/[id]/approve Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memproses persetujuan batch",
      },
      { status: 500 }
    );
  }
}
