export type DefectClass =
  | "OK"
  | "warna_abnormal"
  | "retak_permukaan"
  | "lubang_gas"
  | "dimensi_cacat"
  | "burr_berlebih";

export type InspectionStatus =
  | "Lolos QC"
  | "Ditahan"
  | "Pending Review"
  | "Ditolak";

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
    defectClass: "warna_abnormal",
    confidence: 94.2,
    batchId: "BATCH-2026-0730-008",
    partName: "Bracket Motor A7",
    timestamp: "08 Sep 2026, 14:32:10 WIB",
    rawDate: "2026-09-08T14:32:10",
    status: "Ditahan",
    dispatchId: "DSP-2026-0419",
    lotCount: 500,
    supplier: "PT Krakatau Scrap Ind.",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Cacat diskolorasi terdeteksi pada koordinat X:524 Y:312 dengan confidence 94.2%.",
        latency: "78ms",
      },
      {
        step: "02",
        phase: "MEMORY",
        title: "Bedrock Temporal Memory",
        detail: "Ditemukan 3 anomali diskolorasi serupa dalam 8 menit terakhir pada supplier PT Krakatau Scrap.",
        latency: "124ms",
      },
      {
        step: "03",
        phase: "FORMULA",
        title: "Formula Engine Escalation",
        detail: "Kalkulasi: (Frekuensi: 3 × 0.40) + (Severity: 0.85 × 0.35) + (Vendor: 0.60 × 0.25) = Skor 0.74.",
        latency: "12ms",
      },
      {
        step: "04",
        phase: "DECISION",
        title: "Autonomous Decision",
        detail: "Skor 0.74 melampaui ambang batas 0.70 (Level 3 Pattern Confirmed). Rekomendasi: Tahan batch.",
        latency: "45ms",
      },
      {
        step: "05",
        phase: "DISPATCH",
        title: "SAP QM Integration",
        detail: "Tiket notifikasi mutu otomatis terbit ke SAP QM (QM-NOTIF-98214) dan lot dikunci di karantina.",
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
    status: "Lolos QC",
    lotCount: 500,
    supplier: "PT Krakatau Scrap Ind.",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Tidak ada anomali visual. Permukaan bersih dan geometri presisi sesuai baseline CAD.",
        latency: "76ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Auto-Release Approved",
        detail: "Confidence 99.1% (Score: 0.02). Unit diloloskan ke stasiun perakitan berikutnya.",
        latency: "15ms",
      },
    ],
  },
  {
    id: "INS-2026-8840",
    defectClass: "lubang_gas",
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
        detail: "Porositas gas 1.4mm terdeteksi pada area sealing surface flange.",
        latency: "82ms",
      },
      {
        step: "02",
        phase: "FORMULA",
        title: "Formula Engine Escalation",
        detail: "Skor eskalasi 0.62 (Kategori: Elevated / Butuh Konfirmasi Supervisor).",
        latency: "14ms",
      },
      {
        step: "03",
        phase: "DECISION",
        title: "Human-in-the-Loop Triggered",
        detail: "Antrean review dialihkan ke layar Supervisor Shift dengan batas SLA 10 menit.",
        latency: "28ms",
      },
    ],
  },
  {
    id: "INS-2026-8839",
    defectClass: "retak_permukaan",
    confidence: 96.8,
    batchId: "BATCH-2026-0726-004",
    partName: "Exhaust Manifold K3",
    timestamp: "08 Sep 2026, 12:45:08 WIB",
    rawDate: "2026-09-08T12:45:08",
    status: "Ditahan",
    dispatchId: "DSP-2026-0415",
    lotCount: 280,
    supplier: "PT Indometal Foundry",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Retak struktural tembus terdeteksi sepanjang 6.2mm pada sambungan las pipa inlet.",
        latency: "79ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Critical Safety Stop",
        detail: "Cacat safety kritis. Skor formula 0.88 memicu penahanan seketika seluruh lot manifol.",
        latency: "32ms",
      },
    ],
  },
  {
    id: "INS-2026-8838",
    defectClass: "dimensi_cacat",
    confidence: 97.4,
    batchId: "BATCH-2026-0725-010",
    partName: "Shaft Coupling 40mm",
    timestamp: "08 Sep 2026, 11:30:45 WIB",
    rawDate: "2026-09-08T11:30:45",
    status: "Ditolak",
    dispatchId: "DSP-2026-0414",
    lotCount: 400,
    supplier: "CV Mega Teknik",
    line: "Station #02 (Conveyor Cam-02)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "Optical Gauge Metrology",
        detail: "Diameter poros 38.6mm, deviasi -1.4mm di luar batas toleransi ISO 286.",
        latency: "68ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Immediate Scrap Disposition",
        detail: "Tingkat keparahan fatal. Lot ditolak total dan dikembalikan ke tanur peleburan ulang.",
        latency: "20ms",
      },
    ],
  },
  {
    id: "INS-2026-8837",
    defectClass: "burr_berlebih",
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
        title: "Edge Contour Analyzer",
        detail: "Burr pada ulir baut terdeteksi sebesar 0.8mm.",
        latency: "74ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Rework Candidate",
        detail: "Skor 0.45. Diarahkan untuk konfirmasi deburring manual oleh operator.",
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
    status: "Lolos QC",
    lotCount: 650,
    supplier: "PT Cipta Logam Nusantara",
    line: "Station #03 (Conveyor Cam-03)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "Visual Optical Inspection",
        detail: "Integritas struktural 100% compliant dengan standar QC internal.",
        latency: "75ms",
      },
    ],
  },
  {
    id: "INS-2026-8835",
    defectClass: "warna_abnormal",
    confidence: 91.8,
    batchId: "BATCH-2026-0723-005",
    partName: "Bearing Sleeve B8",
    timestamp: "07 Sep 2026, 14:10:30 WIB",
    rawDate: "2026-09-07T14:10:30",
    status: "Ditahan",
    dispatchId: "DSP-2026-0413",
    lotCount: 600,
    supplier: "PT Krakatau Scrap Ind.",
    line: "Station #03 (Conveyor Cam-03)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Bercak oksidasi abnormal terdeteksi pada raceway bearing.",
        latency: "80ms",
      },
      {
        step: "02",
        phase: "DECISION",
        title: "Material Hold",
        detail: "Skor 0.91 memicu penahanan lot ke Gudang Karantina.",
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
    status: "Lolos QC",
    lotCount: 1200,
    supplier: "PT Dharma Precision",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "Conveyor Vision Scan",
        detail: "Kondisi fisik optimal tanpa cacat casting.",
        latency: "72ms",
      },
    ],
  },
  {
    id: "INS-2026-8833",
    defectClass: "lubang_gas",
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
        title: "Defect Classifier",
        detail: "Mikro-porositas sporadis terdeteksi pada bibir flange.",
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
    status: "Lolos QC",
    dispatchId: "DSP-2026-0409",
    lotCount: 700,
    supplier: "PT Dharma Precision",
    line: "Station #01 (Conveyor Cam-01)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "Conveyor Vision Scan",
        detail: "Gigi gear presisi sempurna tanpa burr.",
        latency: "74ms",
      },
    ],
  },
  {
    id: "INS-2026-8831",
    defectClass: "retak_permukaan",
    confidence: 95.0,
    batchId: "BATCH-2026-0727-001",
    partName: "Support Arm T-9",
    timestamp: "05 Sep 2026, 14:15:00 WIB",
    rawDate: "2026-09-05T14:15:00",
    status: "Ditahan",
    lotCount: 450,
    supplier: "PT Cipta Logam Nusantara",
    line: "Station #02 (Conveyor Cam-02)",
    reasoningSteps: [
      {
        step: "01",
        phase: "DETECT",
        title: "YOLOv8-Nano Inference",
        detail: "Retakan mikro pada leher penopang arm.",
        latency: "79ms",
      },
    ],
  },
];
