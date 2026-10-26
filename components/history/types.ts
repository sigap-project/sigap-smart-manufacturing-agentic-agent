export type DefectClass =
  | "defect"
  | "OK"
  | "ok"
  | "def_front"
  | "ok_front"
  | string;

export type InspectionStatus =
  | "Lolos QC"
  | "Ditahan"
  | "Pending Review"
  | "Ditolak"
  | "Passed"
  | "Held"
  | "Rejected";

export interface ReasoningStep {
  step: string;
  phase: string;
  title: string;
  detail: string;
  latency?: string;
}

export interface InspectionRecord {
  id: string;
  defectClass: DefectClass;
  confidence: number;
  batchId: string;
  partName: string;
  timestamp: string;
  rawDate: string; // ISO date for filtering & sorting
  status: InspectionStatus;
  reasoningSteps: ReasoningStep[];
  dispatchId?: string;
  lotCount: number;
  supplier: string;
  line: string;
  imageUrl?: string;
}

export const INITIAL_INSPECTIONS: InspectionRecord[] = [
  {
    id: "INS-2026-8842",
    defectClass: "defect",
    confidence: 94.2,
    batchId: "BATCH-2026-0730-008",
    partName: "Bracket Motor A7",
    timestamp: "08 Sep 2026, 14:32:10 WIB",
    rawDate: "2026-09-08T14:32:10",
    status: "Held",
    dispatchId: "DSP-2026-0419",
    lotCount: 500,
    supplier: "PT Krakatau Scrap Ind.",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Casting crack defect anomaly detected at coordinates X:524 Y:312 with 94.2% confidence.",
        latency: "78ms",
      },
      {
        step: "02",
        phase: "MEMORY",
        title: "Bedrock Temporal Memory",
        detail: "Found 3 similar defect anomalies in the last 8 minutes associated with supplier PT Krakatau Scrap.",
        latency: "124ms",
      },
      {
        step: "03",
        phase: "FORMULA",
        title: "Formula Engine Escalation",
        detail: "Calculation: (Frequency: 3 × 0.40) + (Severity: 0.85 × 0.35) + (Vendor: 0.60 × 0.25) = Score 0.74.",
        latency: "12ms",
      },
      {
        step: "04",
        phase: "DECISION",
        title: "Autonomous Decision",
        detail: "Score 0.74 exceeds threshold 0.70 (Level 3 Pattern Confirmed). Recommendation: Quarantine lot.",
        latency: "45ms",
      },
      {
        step: "05",
        phase: "DISPATCH",
        title: "SAP QM Integration",
        detail: "Quality notification ticket auto-dispatched to SAP QM (QM-NOTIF-98214) and lot locked in quarantine.",
        latency: "180ms",
      },
    ],
  },
  {
    id: "INS-2026-8841",
    defectClass: "OK",
    confidence: 99.1,
    batchId: "BATCH-2026-0730-007",
    partName: "Bracket Motor A7",
    timestamp: "08 Sep 2026, 14:31:55 WIB",
    rawDate: "2026-09-08T14:31:55",
    status: "Passed",
    lotCount: 500,
    supplier: "PT Krakatau Scrap Ind.",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "No visual defects detected. Surface finish and geometry are compliant with baseline CAD specs.",
        latency: "76ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Auto-Release Approved",
        detail: "Confidence 99.1% (Anomaly Score: 0.02). Unit cleared for downstream assembly station.",
        latency: "15ms",
      },
    ],
  },
  {
    id: "INS-2026-8840",
    defectClass: "defect",
    confidence: 88.5,
    batchId: "BATCH-2026-0731-002",
    partName: "Gearbox Housing C2",
    timestamp: "08 Sep 2026, 14:14:22 WIB",
    rawDate: "2026-09-08T14:14:22",
    status: "Pending Review",
    dispatchId: "DSP-2026-0417",
    lotCount: 320,
    supplier: "CV Logam Mandiri",
    line: "Station #02 (Conveyor Cam-02)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Surface defect anomaly detected on sealing surface flange area.",
        latency: "82ms",
      },
      {
        step: "02",
        phase: "FORMULA",
        title: "Formula Engine Escalation",
        detail: "Escalation score calculated at 0.62 (Category: Elevated / Requires Supervisor Confirmation).",
        latency: "14ms",
      },
      {
        step: "03",
        phase: "DECISION",
        title: "Human-in-the-Loop Triggered",
        detail: "Review ticket routed to Shift Supervisor HUD with a 10-minute SLA timeout.",
        latency: "28ms",
      },
    ],
  },
  {
    id: "INS-2026-8839",
    defectClass: "defect",
    confidence: 96.8,
    batchId: "BATCH-2026-0726-004",
    partName: "Exhaust Manifold K3",
    timestamp: "08 Sep 2026, 12:45:08 WIB",
    rawDate: "2026-09-08T12:45:08",
    status: "Held",
    dispatchId: "DSP-2026-0415",
    lotCount: 280,
    supplier: "PT Indometal Foundry",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Structural weld seam breach defect detected along inlet pipe joint.",
        latency: "79ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Critical Safety Stop",
        detail: "Critical safety defect. Formula score 0.88 triggered an immediate quarantine hold on the entire manifold lot.",
        latency: "32ms",
      },
    ],
  },
  {
    id: "INS-2026-8838",
    defectClass: "defect",
    confidence: 97.4,
    batchId: "BATCH-2026-0725-010",
    partName: "Shaft Coupling 40mm",
    timestamp: "08 Sep 2026, 11:30:45 WIB",
    rawDate: "2026-09-08T11:30:45",
    status: "Rejected",
    dispatchId: "DSP-2026-0414",
    lotCount: 400,
    supplier: "CV Mega Teknik",
    line: "Station #02 (Conveyor Cam-02)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Severe geometric distortion anomaly detected outside ISO 286 tolerance limits.",
        latency: "68ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Immediate Scrap Disposition",
        detail: "Fatal non-compliance severity. Lot rejected for complete scrap and remelt cycle.",
        latency: "20ms",
      },
    ],
  },
  {
    id: "INS-2026-8837",
    defectClass: "defect",
    confidence: 86.1,
    batchId: "BATCH-2026-0732-003",
    partName: "Flange Pinion X1",
    timestamp: "08 Sep 2026, 10:12:18 WIB",
    rawDate: "2026-09-08T10:12:18",
    status: "Pending Review",
    dispatchId: "DSP-2026-0408",
    lotCount: 800,
    supplier: "PT Baja Presisi Prima",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Edge burr anomaly detected across fastener threading grooves.",
        latency: "74ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Rework Candidate",
        detail: "Escalation score 0.45. Queued for manual deburring station review by operator.",
        latency: "25ms",
      },
    ],
  },
  {
    id: "INS-2026-8836",
    defectClass: "OK",
    confidence: 99.4,
    batchId: "BATCH-2026-0728-001",
    partName: "Rotor Casing D4",
    timestamp: "07 Sep 2026, 16:20:00 WIB",
    rawDate: "2026-09-07T16:20:00",
    status: "Passed",
    lotCount: 650,
    supplier: "PT Cipta Logam Nusantara",
    line: "Station #03 (Conveyor Cam-03)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "Visual Optical Inspection",
        detail: "Structural integrity 100% compliant with internal QC tolerances.",
        latency: "75ms",
      },
    ],
  },
  {
    id: "INS-2026-8835",
    defectClass: "defect",
    confidence: 91.8,
    batchId: "BATCH-2026-0723-005",
    partName: "Bearing Sleeve B8",
    timestamp: "07 Sep 2026, 14:10:30 WIB",
    rawDate: "2026-09-07T14:10:30",
    status: "Held",
    dispatchId: "DSP-2026-0413",
    lotCount: 600,
    supplier: "PT Krakatau Scrap Ind.",
    line: "Station #03 (Conveyor Cam-03)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Casting porosity defect detected along the inner bearing raceway.",
        latency: "80ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Material Hold",
        detail: "Score 0.91 triggered quarantine transfer to quarantine warehouse.",
        latency: "30ms",
      },
    ],
  },
  {
    id: "INS-2026-8834",
    defectClass: "OK",
    confidence: 98.7,
    batchId: "BATCH-2026-0729-001",
    partName: "Piston Base Ring 55",
    timestamp: "07 Sep 2026, 11:05:14 WIB",
    rawDate: "2026-09-07T11:05:14",
    status: "Passed",
    lotCount: 1200,
    supplier: "PT Dharma Precision",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "Conveyor Vision Scan",
        detail: "Optimal physical surface finish without casting irregularities.",
        latency: "72ms",
      },
    ],
  },
  {
    id: "INS-2026-8833",
    defectClass: "defect",
    confidence: 89.2,
    batchId: "BATCH-2026-0722-004",
    partName: "Mounting Flange M10",
    timestamp: "06 Sep 2026, 15:45:50 WIB",
    rawDate: "2026-09-06T15:45:50",
    status: "Pending Review",
    lotCount: 950,
    supplier: "CV Logam Mandiri",
    line: "Station #02 (Conveyor Cam-02)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Micro-casting irregularity anomaly detected at the outer flange rim.",
        latency: "77ms",
      },
    ],
  },
  {
    id: "INS-2026-8832",
    defectClass: "OK",
    confidence: 99.6,
    batchId: "BATCH-2026-0721-002",
    partName: "Camshaft Gear 18T",
    timestamp: "06 Sep 2026, 09:30:12 WIB",
    rawDate: "2026-09-06T09:30:12",
    status: "Passed",
    dispatchId: "DSP-2026-0409",
    lotCount: 700,
    supplier: "PT Dharma Precision",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "Conveyor Vision Scan",
        detail: "Gear tooth pitch and flank geometry are within nominal tolerances.",
        latency: "74ms",
      },
    ],
  },
  {
    id: "INS-2026-8831",
    defectClass: "defect",
    confidence: 95.0,
    batchId: "BATCH-2026-0727-001",
    partName: "Support Arm T-9",
    timestamp: "05 Sep 2026, 14:15:00 WIB",
    rawDate: "2026-09-05T14:15:00",
    status: "Held",
    lotCount: 450,
    supplier: "PT Cipta Logam Nusantara",
    line: "Station #02 (Conveyor Cam-02)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Structural flaw anomaly detected at the neck junction of support arm.",
        latency: "79ms",
      },
    ],
  },
];
