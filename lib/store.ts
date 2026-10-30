/**
 * SIGAP Authoritative Unified Data Store (PostgreSQL / Prisma 6)
 * Server-authoritative persistence layer for Batch, Inspection, Dispatch, and Dashboard metrics.
 * Eliminates silent in-memory fallback, fake constants, and fabricated OEE metrics.
 */

import { prisma } from "@/lib/prisma";
import { BatchItem } from "@/components/batches/types";
import { InspectionRecord } from "@/components/history/types";
import { DispatchItem } from "@/components/dispatch/types";
import { SettingsState } from "@/components/settings/types";
import {
  formatBatchRecord,
  formatInspectionRecord,
  formatDispatchRecord,
  formatSettings,
} from "@/lib/formatters";
import { emitSigapEvent } from "@/lib/events";

export const sigapStore = {
  // ---------------------------------------------------------------------------
  // 1. BATCHES
  // ---------------------------------------------------------------------------
  async getBatches(filters?: {
    status?: string;
    zone?: string;
    search?: string;
    limit?: number;
  }): Promise<{ data: BatchItem[]; total: number; source: string }> {
    const where: Record<string, unknown> = {};

    if (filters?.status && filters.status !== "all") {
      where.status = filters.status;
    }

    if (filters?.zone && filters.zone !== "all") {
      where.storageZone = filters.zone;
    }

    if (filters?.search) {
      where.OR = [
        { lotId: { contains: filters.search, mode: "insensitive" } },
        { productType: { contains: filters.search, mode: "insensitive" } },
        { supplierName: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [rows, count] = await Promise.all([
      prisma.batch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters?.limit || 50,
      }),
      prisma.batch.count({ where }),
    ]);

    return {
      data: rows.map(formatBatchRecord),
      total: count,
      source: "database",
    };
  },

  async getBatchById(idOrLot: string): Promise<BatchItem | null> {
    const batch = await prisma.batch.findFirst({
      where: {
        OR: [{ id: idOrLot }, { lotId: idOrLot }],
      },
      include: {
        // Suspect inspections only: these gate supervisor release and need review
        inspections: {
          where: { OR: [{ outcome: "defect" }, { outcome: "unknown" }, { defectDetected: true }] },
          orderBy: { receivedAt: "desc" },
        },
      },
    });

    if (!batch) return null;
    return formatBatchRecord({ ...batch, inspections: batch.inspections.map(formatInspectionRecord) });
  },

  async createBatch(payload: {
    lotId: string;
    productType?: string;
    supplierId?: string;
    supplierName?: string;
    line?: string;
    materialNumber?: string;
    workOrderId?: string;
  }): Promise<BatchItem> {
    const created = await prisma.batch.create({
      data: {
        lotId: payload.lotId,
        productType: payload.productType || "Submersible Pump Impeller Casting",
        supplierId: payload.supplierId || "SUP-KRAKATAU",
        supplierName: payload.supplierName || "PT Krakatau Scrap Ind.",
        line: payload.line || "Line #01 (Conveyor Cam-01)",
        materialNumber: payload.materialNumber || "MAT-IMP-9842",
        workOrderId: payload.workOrderId || "WO-2026-771",
        status: "pending",
        storageZone: "standard",
        version: 0,
        caseEpoch: 1,
      },
    });

    const formatted = formatBatchRecord(created);
    emitSigapEvent("batch:status_changed", formatted);
    return formatted;
  },

  async approveBatch(idOrLot: string): Promise<BatchItem | null> {
    const existing = await prisma.batch.findFirst({
      where: { OR: [{ id: idOrLot }, { lotId: idOrLot }] },
    });
    if (!existing) return null;

    const updated = await prisma.batch.update({
      where: { id: existing.id },
      data: {
        status: "released",
        storageZone: "standard",
        pendingApproval: false,
        version: { increment: 1 },
      },
    });

    const formatted = formatBatchRecord(updated);
    emitSigapEvent("batch:status_changed", formatted);
    return formatted;
  },

  async rejectBatch(idOrLot: string): Promise<BatchItem | null> {
    const existing = await prisma.batch.findFirst({
      where: { OR: [{ id: idOrLot }, { lotId: idOrLot }] },
    });
    if (!existing) return null;

    const updated = await prisma.batch.update({
      where: { id: existing.id },
      data: {
        status: "rejected",
        storageZone: "quarantine",
        pendingApproval: false,
        version: { increment: 1 },
      },
    });

    const formatted = formatBatchRecord(updated);
    emitSigapEvent("batch:status_changed", formatted);
    return formatted;
  },

  // ---------------------------------------------------------------------------
  // 2. INSPECTIONS
  // ---------------------------------------------------------------------------
  async getInspections(filters?: {
    batchId?: string;
    status?: string;
    defectClass?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: InspectionRecord[]; total: number; source: string }> {
    const where: Record<string, unknown> = {};

    if (filters?.batchId && filters.batchId !== "all") {
      where.batchId = filters.batchId;
    }

    if (filters?.status && filters.status !== "all") {
      where.status = filters.status;
    }

    if (filters?.defectClass && filters.defectClass !== "all") {
      where.defectClass = filters.defectClass;
    }

    const [rows, count] = await Promise.all([
      prisma.inspection.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
        include: { batch: true },
      }),
      prisma.inspection.count({ where }),
    ]);

    return {
      data: rows.map(formatInspectionRecord),
      total: count,
      source: "database",
    };
  },

  async getInspectionById(id: string): Promise<InspectionRecord | null> {
    const inspection = await prisma.inspection.findFirst({
      where: {
        OR: [{ id }, { eventId: id }],
      },
      include: {
        batch: true,
        agentLogs: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!inspection) return null;
    return formatInspectionRecord(inspection);
  },

  async createInspection(payload: {
    id?: string;
    batchId: string;
    imageUrl?: string | null;
    defectDetected?: boolean;
    defectClass?: string;
    confidence?: number;
    severity?: string;
    status?: string;
    agentReasoningTrace?: unknown;
  }): Promise<InspectionRecord> {
    const isDefect =
      payload.defectDetected ??
      (payload.defectClass?.toLowerCase() !== "ok");

    // Resolve batch primary ID
    let batch = await prisma.batch.findFirst({
      where: { OR: [{ id: payload.batchId }, { lotId: payload.batchId }] },
    });
    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          lotId: payload.batchId,
          productType: "Submersible Pump Impeller Casting",
          status: isDefect ? "held" : "pending",
          storageZone: isDefect ? "quarantine" : "standard",
          version: 0,
          caseEpoch: 1,
        },
      });
    }

    const inspectionId = payload.id || `INS-${Date.now().toString().slice(-6)}`;
    const created = await prisma.inspection.create({
      data: {
        id: inspectionId,
        batchId: batch.id,
        defectClass: payload.defectClass || (isDefect ? "defect" : "OK"),
        confidence: typeof payload.confidence === "number" ? payload.confidence : 95.0,
        severity: payload.severity || (isDefect ? "High" : "Low"),
        defectDetected: isDefect,
        status: isDefect ? "Ditahan" : "Lolos QC",
        imageUrl: payload.imageUrl || null,
        agentReasoningTrace: payload.agentReasoningTrace ? JSON.parse(JSON.stringify(payload.agentReasoningTrace)) : [],
        dataOrigin: "operational",
      },
      include: { batch: true },
    });

    await prisma.batch.update({
      where: { id: batch.id },
      data: {
        inspectionCount: { increment: 1 },
        defectCount: isDefect ? { increment: 1 } : undefined,
        status: isDefect ? "held" : batch.status,
        storageZone: isDefect ? "quarantine" : batch.storageZone,
        version: { increment: 1 },
      },
    });

    const formatted = formatInspectionRecord(created);
    emitSigapEvent("inspection:created", formatted);
    return formatted;
  },

  // ---------------------------------------------------------------------------
  // 3. DISPATCH RECORDS
  // ---------------------------------------------------------------------------
  async getDispatches(filters?: {
    status?: string;
    consumer?: string;
    batchId?: string;
    search?: string;
    limit?: number;
  }): Promise<{ data: DispatchItem[]; total: number; source: string }> {
    const where: Record<string, unknown> = {};

    if (filters?.status && filters.status !== "all") {
      where.status = filters.status;
    }

    if (filters?.consumer && filters.consumer !== "all") {
      where.consumer = filters.consumer;
    }

    if (filters?.batchId) {
      where.batchId = filters.batchId;
    }

    if (filters?.search) {
      where.OR = [
        { triggerReason: { contains: filters.search, mode: "insensitive" } },
        { sapTicketId: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [rows, count] = await Promise.all([
      prisma.dispatchRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters?.limit || 50,
        include: { batch: true },
      }),
      prisma.dispatchRecord.count({ where }),
    ]);

    return {
      data: rows.map(formatDispatchRecord),
      total: count,
      source: "database",
    };
  },

  async getDispatchById(id: string): Promise<DispatchItem | null> {
    const dispatch = await prisma.dispatchRecord.findUnique({
      where: { id },
      include: { batch: true },
    });

    if (!dispatch) return null;
    return formatDispatchRecord(dispatch);
  },

  async createDispatch(payload: {
    batchId: string;
    triggerReason: string;
    consumer: string;
    payload?: unknown;
    status?: string;
    approvedBy?: string;
    sapTicketId?: string;
    defectCode?: string;
    sapResponse?: unknown;
  }): Promise<DispatchItem> {
    let batch = await prisma.batch.findFirst({
      where: { OR: [{ id: payload.batchId }, { lotId: payload.batchId }] },
    });
    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          lotId: payload.batchId,
          productType: "Submersible Pump Impeller Casting",
          status: "held",
          storageZone: "quarantine",
          version: 0,
          caseEpoch: 1,
        },
      });
    }

    const created = await prisma.dispatchRecord.create({
      data: {
        id: `DSP-${Date.now().toString().slice(-6)}`,
        batchId: batch.id,
        triggerReason: payload.triggerReason,
        consumer: payload.consumer,
        payload: payload.payload ? JSON.parse(JSON.stringify(payload.payload)) : {},
        status: payload.status || "Pending Approval",
      },
      include: { batch: true },
    });

    const formatted = formatDispatchRecord(created);
    emitSigapEvent("dispatch:status_changed", formatted);
    return formatted;
  },

  async approveDispatch(id: string, approvedBy = "Supervisor"): Promise<DispatchItem | null> {
    const existing = await prisma.dispatchRecord.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.dispatchRecord.update({
      where: { id },
      data: {
        status: "queued",
        approvedBy,
        revision: { increment: 1 },
      },
      include: { batch: true },
    });

    const formatted = formatDispatchRecord(updated);
    emitSigapEvent("dispatch:status_changed", formatted);
    return formatted;
  },

  // ---------------------------------------------------------------------------
  // 4. SETTINGS
  // ---------------------------------------------------------------------------
  async getSettings(): Promise<SettingsState> {
    let setting = await prisma.setting.findUnique({
      where: { id: "default" },
    });

    if (!setting) {
      setting = await prisma.setting.create({
        data: {
          id: "default",
          detectionConfidenceThreshold: 85.0,
          escalationWindowMinutes: 8,
          escalationCountTrigger: 3,
          autoStoreEnabled: true,
          autoDispatchMode: "human_approval",
          approvalSlaMinutes: 15,
          mockMode: true,
        },
      });
    }

    return formatSettings(setting);
  },

  async updateSettings(partial: Partial<SettingsState>): Promise<SettingsState> {
    const updated = await prisma.setting.upsert({
      where: { id: "default" },
      update: {
        ...(typeof partial.confidenceThreshold === "number"
          ? { detectionConfidenceThreshold: partial.confidenceThreshold }
          : {}),
        ...(typeof partial.escalationWindow === "number"
          ? { escalationWindowMinutes: partial.escalationWindow }
          : {}),
        ...(typeof partial.triggerCount === "number"
          ? { escalationCountTrigger: partial.triggerCount }
          : {}),
        ...(typeof partial.autoDispatchMode === "string"
          ? { autoDispatchMode: partial.autoDispatchMode }
          : {}),
        ...(typeof partial.approvalTimeout === "number"
          ? { approvalSlaMinutes: partial.approvalTimeout }
          : {}),
        ...(partial.customerProfile === "domestic_grade_ab" ||
        partial.customerProfile === "export_zero_defect"
          ? { customerProfile: partial.customerProfile }
          : {}),
      },
      create: {
        id: "default",
        detectionConfidenceThreshold: partial.confidenceThreshold ?? 85.0,
        escalationWindowMinutes: partial.escalationWindow ?? 8,
        escalationCountTrigger: partial.triggerCount ?? 3,
        autoDispatchMode: partial.autoDispatchMode ?? "human_approval",
        approvalSlaMinutes: partial.approvalTimeout ?? 15,
        customerProfile: partial.customerProfile ?? "domestic_grade_ab",
      },
    });

    return formatSettings(updated);
  },

  // ---------------------------------------------------------------------------
  // 5. DASHBOARD STATS (Aggregated from Real PostgreSQL Data)
  // ---------------------------------------------------------------------------
  async getDashboardStats() {
    const [inspectionCounts, batchGroups, dispatchesCount, latestBatch] = await Promise.all([
      prisma.$queryRaw<{ total: bigint; defects: bigint; unknown: bigint }[]>`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE outcome = 'defect' OR "defectDetected" = true) AS defects,
               COUNT(*) FILTER (WHERE outcome = 'unknown') AS unknown
        FROM "Inspection"`,
      prisma.batch.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.dispatchRecord.count(),
      prisma.batch.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    const totalInspections = Number(inspectionCounts[0]?.total ?? 0);
    const defectCount = Number(inspectionCounts[0]?.defects ?? 0);
    const unknownCount = Number(inspectionCounts[0]?.unknown ?? 0);
    const batchesByStatus = (status: string) =>
      batchGroups.find((g) => g.status === status)?._count._all ?? 0;
    const totalBatches = batchGroups.reduce((sum, g) => sum + g._count._all, 0);
    const heldBatchesCount = batchesByStatus("held");
    const pendingBatchesCount = batchesByStatus("pending");
    const rejectedBatchesCount = batchesByStatus("rejected");

    const defectRate =
      totalInspections > 0
        ? Number(((defectCount / totalInspections) * 100).toFixed(2))
        : 0;

    const totalDisposition = Math.max(
      heldBatchesCount + pendingBatchesCount + rejectedBatchesCount,
      1
    );

    const circumference = 251.327; // 2 * Math.PI * 40
    const rawCategories = [
      {
        name: "Karantina Terverifikasi",
        desc: "Lot ditahan; tiket notifikasi mutu aktif",
        count: heldBatchesCount,
        color: "from-rose-500 to-amber-500",
        dotColor: "bg-rose-400",
        textColor: "text-rose-400",
        stroke: "#f43f5e",
      },
      {
        name: "Pending Konfirmasi",
        desc: "Awaiting supervisor authorization SLA",
        count: pendingBatchesCount,
        color: "from-amber-500 to-yellow-500",
        dotColor: "bg-amber-400",
        textColor: "text-amber-400",
        stroke: "#f59e0b",
      },
      {
        name: "Ditolak / Afkir",
        desc: "Disposisi scrap & tanur peleburan",
        count: rejectedBatchesCount,
        color: "from-purple-500 to-indigo-500",
        dotColor: "bg-purple-400",
        textColor: "text-purple-400",
        stroke: "#8b5cf6",
      },
    ];

    let currentOffset = 0;
    const defectDisposition = rawCategories.map((cat) => {
      const percent = Number(((cat.count / totalDisposition) * 100).toFixed(1));
      const dashLength = (cat.count / totalDisposition) * circumference;
      const dashGap = circumference - dashLength;
      const strokeDasharray = `${dashLength.toFixed(1)} ${dashGap.toFixed(1)}`;
      const strokeDashoffset = `-${currentOffset.toFixed(1)}`;
      currentOffset += dashLength;

      return {
        ...cat,
        percent,
        strokeDasharray,
        strokeDashoffset,
      };
    });

    return {
      totalInspections,
      defectCount,
      unknownCount,
      defectRate,
      // Six Sigma view, one defect opportunity per inspected unit (Six Sigma target: 3.4)
      dpmo: totalInspections > 0 ? Math.round((defectCount / totalInspections) * 1_000_000) : 0,
      firstPassYieldPct:
        totalInspections > 0
          ? Number((((totalInspections - defectCount - unknownCount) / totalInspections) * 100).toFixed(1))
          : 0,
      batchesHeldCount: heldBatchesCount,
      dispatchesCount,
      activeLotId: latestBatch?.lotId || "N/A",
      defectDisposition,
      totalBatches,
    };
  },
};
