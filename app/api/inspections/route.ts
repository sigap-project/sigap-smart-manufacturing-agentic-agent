import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INITIAL_INSPECTIONS } from "@/components/history/types";
import { emitSigapEvent } from "@/lib/events";

// Helper formatter untuk menghasilkan response JSON yang cocok 100% dengan frontend UI
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
    reasoningSteps: item.agentReasoningTrace || [], // alias untuk komponen History
    dispatchId: item.batch?.dispatchRecords?.[0]?.id || null,
  };
}

// -----------------------------------------------------------------------------
// GET /api/inspections
// Query Params:
//   - batchId: filter berdasarkan ID atau lotId batch
//   - status: filter berdasarkan status inspeksi
//   - defectClass: filter berdasarkan kelas cacat
//   - limit: batasan jumlah record (default: 50)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchIdParam = searchParams.get("batchId");
    const statusParam = searchParams.get("status");
    const defectClassParam = searchParams.get("defectClass");
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    const where: any = {};

    if (batchIdParam) {
      where.OR = [
        { batchId: batchIdParam },
        { batch: { lotId: batchIdParam } },
      ];
    }

    if (statusParam && statusParam !== "all") {
      where.status = statusParam;
    }

    if (defectClassParam && defectClassParam !== "all") {
      where.defectClass = defectClassParam;
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: {
        batch: {
          include: {
            dispatchRecords: {
              take: 1,
              orderBy: { dispatchedAt: "desc" },
            },
          },
        },
      },
      take: isNaN(limitParam) ? 50 : limitParam,
      orderBy: { timestamp: "desc" },
    });

    if (inspections.length === 0 && !batchIdParam && !statusParam && !defectClassParam) {
      // Fallback jika database belum di-seed
      return NextResponse.json({
        data: INITIAL_INSPECTIONS.slice(0, limitParam || 50),
        total: INITIAL_INSPECTIONS.length,
        source: "mock_fallback",
      });
    }

    const formattedData = inspections.map(formatInspectionRecord);

    return NextResponse.json({
      data: formattedData,
      total: formattedData.length,
      source: "database",
    });
  } catch (error) {
    console.warn("Koneksi DB belum aktif, menggunakan fallback data lokal:", error);
    return NextResponse.json({
      data: INITIAL_INSPECTIONS,
      total: INITIAL_INSPECTIONS.length,
      source: "mock_fallback",
      error: error instanceof Error ? error.message : "Database error",
    });
  }
}

// -----------------------------------------------------------------------------
// POST /api/inspections
// Menerima payload dari edge camera / inference service YOLOv8
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      batchId,
      defectClass,
      confidence,
      severity,
      defectDetected,
      status,
      imageUrl,
      agentReasoningTrace,
      agentLogs,
    } = body;

    if (!batchId || !defectClass) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'batchId' dan 'defectClass' wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Resolusi batch ID: dukung baik ID internal maupun lotId (e.g. "#B-2026-0730")
    let targetBatch = await prisma.batch.findFirst({
      where: {
        OR: [{ id: batchId }, { lotId: batchId }],
      },
    });

    // Jika batch belum ada, gunakan batch pertama yang tersedia atau buatkan default
    if (!targetBatch) {
      targetBatch = await prisma.batch.findFirst();
      if (!targetBatch) {
        targetBatch = await prisma.batch.create({
          data: {
            lotId: batchId.startsWith("#") ? batchId : `#${batchId}`,
            productType: "Bracket Motor A7",
            status: "pending",
          },
        });
      }
    }

    const isDefect = defectDetected ?? (defectClass !== "OK");
    const recordStatus =
      status || (isDefect ? "Ditahan" : "Lolos QC");

    // Jalankan transaksi: simpan inspeksi + update counter pada parent Batch
    const result = await prisma.$transaction(async (tx) => {
      // 1. Simpan rekaman inspeksi
      const newInspection = await tx.inspection.create({
        data: {
          id: id || undefined,
          batchId: targetBatch.id,
          defectClass,
          confidence: typeof confidence === "number" ? confidence : 95.0,
          severity: severity || (isDefect ? "Medium" : "None"),
          defectDetected: isDefect,
          status: recordStatus,
          imageUrl: imageUrl || null,
          agentReasoningTrace: agentReasoningTrace || [
            {
              step: "01",
              phase: "DETECT",
              title: "YOLOv8 Inference",
              detail: `Deteksi kelas '${defectClass}' dengan confidence ${confidence || 95}%.`,
              latency: "78ms",
            },
          ],
        },
        include: {
          batch: true,
        },
      });

      // 2. Jika ada log detail per step, simpan ke AgentLog
      if (Array.isArray(agentLogs) && agentLogs.length > 0) {
        await tx.agentLog.createMany({
          data: agentLogs.map((log) => ({
            inspectionId: newInspection.id,
            step: log.step || "01",
            stepName: log.stepName || "DETECT",
            input: log.input || null,
            output: log.output || null,
            decision: log.decision || null,
            latencyMs: log.latencyMs || null,
          })),
        });
      }

      // 3. Update counter dan status pada parent batch
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

    // 1. Broadcast event inspeksi baru ke subscriber SSE
    emitSigapEvent("inspection:created", formattedInspection);

    // 2. Broadcast perubahan counter & status batch
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

    // 3. Broadcast jejak penalaran agen jika tersedia
    if (result.agentReasoningTrace && Array.isArray(result.agentReasoningTrace)) {
      emitSigapEvent("agent:log", {
        inspectionId: result.id,
        traces: result.agentReasoningTrace,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: formattedInspection,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating inspection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal membuat record inspeksi",
      },
      { status: 500 }
    );
  }
}
