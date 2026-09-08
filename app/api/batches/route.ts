import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INITIAL_BATCHES } from "@/components/batches/types";
import { formatBatchRecord } from "./helper";
import { emitSigapEvent } from "@/lib/events";

// -----------------------------------------------------------------------------
// GET /api/batches
// Query Params:
//   - status: filter status batch (e.g. "pending", "held", "released", "rejected")
//   - zone: filter zona penyimpanan (e.g. "standard", "quarantine")
//   - search: cari lotId, productType, atau supplierName
//   - limit: batasan jumlah record (default: 50)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const zoneParam = searchParams.get("zone");
    const searchParam = searchParams.get("search");
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    const where: any = {};

    // Filter status
    if (statusParam && statusParam !== "all") {
      where.status = statusParam;
    }

    // Filter zona penyimpanan
    if (zoneParam && zoneParam !== "all") {
      where.storageZone = zoneParam;
    }

    // Filter pencarian teks
    if (searchParam && searchParam.trim()) {
      const q = searchParam.trim();
      where.OR = [
        { lotId: { contains: q, mode: "insensitive" } },
        { productType: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
      ];
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        inspections: {
          take: 5,
          orderBy: { timestamp: "desc" },
        },
        dispatchRecords: {
          take: 3,
          orderBy: { dispatchedAt: "desc" },
        },
      },
      take: limitParam,
      orderBy: { createdAt: "desc" },
    });

    if (batches.length === 0) {
      // Jika database belum memiliki batch atau query menghasilkan 0 hasil,
      // periksa apakah tabel benar-benar kosong untuk fallback initial data
      const totalCount = await prisma.batch.count();
      if (totalCount === 0) {
        return NextResponse.json({
          data: INITIAL_BATCHES,
          total: INITIAL_BATCHES.length,
          source: "mock_fallback",
          message: "Database belum di-seed. Menampilkan data awal.",
        });
      }
    }

    const formattedData = batches.map(formatBatchRecord);

    return NextResponse.json({
      data: formattedData,
      total: formattedData.length,
      source: "database",
    });
  } catch (error) {
    console.warn("Koneksi DB belum aktif, menggunakan fallback data lokal:", error);
    return NextResponse.json({
      data: INITIAL_BATCHES,
      total: INITIAL_BATCHES.length,
      source: "mock_fallback",
      error: error instanceof Error ? error.message : "Database connection error",
    });
  }
}

// -----------------------------------------------------------------------------
// POST /api/batches
// Membuat batch manufaktur baru di database PostgreSQL
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

    // Pastikan lotId memiliki format konsisten (awalan #)
    const formattedLotId = body.lotId.startsWith("#") ? body.lotId : `#${body.lotId}`;

    const newBatch = await prisma.batch.create({
      data: {
        lotId: formattedLotId,
        productType: body.productType,
        supplierName: body.supplierName || "PT Krakatau Scrap Ind.",
        line: body.line || "Line #01 (Conveyor Cam-01)",
        inspectionCount: body.inspectionCount || 0,
        defectCount: body.defectCount || 0,
        defectTypes: Array.isArray(body.defectTypes) ? body.defectTypes : [],
        escalationScore: body.escalationScore ?? 0.0,
        status: body.status || "pending",
        storageZone: body.storageZone || "standard",
        pendingApproval: body.pendingApproval ?? false,
        slaSeconds: body.slaSeconds ?? (body.pendingApproval ? 900 : null),
        defectSummary: body.defectSummary || null,
      },
      include: {
        inspections: true,
        dispatchRecords: true,
      },
    });

    const formatted = formatBatchRecord(newBatch);

    // Broadcast batch baru ke seluruh klien SSE
    emitSigapEvent("batch:status_changed", formatted);

    return NextResponse.json(
      {
        success: true,
        message: `Batch ${newBatch.lotId} berhasil dibuat.`,
        data: formatted,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal membuat batch baru",
      },
      { status: 500 }
    );
  }
}
