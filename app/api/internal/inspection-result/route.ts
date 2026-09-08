import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitSigapEvent } from "@/lib/events";
import { validateInternalApiKey, unauthorizedResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatInspectionRecord(item: any) {
  const dateObj = new Date(item.timestamp);
  const formattedDate =
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(dateObj) + " WIB";

  return {
    id: item.id,
    batchId: item.batchId,
    lotId: item.batch?.lotId || item.batchId,
    partName: item.batch?.productType || "Bracket Motor A7",
    supplier: item.batch?.supplierName || "PT Krakatau Scrap Ind.",
    line: item.batch?.line || "Line #01 (Conveyor Cam-01)",
    lotCount: item.batch?.inspectionCount || 500,
    timestamp: formattedDate,
    rawDate: dateObj.toISOString(),
    imageUrl: item.imageUrl || null,
    defectDetected: item.defectDetected,
    defectClass: item.defectClass,
    confidence: item.confidence,
    severity: item.severity || "None",
    status: item.status,
    agentReasoningTrace: item.agentReasoningTrace || [],
    reasoningSteps: item.agentReasoningTrace || [],
    dispatchId: item.batch?.dispatchRecords?.[0]?.id || null,
  };
}

/**
 * POST /api/internal/inspection-result
 * Dipanggil oleh Edge Camera / Vision Inference Service (YOLOv8) setelah memproses frame optik.
 *
 * Header:
 *   x-api-key: <INTERNAL_API_KEY>
 *
 * Payload:
 *   {
 *     "batchId": "#B-2026-0730",
 *     "imageUrl": "https://s3.../frame1428.jpg",
 *     "defectDetected": true,
 *     "defectClass": "warna_abnormal",
 *     "confidence": 94.2,
 *     "severity": "High"
 *   }
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

    // 2. Resolusi parent batch (mendukung CUID internal maupun lotId e.g. '#B-2026-0730')
    const cleanBatchId = String(batchId).trim();
    const withHash = cleanBatchId.startsWith("#") ? cleanBatchId : `#${cleanBatchId}`;
    const withoutHash = cleanBatchId.replace(/^#/, "");

    let targetBatch = await prisma.batch.findFirst({
      where: {
        OR: [
          { id: cleanBatchId },
          { lotId: cleanBatchId },
          { lotId: withHash },
          { lotId: withoutHash },
        ],
      },
    });

    // Jika batch belum ada, buatkan batch default baru
    if (!targetBatch) {
      targetBatch = await prisma.batch.create({
        data: {
          lotId: withHash,
          productType: "Bracket Motor A7",
          supplierName: "PT Krakatau Scrap Ind.",
          line: "Line #01 (Conveyor Cam-01)",
          status: "pending",
        },
      });
    }

    const isDefect = defectDetected ?? (defectClass !== "OK");
    const recordStatus = isDefect ? "Ditahan" : "Lolos QC";
    const recordSeverity = severity || (isDefect ? "High" : "None");
    const recordConfidence =
      typeof confidence === "number" ? confidence : 95.0;

    // 3. Simpan rekaman inspeksi & perbarui Batch dalam transaksi atomik
    const result = await prisma.$transaction(async (tx) => {
      const newInspection = await tx.inspection.create({
        data: {
          id: id || undefined,
          batchId: targetBatch.id,
          defectClass,
          confidence: recordConfidence,
          severity: recordSeverity,
          defectDetected: isDefect,
          status: recordStatus,
          imageUrl: imageUrl || null,
          agentReasoningTrace: [
            {
              step: "01",
              phase: "DETECT",
              title: "YOLOv8 Inference",
              detail: `Deteksi anomali '${defectClass}' dengan confidence ${recordConfidence.toFixed(1)}%.`,
              latency: "78ms",
            },
          ],
        },
        include: {
          batch: true,
        },
      });

      const updatedDefectCount = targetBatch.defectCount + (isDefect ? 1 : 0);
      const updatedTypes =
        isDefect && !targetBatch.defectTypes.includes(defectClass)
          ? [...targetBatch.defectTypes, defectClass]
          : targetBatch.defectTypes;

      await tx.batch.update({
        where: { id: targetBatch.id },
        data: {
          inspectionCount: { increment: 1 },
          defectCount: updatedDefectCount,
          defectTypes: updatedTypes,
          status: isDefect ? "held" : targetBatch.status,
          storageZone: isDefect ? "quarantine" : targetBatch.storageZone,
        },
      });

      return newInspection;
    });

    const formattedInspection = formatInspectionRecord(result);

    // 4. Picu Broadcast Server-Sent Events (SSE) secara instan ke UI
    emitSigapEvent("inspection:created", formattedInspection);
    emitSigapEvent("batch:status_changed", {
      id: targetBatch.id,
      lotId: targetBatch.lotId,
      status: isDefect ? "held" : targetBatch.status,
      storageZone: isDefect ? "quarantine" : targetBatch.storageZone,
      defectCount: targetBatch.defectCount + (isDefect ? 1 : 0),
      inspectionCount: targetBatch.inspectionCount + 1,
      defectTypes:
        isDefect && !targetBatch.defectTypes.includes(defectClass)
          ? [...targetBatch.defectTypes, defectClass]
          : targetBatch.defectTypes,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Hasil inspeksi frame ${formattedInspection.id} berhasil dicatat.`,
        data: formattedInspection,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in /api/internal/inspection-result:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan hasil inspeksi internal",
      },
      { status: 500 }
    );
  }
}
