import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET /api/dispatch
// Query Params: status, consumer, batchId, search, limit
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const consumer = searchParams.get("consumer") || undefined;
    const batchId = searchParams.get("batchId") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await sigapStore.getDispatches({
      status,
      consumer,
      batchId,
      search,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.data.length,
      source: result.source,
    });
  } catch (error) {
    console.error("[GET /api/dispatch Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil daftar dispatch",
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST /api/dispatch
// Membuat tiket dispatch manual oleh operator
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.batchId) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'batchId' wajib diisi.",
        },
        { status: 400 }
      );
    }

    const created = await sigapStore.createDispatch(body);

    return NextResponse.json(
      {
        success: true,
        message: `Tiket dispatch ${created.id} (${created.consumer}) berhasil diterbitkan.`,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/dispatch Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal membuat catatan dispatch",
      },
      { status: 500 }
    );
  }
}
