import { NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * Mengembalikan agregasi metrik operasional kualitas, defect rate, OEE, dan hitungan batch.
 * Sesuai kontrak REST API dokumen SIGAP-Master-Context.md Section 7.1.
 */
export async function GET() {
  try {
    const stats = await sigapStore.getDashboardStats();
    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/dashboard/stats Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil statistik dashboard",
      },
      { status: 500 }
    );
  }
}
