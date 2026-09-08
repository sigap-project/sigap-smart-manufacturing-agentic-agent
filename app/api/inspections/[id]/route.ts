import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper formatter untuk single record detail
function formatSingleInspectionDetail(item: any) {
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
    batch: item.batch,
    agentLogs: item.agentLogs || [],
  };
}

// -----------------------------------------------------------------------------
// GET /api/inspections/[id]
// Mengambil detail 1 rekaman inspeksi beserta seluruh entri AgentLog dan Batch
// -----------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            dispatchRecords: {
              orderBy: { dispatchedAt: "desc" },
            },
          },
        },
        agentLogs: {
          orderBy: { step: "asc" },
        },
      },
    });

    if (!inspection) {
      return NextResponse.json(
        {
          success: false,
          error: `Rekaman inspeksi dengan ID '${id}' tidak ditemukan.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: formatSingleInspectionDetail(inspection),
    });
  } catch (error) {
    console.error("Error fetching inspection detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Database error",
      },
      { status: 500 }
    );
  }
}
