export type BatchStatus = "pending" | "pending_review" | "held" | "released" | "rejected";
export type BatchZone = "all" | "standard" | "quarantine";

export interface BatchItem {
  id: string;
  lotId?: string;
  batchId?: string;
  productName: string;
  productType?: string;
  zone: "standard" | "quarantine";
  storageZone?: "standard" | "quarantine";
  status: BatchStatus;
  totalPcs: number;
  inspectionCount?: number;
  defectCount: number;
  defectTypes: string[];
  escalationScore?: number;
  timeAgo: string;
  createdAt?: string;
  slaSeconds?: number;
  defectSummary?: string;
  supplierName: string;
  line: string;
  inspector: string;
  pendingApproval?: boolean;
  /** Optimistic-concurrency token required by release/reject/review mutations. */
  version?: number;
  caseEpoch?: number;
  inspections?: any[];
  dispatchRecords?: any[];
}
