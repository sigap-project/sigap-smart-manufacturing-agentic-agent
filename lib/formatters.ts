/**
 * SIGAP Unified Formatters & Entity Mappers
 * Single source of truth untuk format tanggal WIB, relative time, dan normalisasi respons API.
 */

import { BatchItem } from "@/components/batches/types";
import { InspectionRecord, InspectionStatus } from "@/components/history/types";
import { DispatchItem } from "@/components/dispatch/types";
import { DEFAULT_SETTINGS, SettingsState } from "@/components/settings/types";

// =============================================================================
// 1. DATE & TIME FORMATTERS
// =============================================================================

export function formatTimestampWIB(date: Date | string | null | undefined): string {
  const d = date ? new Date(date) : new Date();
  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(d) + " WIB"
  );
}

export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Just now";
  const now = new Date();
  const past = new Date(date);
  const diffMs = Math.max(0, now.getTime() - past.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// =============================================================================
// 2. INSPECTION RECORD FORMATTER
// =============================================================================

export function formatInspectionRecord(raw: unknown): InspectionRecord {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const batch = (item.batch && typeof item.batch === "object" ? item.batch : {}) as Record<string, unknown>;
  const dateObj = item.timestamp
    ? new Date(item.timestamp as string | number | Date)
    : item.capturedAt
    ? new Date(item.capturedAt as string | number | Date)
    : new Date();
  const formattedDate = formatTimestampWIB(dateObj);
  const id = String(item.id || item.inspectionId || `INS-${Date.now()}`);
  const imageUrl = item.imageKey || item.id
    ? `/api/inspections/${encodeURIComponent(id)}/image`
    : typeof item.imageUrl === "string" ? item.imageUrl : null;

  return {
    id,
    inspectionId: id,
    eventId: typeof item.eventId === "string" ? item.eventId : null,
    batchId: String(item.batchId || batch.lotId || batch.id || "#B-2026-0730"),
    lotId: String(batch.lotId || item.lotId || item.batchId || "#B-2026-0730"),
    itemId: typeof item.itemId === "string" ? item.itemId : null,
    deviceId: typeof item.deviceId === "string" ? item.deviceId : null,
    bindingVersion: typeof item.bindingVersion === "number" ? item.bindingVersion : 1,
    caseEpoch: typeof item.caseEpoch === "number" ? item.caseEpoch : 1,
    partName: String(batch.productType || item.partName || "Bracket Motor A7"),
    supplier: String(batch.supplierName || item.supplier || "PT Krakatau Scrap Ind."),
    line: String(batch.line || item.line || "Line #01 (Conveyor Cam-01)"),
    lotCount: typeof batch.inspectionCount === "number" ? batch.inspectionCount : (typeof item.lotCount === "number" ? item.lotCount : 0),
    timestamp: formattedDate,
    rawDate: dateObj.toISOString(),
    capturedAt: item.capturedAt ? new Date(item.capturedAt as string | number | Date).toISOString() : dateObj.toISOString(),
    receivedAt: item.receivedAt ? new Date(item.receivedAt as string | number | Date).toISOString() : dateObj.toISOString(),
    outcome: (item.outcome as "ok" | "defect" | "unknown") || (item.defectDetected ? "defect" : "ok"),
    probabilities: (item.probabilities as { ok: number; defect: number } | null) || null,
    confidence: typeof item.confidence === "number" ? item.confidence : null,
    inferenceMs: typeof item.inferenceMs === "number" ? item.inferenceMs : null,
    classificationMs: typeof item.classificationMs === "number" ? item.classificationMs : null,
    localizationMs: typeof item.localizationMs === "number" ? item.localizationMs : null,
    localizationStatus: (item.localizationStatus as "completed" | "skipped" | "failed" | null) || null,
    localAlertMs: typeof item.localAlertMs === "number" ? item.localAlertMs : null,
    imageUrl,
    imageWidth: typeof item.imageWidth === "number" ? item.imageWidth : 640,
    imageHeight: typeof item.imageHeight === "number" ? item.imageHeight : 480,
    imageSha256: typeof item.imageSha256 === "string" ? item.imageSha256 : null,
    coordinateSpace: typeof item.coordinateSpace === "string" ? item.coordinateSpace : "source-percent",
    boundingBoxes: Array.isArray(item.boundingBoxes) ? (item.boundingBoxes as any) : [],
    defectDetected: typeof item.defectDetected === "boolean" ? item.defectDetected : item.outcome === "defect",
    defectClass: String(item.defectClass || (item.outcome === "defect" ? "defect" : "OK")),
    severity: String(item.severity || (item.outcome === "defect" ? "High" : "None")),
    status: (item.status as InspectionStatus) || (item.outcome === "defect" ? "Ditahan" : item.outcome === "unknown" ? "Pending Review" : "Lolos QC"),
    reviewOutcome: (item.reviewOutcome as "confirmed_ok" | "confirmed_defect" | "unresolved" | null) || null,
    reviewReason: typeof item.reviewReason === "string" ? item.reviewReason : null,
    reviewedAt: item.reviewedAt ? new Date(item.reviewedAt as string | number | Date).toISOString() : null,
    reviewedBy: typeof item.reviewedBy === "string" ? item.reviewedBy : null,
    payloadHash: typeof item.payloadHash === "string" ? item.payloadHash : null,
    evidenceStore: (item.evidenceStore as "local" | "s3" | null) || null,
    agentReasoningTrace: Array.isArray(item.agentReasoningTrace) ? item.agentReasoningTrace : [],
    reasoningSteps: Array.isArray(item.reasoningSteps) ? (item.reasoningSteps as any) : [],
    dispatchId: (batch.dispatchRecords as Array<{ id: string }>)?.[0]?.id || (typeof item.dispatchId === "string" ? item.dispatchId : null),
    agentLogs: Array.isArray(item.agentLogs) ? item.agentLogs : [],
  };
}

// =============================================================================
// 3. BATCH RECORD FORMATTER
// =============================================================================

export function normalizeBatchStatus(status?: string): "pending" | "held" | "released" | "rejected" {
  if (!status) return "pending";
  const s = status.toLowerCase().trim();
  if (s === "pending" || s === "pending_review" || s.includes("pending") || s === "review" || s === "draft") {
    return "pending";
  }
  if (s === "held" || s === "hold" || s.includes("tahan") || s.includes("quarantine")) {
    return "held";
  }
  if (s === "released" || s === "approved" || s.includes("lolos") || s.includes("pass")) {
    return "released";
  }
  if (s === "rejected" || s === "ditolak" || s.includes("scrap") || s.includes("reject")) {
    return "rejected";
  }
  return "pending";
}

export function formatBatchRecord(raw: unknown): BatchItem {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const createdAt = item.createdAt ? new Date(item.createdAt as string | number | Date) : new Date();

  return {
    id: String(item.lotId || item.id || "#B-2026-0730"),
    batchId: String(item.id || item.lotId || "#B-2026-0730"),
    lotId: String(item.lotId || item.id || "#B-2026-0730"),
    productName: String(item.productType || item.productName || "Bracket Motor A7"),
    productType: String(item.productType || item.productName || "Bracket Motor A7"),
    zone: (item.storageZone === "quarantine" ? "quarantine" : "standard") as "standard" | "quarantine",
    storageZone: (item.storageZone === "quarantine" ? "quarantine" : "standard") as "standard" | "quarantine",
    status: normalizeBatchStatus(typeof item.status === "string" ? item.status : undefined),
    totalPcs: typeof item.inspectionCount === "number" ? item.inspectionCount : 0,
    inspectionCount: typeof item.inspectionCount === "number" ? item.inspectionCount : 0,
    defectCount: typeof item.defectCount === "number" ? item.defectCount : 0,
    defectTypes: Array.isArray(item.defectTypes) ? (item.defectTypes as string[]) : [],
    escalationScore: typeof item.escalationScore === "number" ? item.escalationScore : 0,
    timeAgo: formatTimeAgo(createdAt),
    createdAt: createdAt.toISOString(),
    slaSeconds: typeof item.slaSeconds === "number" ? item.slaSeconds : undefined,
    defectSummary: typeof item.defectSummary === "string" ? item.defectSummary : undefined,
    supplierName: String(item.supplierName || "—"),
    line: String(item.line || "—"),
    inspector: "SIGAP governed agent",
    pendingApproval: Boolean(item.pendingApproval),
    version: typeof item.version === "number" ? item.version : 0,
    caseEpoch: typeof item.caseEpoch === "number" ? item.caseEpoch : 1,
    inspections: Array.isArray(item.inspections) ? (item.inspections as any) : [],
    dispatchRecords: Array.isArray(item.dispatchRecords) ? (item.dispatchRecords as any) : [],
  };
}

// =============================================================================
// 4. DISPATCH RECORD FORMATTER
// =============================================================================

export function formatDispatchRecord(item: any): DispatchItem {
  const dateObj = item.dispatchedAt
    ? new Date(item.dispatchedAt)
    : item.timestamp
    ? new Date(item.timestamp)
    : new Date();
  const formattedDate = formatTimestampWIB(dateObj);

  // DB lifecycle status -> the three display states the dispatch UI understands
  const raw = String(item.status || "").toLowerCase();
  const status: DispatchItem["status"] =
    raw === "pending_approval" || raw === "proposed" || raw === "pending approval"
      ? "Pending Approval"
      : raw === "rejected" || raw === "failed"
      ? "Rejected"
      : "Dispatched";

  return {
    id: item.id,
    consumer: item.consumer || "SAP QM",
    batchId: item.batch?.lotId || item.batchId || item.lotId || "—",

    partName: item.partName || item.batch?.productType || item.productName || "—",
    triggerReason: item.triggerReason || "—",
    status,
    sapTicketId: item.sapTicketId || "—",
    defectCode: item.defectCode || item.actionType || "—",
    defectClass: item.defectClass || item.actionType || "—",
    actionSummary: item.actionSummary || item.actionType || item.triggerReason || "—",
    supplier: item.supplier || item.batch?.supplierName || "—",
    escalationScore: typeof item.escalationScore === "number" ? item.escalationScore : 0,
    approvedBy: item.approvedBy || (status === "Pending Approval" ? "Awaiting supervisor" : "—"),
    timestamp: formattedDate,

    rawDate: dateObj.toISOString(),

  };
}

// =============================================================================
// 5. SETTINGS RECORD FORMATTER
// =============================================================================

export function formatSettings(setting: any): SettingsState & { id: string; updatedAt: string } {
  return {
    id: setting.id || "default",
    simulationMode: setting.mockMode ?? true,
    cameraSource: (setting.cameraSource as "mock" | "rtsp") || "mock",
    rtspUrl: setting.rtspUrl || "rtsp://192.168.1.120:8554/live/station-01",
    hardwareStatus: "connected",

    confidenceThreshold: Math.round(setting.detectionConfidenceThreshold ?? 85),
    escalationWindow: setting.escalationWindowMinutes ?? 8,
    triggerCount: setting.escalationCountTrigger ?? 3,

    monitoredProducts:
      Array.isArray(setting.monitoredProducts) && setting.monitoredProducts.length > 0
        ? setting.monitoredProducts
        : DEFAULT_SETTINGS.monitoredProducts,

    autoSaveBatchBoard: setting.autoStoreEnabled ?? true,
    autoDispatchMode:
      (setting.autoDispatchMode as "autonomous" | "human_approval") || "autonomous",
    approvalTimeout: setting.approvalSlaMinutes ?? 15,
    customerProfile:
      setting.customerProfile === "export_zero_defect" ? "export_zero_defect" : "domestic_grade_ab",

    autoExportCsv: setting.autoExportCsv ?? true,
    logRetention: String(setting.logRetentionDays ?? 30) as "7" | "14" | "30",
    updatedAt: setting.updatedAt ? new Date(setting.updatedAt).toISOString() : new Date().toISOString(),
  };
}
