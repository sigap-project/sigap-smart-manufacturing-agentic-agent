/**
 * SIGAP Unified Formatters & Entity Mappers
 * Single source of truth untuk format tanggal WIB, relative time, dan normalisasi respons API.
 */

import { BatchItem } from "@/components/batches/types";
import { InspectionRecord } from "@/components/history/types";
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
  if (!date) return "Baru saja";
  const now = new Date();
  const past = new Date(date);
  const diffMs = Math.max(0, now.getTime() - past.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return "Baru saja";
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  return `${diffDays} hari lalu`;
}

// =============================================================================
// 2. INSPECTION RECORD FORMATTER
// =============================================================================

export function formatInspectionRecord(item: any): InspectionRecord & { [key: string]: any } {
  const dateObj = item.timestamp ? new Date(item.timestamp) : new Date();
  const formattedDate = formatTimestampWIB(dateObj);

  return {
    id: item.id,
    batchId: item.batchId || item.batch?.lotId || item.batch?.id || "#B-2026-0730",
    lotId: item.batch?.lotId || item.lotId || item.batchId || "#B-2026-0730",
    partName: item.batch?.productType || item.partName || "Bracket Motor A7",
    supplier: item.batch?.supplierName || item.supplier || "PT Krakatau Scrap Ind.",
    line: item.batch?.line || item.line || "Line #01 (Conveyor Cam-01)",
    lotCount: item.batch?.inspectionCount || item.lotCount || 500,
    timestamp: formattedDate,
    rawDate: dateObj.toISOString(),
    imageUrl: item.imageUrl || null,
    defectDetected: item.defectDetected ?? false,
    defectClass: item.defectClass || "OK",
    confidence: typeof item.confidence === "number" ? item.confidence : 95.0,
    severity: item.severity || "None",
    status: item.status || (item.defectDetected ? "Ditahan" : "Lolos QC"),
    agentReasoningTrace: Array.isArray(item.agentReasoningTrace) ? item.agentReasoningTrace : [],
    reasoningSteps: Array.isArray(item.agentReasoningTrace) ? item.agentReasoningTrace : [],
    dispatchId: item.batch?.dispatchRecords?.[0]?.id || item.dispatchId || null,
    batch: item.batch,
    agentLogs: item.agentLogs || [],
  };
}

// =============================================================================
// 3. BATCH RECORD FORMATTER
// =============================================================================

export function formatBatchRecord(item: any): BatchItem & { [key: string]: any } {
  const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();

  return {
    id: item.lotId || item.id, // '#B-2026-0730' (kompatibel langsung dengan UI BatchItem)
    batchId: item.id, // CUID internal database
    lotId: item.lotId || item.id,
    productName: item.productType || item.productName || "Bracket Motor A7",
    productType: item.productType || item.productName || "Bracket Motor A7",
    zone: (item.storageZone || "standard") as "standard" | "quarantine",
    storageZone: item.storageZone || "standard",
    status: item.status || "pending",
    totalPcs: item.inspectionCount || 0,
    inspectionCount: item.inspectionCount || 0,
    defectCount: item.defectCount || 0,
    defectTypes: Array.isArray(item.defectTypes) ? item.defectTypes : [],
    escalationScore: item.escalationScore ?? 0,
    timeAgo: formatTimeAgo(createdAt),
    createdAt: createdAt.toISOString(),
    slaSeconds: item.slaSeconds ?? (item.pendingApproval ? 780 : undefined),
    defectSummary: item.defectSummary || undefined,
    supplierName: item.supplierName || "PT Krakatau Scrap Ind.",
    line: item.line || "Line #01 (Conveyor Cam-01)",
    inspector: "Agent Vision Bedrock",
    pendingApproval: item.pendingApproval ?? false,
    inspections: item.inspections || [],
    dispatchRecords: item.dispatchRecords || [],
  };
}

// =============================================================================
// 4. DISPATCH RECORD FORMATTER
// =============================================================================

export function formatDispatchRecord(item: any): DispatchItem & { [key: string]: any } {
  const dateObj = item.dispatchedAt
    ? new Date(item.dispatchedAt)
    : item.timestamp
    ? new Date(item.timestamp)
    : new Date();
  const formattedDate = formatTimestampWIB(dateObj);

  return {
    id: item.id,
    consumer: item.consumer || "SAP QM",
    batchId: item.batch?.lotId || item.batchId || item.lotId || "#B-2026-0730",
    lotId: item.batch?.lotId || item.batchId || item.lotId || "#B-2026-0730",
    productName: item.batch?.productType || item.partName || item.productName || "Bracket Motor A7",
    partName: item.partName || item.batch?.productType || item.productName || "Bracket Motor A7",
    triggerReason: item.triggerReason || "Anomali terdeteksi",
    status: item.status || "Dispatched",
    sapTicketId: item.sapTicketId || `QM-${item.id?.slice(-5) || "00001"}`,
    defectCode: item.defectCode || "DEF-OXID-01",
    defectClass: item.defectClass || "Anomali Kualitas",
    actionSummary: item.actionSummary || item.triggerReason || "Notifikasi sistem ke modul ERP.",
    supplier: item.supplier || item.batch?.supplierName || "PT Krakatau Scrap Ind.",
    escalationScore: typeof item.escalationScore === "number" ? item.escalationScore : 0.74,
    approvedBy: item.approvedBy || "Autonomous Vision Agent",
    timestamp: formattedDate,
    dispatchedAt: formattedDate,
    rawDate: dateObj.toISOString(),
    payload: item.payload || {},
    sapResponse: item.sapResponse || null,
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

    autoExportCsv: setting.autoExportCsv ?? true,
    logRetention: String(setting.logRetentionDays ?? 30) as "7" | "14" | "30",
    updatedAt: setting.updatedAt ? new Date(setting.updatedAt).toISOString() : new Date().toISOString(),
  };
}
