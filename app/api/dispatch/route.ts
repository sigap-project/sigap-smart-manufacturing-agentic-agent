import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INITIAL_DISPATCHES } from "@/components/dispatch/types";
import { formatDispatchRecord } from "./helper";
import { emitSigapEvent } from "@/lib/events";

// -----------------------------------------------------------------------------
// GET /api/dispatch
// Query Params:
//   - status: filter status dispatch (e.g. "Dispatched", "Pending Approval", "Rejected")
//   - consumer: filter sistem penerima (e.g. "SAP QM", "SAP MM", "SAP PP", "Human Notification")
//   - batchId: filter berdasarkan ID atau Lot ID batch
//   - search: cari id tiket, triggerReason, sapTicketId, atau produk
//   - limit: batasan jumlah record (default: 50)
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const consumerParam = searchParams.get("consumer");
    const batchIdParam = searchParams.get("batchId");
    const searchParam = searchParams.get("search");
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);

    const where: any = {};

    // Filter status
    if (statusParam && statusParam !== "all") {
      where.status = statusParam;
    }

    // Filter consumer
    if (consumerParam && consumerParam !== "all") {
      where.consumer = consumerParam;
    }

    // Filter batch
    if (batchIdParam && batchIdParam !== "all") {
      const cleanBatch = batchIdParam.trim();
      where.batch = {
        OR: [
          { id: cleanBatch },
          { lotId: cleanBatch },
          { lotId: cleanBatch.startsWith("#") ? cleanBatch : `#${cleanBatch}` },
        ],
      };
    }

    // Filter pencarian teks
    if (searchParam && searchParam.trim()) {
      const q = searchParam.trim();
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { triggerReason: { contains: q, mode: "insensitive" } },
        { sapTicketId: { contains: q, mode: "insensitive" } },
        { batch: { productType: { contains: q, mode: "insensitive" } } },
      ];
    }

    const dispatches = await prisma.dispatchRecord.findMany({
      where,
      include: {
        batch: true,
      },
      take: limitParam,
      orderBy: { dispatchedAt: "desc" },
    });

    if (dispatches.length === 0) {
      const totalCount = await prisma.dispatchRecord.count();
      if (totalCount === 0) {
        return NextResponse.json({
          data: INITIAL_DISPATCHES,
          total: INITIAL_DISPATCHES.length,
          source: "mock_fallback",
          message: "Database belum memiliki catatan dispatch. Menampilkan data awal.",
        });
      }
    }

    const formattedData = dispatches.map(formatDispatchRecord);

    return NextResponse.json({
      data: formattedData,
      total: formattedData.length,
      source: "database",
    });
  } catch (error) {
    console.warn("Koneksi DB dispatch offline, menggunakan fallback data lokal:", error);
    return NextResponse.json({
      data: INITIAL_DISPATCHES,
      total: INITIAL_DISPATCHES.length,
      source: "mock_fallback",
      error: error instanceof Error ? error.message : "Database connection error",
    });
  }
}

// -----------------------------------------------------------------------------
// POST /api/dispatch
// Membuat rekaman tiket dispatch baru secara manual oleh supervisor
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.triggerReason || !body.triggerReason.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'triggerReason' wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Resolusi parent batch
    const targetBatchId = body.batchId || "#B-2026-0730";
    const cleanBatchId = targetBatchId.trim();
    const withHash = cleanBatchId.startsWith("#") ? cleanBatchId : `#${cleanBatchId}`;

    let parentBatch = await prisma.batch.findFirst({
      where: {
        OR: [
          { id: cleanBatchId },
          { lotId: cleanBatchId },
          { lotId: withHash },
        ],
      },
    });

    // Jika batch tidak ditemukan, ambil batch pertama yang ada di database
    if (!parentBatch) {
      parentBatch = await prisma.batch.findFirst();
    }

    if (!parentBatch) {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak ditemukan data Batch di database untuk me-link tiket dispatch ini.",
        },
        { status: 400 }
      );
    }

    const consumer = body.consumer || "SAP QM";
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedTicketId =
      body.sapTicketId || `${consumer.replace(/\s+/g, "-")}-${randomNum}`;
    const generatedId =
      body.id || `DSP-2026-${Math.floor(420 + Math.random() * 580)}`;

    const newDispatch = await prisma.dispatchRecord.create({
      data: {
        id: generatedId,
        batchId: parentBatch.id,
        consumer,
        triggerReason: body.triggerReason.trim(),
        status: body.status || "Dispatched",
        approvedBy: body.approvedBy || "Budi Pratama (QC Supervisor)",
        dispatchedAt: new Date(),
        sapTicketId: generatedTicketId,
        defectCode: body.defectCode || "DEF-MANUAL-01",
        payload: {
          partName: body.partName || parentBatch.productType,
          supplier: body.supplier || parentBatch.supplierName,
          defectClass: body.defectClass || "Manual Supervisor Dispatch",
          actionSummary:
            body.actionSummary ||
            `Tiket diterbitkan secara manual ke modul ${consumer}.`,
          escalationScore: parentBatch.escalationScore ?? 0.76,
        },
        sapResponse: {
          status: "SUCCESS",
          code: 200,
          message: "Payload synced with SAP Integration Gateway.",
          timestamp: new Date().toISOString(),
        },
      },
      include: {
        batch: true,
      },
    });

    const formatted = formatDispatchRecord(newDispatch);

    // Broadcast tiket dispatch baru ke seluruh klien SSE
    emitSigapEvent("dispatch:status_changed", formatted);

    return NextResponse.json(
      {
        success: true,
        message: `Tiket dispatch ${newDispatch.id} berhasil dibuat.`,
        data: formatted,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal membuat catatan dispatch baru",
      },
      { status: 500 }
    );
  }
}
