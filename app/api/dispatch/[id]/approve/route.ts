import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// PATCH /api/dispatch/[id]/approve
// Menyetujui tiket dispatch yang berstatus Pending Approval menjadi Dispatched
// -----------------------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let approvedBy = "Budi Pratama (QC Supervisor)";
    try {
      const body = await request.json();
      if (body && body.approvedBy) {
        approvedBy = body.approvedBy;
      }
    } catch {
      // Body opsional jika hanya panggilan PATCH kosong
    }

    const updated = await sigapStore.approveDispatch(id, approvedBy);

    if (!updated) {
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
      message: `Tiket ${updated.id} (${updated.consumer}) disetujui & berstatus Dispatched.`,
      data: updated,
    });
  } catch (error) {
    console.error("[PATCH /api/dispatch/[id]/approve Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal menyetujui tiket dispatch",
      },
      { status: 500 }
    );
  }
}
