import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET /api/settings
// Mengambil konfigurasi aktif sistem
// -----------------------------------------------------------------------------
export async function GET() {
  try {
    const settings = await sigapStore.getSettings();
    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("[GET /api/settings Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil pengaturan sistem",
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// PUT /api/settings
// Memperbarui konfigurasi sistem
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = await sigapStore.updateSettings(body);

    return NextResponse.json({
      success: true,
      message: "Pengaturan sistem berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    console.error("[PUT /api/settings Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memperbarui pengaturan sistem",
      },
      { status: 500 }
    );
  }
}
