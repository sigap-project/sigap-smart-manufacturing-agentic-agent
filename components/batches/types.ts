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
  inspections?: any[];
  dispatchRecords?: any[];
}

export const INITIAL_BATCHES: BatchItem[] = [
  {
    id: "#B-2026-0730",
    productName: "Bracket Motor A7",
    zone: "quarantine",
    status: "held",
    totalPcs: 500,
    defectCount: 14,
    defectTypes: ["defect"],
    escalationScore: 0.74,
    timeAgo: "6m ago",
    slaSeconds: 780, // 13m 00s
    defectSummary: "Recurring defect anomaly (94.2%) detected on 3 base mounting points.",
    supplierName: "PT Krakatau Scrap Ind.",
    line: "Line #01 (Conveyor Cam-01)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0731",
    productName: "Gearbox Housing C2",
    zone: "quarantine",
    status: "pending",
    totalPcs: 320,
    defectCount: 5,
    defectTypes: ["defect"],
    escalationScore: 0.62,
    timeAgo: "14m ago",
    slaSeconds: 420, // 7m 00s
    defectSummary: "Surface defect anomaly exceeding 1.2mm tolerance on seal flange area.",
    supplierName: "CV Logam Mandiri",
    line: "Line #02 (Conveyor Cam-02)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0732",
    productName: "Flange Pinion X1",
    zone: "standard",
    status: "pending",
    totalPcs: 800,
    defectCount: 3,
    defectTypes: ["defect"],
    escalationScore: 0.45,
    timeAgo: "22m ago",
    slaSeconds: 1140, // 19m 00s
    defectSummary: "Sporadic thread defect anomaly, awaiting operator visual confirmation.",
    supplierName: "PT Baja Presisi Prima",
    line: "Line #01 (Conveyor Cam-01)",
    inspector: "Budi Pratama (Supervisor)",
  },
  {
    id: "#B-2026-0728",
    productName: "Rotor Casing D4",
    zone: "standard",
    status: "released",
    totalPcs: 650,
    defectCount: 0,
    defectTypes: [],
    escalationScore: 0.08,
    timeAgo: "45m ago",
    supplierName: "PT Cipta Logam Nusantara",
    line: "Line #03 (Conveyor Cam-03)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0729",
    productName: "Piston Base Ring 55",
    zone: "standard",
    status: "released",
    totalPcs: 1200,
    defectCount: 1,
    defectTypes: ["defect"],
    escalationScore: 0.12,
    timeAgo: "1h ago",
    defectSummary: "Minor anomaly detected, within standard tolerance threshold.",
    supplierName: "PT Dharma Precision",
    line: "Line #01 (Conveyor Cam-01)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0727",
    productName: "Support Arm T-9",
    zone: "standard",
    status: "released",
    totalPcs: 450,
    defectCount: 0,
    defectTypes: [],
    escalationScore: 0.05,
    timeAgo: "1.5h ago",
    supplierName: "PT Cipta Logam Nusantara",
    line: "Line #02 (Conveyor Cam-02)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0726",
    productName: "Exhaust Manifold K3",
    zone: "quarantine",
    status: "held",
    totalPcs: 280,
    defectCount: 22,
    defectTypes: ["defect"],
    escalationScore: 0.88,
    timeAgo: "2h ago",
    slaSeconds: 180, // 3m 00s
    defectSummary: "Critical defect anomaly detected on inlet pipe weld joint.",
    supplierName: "PT Indometal Foundry",
    line: "Line #01 (Conveyor Cam-01)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0725",
    productName: "Shaft Coupling 40mm",
    zone: "standard",
    status: "rejected",
    totalPcs: 400,
    defectCount: 38,
    defectTypes: ["defect"],
    escalationScore: 0.95,
    timeAgo: "2.5h ago",
    defectSummary: "Fatal defect anomaly exceeding ISO specification tolerance limits.",
    supplierName: "CV Mega Teknik",
    line: "Line #02 (Conveyor Cam-02)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0724",
    productName: "Valve Body V-12",
    zone: "standard",
    status: "released",
    totalPcs: 520,
    defectCount: 0,
    defectTypes: [],
    escalationScore: 0.04,
    timeAgo: "3h ago",
    supplierName: "PT Baja Presisi Prima",
    line: "Line #01 (Conveyor Cam-01)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0723",
    productName: "Bearing Sleeve B8",
    zone: "standard",
    status: "rejected",
    totalPcs: 600,
    defectCount: 42,
    defectTypes: ["defect"],
    escalationScore: 0.91,
    timeAgo: "3.5h ago",
    defectSummary: "Critical defect anomaly exceeding threshold on bearing raceway.",
    supplierName: "PT Krakatau Scrap Ind.",
    line: "Line #03 (Conveyor Cam-03)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0722",
    productName: "Mounting Flange M10",
    zone: "standard",
    status: "released",
    totalPcs: 950,
    defectCount: 2,
    defectTypes: ["defect"],
    escalationScore: 0.15,
    timeAgo: "4h ago",
    defectSummary: "Minor surface flaw on flange lip, within acceptable tolerance.",
    supplierName: "CV Logam Mandiri",
    line: "Line #02 (Conveyor Cam-02)",
    inspector: "Agent Vision Bedrock",
  },
  {
    id: "#B-2026-0721",
    productName: "Camshaft Gear 18T",
    zone: "standard",
    status: "released",
    totalPcs: 700,
    defectCount: 0,
    defectTypes: [],
    escalationScore: 0.02,
    timeAgo: "4.5h ago",
    supplierName: "PT Dharma Precision",
    line: "Line #01 (Conveyor Cam-01)",
    inspector: "Agent Vision Bedrock",
  },
];
