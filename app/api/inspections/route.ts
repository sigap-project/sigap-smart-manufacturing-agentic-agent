import { NextRequest, NextResponse } from "next/server";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET /api/inspections
// Query Params: batchId, status, defectClass, limit
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId") || undefined;
    const status = searchParams.get("status") || undefined;
    const defectClass = searchParams.get("defectClass") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await sigapStore.getInspections({ batchId, status, defectClass, limit });

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.data.length,
      source: result.source,
    });
  } catch (error) {
    console.error("[GET /api/inspections Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal mengambil daftar inspeksi",
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST /api/inspections
// Menerima payload frame inspeksi dari edge camera / vision inference
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.batchId || !body.defectClass) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'batchId' dan 'defectClass' wajib diisi.",
        },
        { status: 400 }
      );
    }

    const created = await sigapStore.createInspection(body);

    return NextResponse.json(
      {
        success: true,
        message: `Inspeksi ${created.id} berhasil dicatat.`,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/inspections Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal menyimpan rekaman inspeksi",
      },
      { status: 500 }
    );
  }
}
