import { NextRequest, NextResponse } from "next/server";
import { validateInternalApiKey, unauthorizedResponse } from "@/lib/auth";
import { sigapStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/inspection-result
 * Dipanggil oleh Edge Camera / Vision Inference Service (YOLOv8) setelah memproses frame optik.
 * Terproteksi header x-api-key: INTERNAL_API_KEY
 */
export async function POST(request: NextRequest) {
  // 1. Verifikasi API Key Internal
  const auth = validateInternalApiKey(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const {
      batchId,
      imageUrl,
      defectDetected,
      defectClass,
      confidence,
      severity,
      id,
    } = body;

    if (!batchId || !defectClass) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'batchId' dan 'defectClass' wajib disertakan.",
        },
        { status: 400 }
      );
    }

    const created = await sigapStore.createInspection({
      id,
      batchId,
      imageUrl,
      defectDetected,
      defectClass,
      confidence,
      severity,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Hasil inspeksi frame ${created.id} berhasil dicatat.`,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/internal/inspection-result Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal menyimpan hasil inspeksi internal",
      },
      { status: 500 }
    );
  }
}
