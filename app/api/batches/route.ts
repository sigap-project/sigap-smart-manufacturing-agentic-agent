import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET /api/batches
// Query Params: status, zone, search, limit
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const zone = searchParams.get("zone") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await sigapStore.getBatches({ status, zone, search, limit });

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.data.length,
      source: result.source,
    });
  } catch (error) {
    console.error("[GET /api/batches Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil daftar batch",
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST /api/batches
// Membuat batch manufaktur baru
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.lotId || !body.productType) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'lotId' dan 'productType' wajib diisi.",
        },
        { status: 400 }
      );
    }

    const created = await sigapStore.createBatch(body);

    return NextResponse.json(
      {
        success: true,
        message: `Batch ${created.lotId} berhasil dibuat.`,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/batches Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal membuat batch baru",
      },
      { status: 500 }
    );
  }
}
