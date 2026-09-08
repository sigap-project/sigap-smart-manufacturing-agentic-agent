import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Menjalankan Prisma Seed Script SIGAP Smart Manufacturing...");

  // ===========================================================================
  // 1. SETTING (1 Default Row as defined in UI)
  // ===========================================================================
  console.log("⚙️  1/4 Seeding Setting default...");
  await prisma.setting.upsert({
    where: { id: "default" },
    update: {
      detectionConfidenceThreshold: 68.0,
      escalationWindowMinutes: 10,
      escalationCountTrigger: 3,
      autoStoreEnabled: true,
      autoDispatchMode: "autonomous",
      approvalSlaMinutes: 15,
      mockMode: true,
      cameraSource: "mock",
      rtspUrl: "rtsp://192.168.1.120:8554/live/station-01",
      autoExportCsv: true,
      logRetentionDays: 30,
      monitoredProducts: [
        "Bracket Motor A7",
        "Gearbox Housing C2",
        "Flange Pinion X1",
        "Rotor Casing D4",
        "Piston Base Ring 55",
      ],
    },
    create: {
      id: "default",
      detectionConfidenceThreshold: 68.0, // As specified in prompt: 68%
      escalationWindowMinutes: 10,        // As specified in prompt: 10 menit
      escalationCountTrigger: 3,
      autoStoreEnabled: true,
      autoDispatchMode: "autonomous",
      approvalSlaMinutes: 15,
      mockMode: true,
      cameraSource: "mock",
      rtspUrl: "rtsp://192.168.1.120:8554/live/station-01",
      autoExportCsv: true,
      logRetentionDays: 30,
      monitoredProducts: [
        "Bracket Motor A7",
        "Gearbox Housing C2",
        "Flange Pinion X1",
        "Rotor Casing D4",
        "Piston Base Ring 55",
      ],
    },
  });

  // ===========================================================================
  // 2. BATCHES (5 Sample Batches with Varied Statuses)
  // ===========================================================================
  console.log("📦 2/4 Seeding 5 Sample Batches (varied statuses)...");

  // Batch 1: Held (Quarantine Zone, Pattern Confirmed)
  const batch1 = await prisma.batch.upsert({
    where: { lotId: "#B-2026-0730" },
    update: {},
    create: {
      id: "batch-b-2026-0730",
      lotId: "#B-2026-0730",
      productType: "Bracket Motor A7",
      supplierName: "PT Krakatau Scrap Ind.",
      line: "Line #01 (Conveyor Cam-01)",
      inspectionCount: 500,
      defectCount: 14,
      defectTypes: ["Warna Abnormal", "Retak Mikro"],
      escalationScore: 0.74,
      status: "held",
      storageZone: "quarantine",
      pendingApproval: true,
      slaSeconds: 780,
      defectSummary: "Warna abnormal berulang (94.2%) dan 3 micro-crack pada base mounting.",
    },
  });

  // Batch 2: Pending Review (Quarantine Zone, Gas Porosity)
  const batch2 = await prisma.batch.upsert({
    where: { lotId: "#B-2026-0731" },
    update: {},
    create: {
      id: "batch-b-2026-0731",
      lotId: "#B-2026-0731",
      productType: "Gearbox Housing C2",
      supplierName: "CV Logam Mandiri",
      line: "Line #02 (Conveyor Cam-02)",
      inspectionCount: 320,
      defectCount: 5,
      defectTypes: ["Lubang Gas (Porosity)"],
      escalationScore: 0.62,
      status: "pending_review",
      storageZone: "quarantine",
      pendingApproval: true,
      slaSeconds: 420,
      defectSummary: "Porositas permukaan melampaui toleransi 1.2mm pada area seal flange.",
    },
  });

  // Batch 3: Pending Review (Standard Zone, Burr issue)
  const batch3 = await prisma.batch.upsert({
    where: { lotId: "#B-2026-0732" },
    update: {},
    create: {
      id: "batch-b-2026-0732",
      lotId: "#B-2026-0732",
      productType: "Flange Pinion X1",
      supplierName: "PT Baja Presisi Prima",
      line: "Line #01 (Conveyor Cam-01)",
      inspectionCount: 800,
      defectCount: 3,
      defectTypes: ["Burr Berlebih"],
      escalationScore: 0.45,
      status: "pending_review",
      storageZone: "standard",
      pendingApproval: true,
      slaSeconds: 1140,
      defectSummary: "Burr pada ulir baut terdeteksi sporadis, butuh konfirmasi visual operator.",
    },
  });

  // Batch 4: Released (Standard Zone, Clean passed)
  const batch4 = await prisma.batch.upsert({
    where: { lotId: "#B-2026-0728" },
    update: {},
    create: {
      id: "batch-b-2026-0728",
      lotId: "#B-2026-0728",
      productType: "Rotor Casing D4",
      supplierName: "PT Cipta Logam Nusantara",
      line: "Line #03 (Conveyor Cam-03)",
      inspectionCount: 650,
      defectCount: 0,
      defectTypes: [],
      escalationScore: 0.08,
      status: "released",
      storageZone: "standard",
      pendingApproval: false,
    },
  });

  // Batch 5: Rejected (Scrap disposition, Fatal defect)
  const batch5 = await prisma.batch.upsert({
    where: { lotId: "#B-2026-0725" },
    update: {},
    create: {
      id: "batch-b-2026-0725",
      lotId: "#B-2026-0725",
      productType: "Shaft Coupling 40mm",
      supplierName: "CV Mega Teknik",
      line: "Line #02 (Conveyor Cam-02)",
      inspectionCount: 400,
      defectCount: 38,
      defectTypes: ["Dimensi Out-of-Spec"],
      escalationScore: 0.95,
      status: "rejected",
      storageZone: "standard",
      pendingApproval: false,
      defectSummary: "Penyimpangan diameter poros fatal -1.4mm di luar toleransi ISO 286.",
    },
  });

  // ===========================================================================
  // 3. INSPECTIONS (15 Sample Inspections with Varied Defect Classes & Confidences)
  // ===========================================================================
  console.log("🔍 3/4 Seeding 15 Sample Inspections (varied defect classes & confidence)...");

  const sampleInspections = [
    {
      id: "INS-2026-8842",
      batchId: batch1.id,
      timestamp: new Date("2026-09-08T14:32:10Z"),
      defectDetected: true,
      defectClass: "warna_abnormal",
      confidence: 94.2,
      severity: "High",
      status: "Ditahan",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "YOLOv8-Nano Inference", detail: "Cacat diskolorasi terdeteksi koordinat X:524 Y:312 (94.2%).", latency: "78ms" },
        { step: "02", phase: "MEMORY", title: "Bedrock Memory Analysis", detail: "3 anomali warna abnormal berulang dalam 8 menit.", latency: "124ms" },
        { step: "03", phase: "FORMULA", title: "Escalation Score Calculation", detail: "Kalkulasi formula menghasilkan nilai 0.74.", latency: "12ms" },
        { step: "04", phase: "DECISION", title: "Autonomous Decision", detail: "Ambang batas 0.70 terlampaui (Level 3). Tahan lot ke karantina.", latency: "45ms" },
        { step: "05", phase: "DISPATCH", title: "SAP QM Integration", detail: "Tiket notifikasi mutu QM-NOTIF-98214 terbit otomatis.", latency: "180ms" },
      ],
    },
    {
      id: "INS-2026-8841",
      batchId: batch1.id,
      timestamp: new Date("2026-09-08T14:31:55Z"),
      defectDetected: false,
      defectClass: "OK",
      confidence: 99.1,
      severity: "None",
      status: "Lolos QC",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "YOLOv8-Nano Inference", detail: "Permukaan casting bersih sesuai baseline CAD.", latency: "76ms" },
        { step: "02", phase: "DECISION", title: "Passed", detail: "Confidence 99.1% tanpa cacat.", latency: "15ms" },
      ],
    },
    {
      id: "INS-2026-8840",
      batchId: batch2.id,
      timestamp: new Date("2026-09-08T14:14:22Z"),
      defectDetected: true,
      defectClass: "lubang_gas",
      confidence: 88.5,
      severity: "Medium",
      status: "Pending Review",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "YOLOv8-Nano Inference", detail: "Porositas 1.4mm terdeteksi pada area seal flange.", latency: "82ms" },
        { step: "02", phase: "FORMULA", title: "Formula Score", detail: "Skor 0.62 (Elevated Risk). Alihkan ke antrean supervisor.", latency: "14ms" },
      ],
    },
    {
      id: "INS-2026-8839",
      batchId: batch1.id,
      timestamp: new Date("2026-09-08T12:45:08Z"),
      defectDetected: true,
      defectClass: "retak_permukaan",
      confidence: 96.8,
      severity: "Critical",
      status: "Ditahan",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Edge Contrast Analysis", detail: "Retakan mikro 6.2mm pada sambungan base.", latency: "79ms" },
        { step: "02", phase: "DECISION", title: "Safety Quarantine", detail: "Skor 0.88 memicu isolasi seketika.", latency: "32ms" },
      ],
    },
    {
      id: "INS-2026-8838",
      batchId: batch5.id,
      timestamp: new Date("2026-09-08T11:30:45Z"),
      defectDetected: true,
      defectClass: "dimensi_cacat",
      confidence: 97.4,
      severity: "Critical",
      status: "Ditolak",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Optical Metrology", detail: "Deviasi diameter -1.4mm di luar spesifikasi.", latency: "68ms" },
        { step: "02", phase: "DECISION", title: "Immediate Scrap", detail: "Produk dialihkan ke scrap bin.", latency: "20ms" },
      ],
    },
    {
      id: "INS-2026-8837",
      batchId: batch3.id,
      timestamp: new Date("2026-09-08T10:12:18Z"),
      defectDetected: true,
      defectClass: "burr_berlebih",
      confidence: 86.1,
      severity: "Low",
      status: "Pending Review",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Contour Filter", detail: "Burr pada ulir baut sebesar 0.8mm.", latency: "74ms" },
        { step: "02", phase: "DECISION", title: "Rework Flag", detail: "Kandidat deburring manual.", latency: "25ms" },
      ],
    },
    {
      id: "INS-2026-8836",
      batchId: batch4.id,
      timestamp: new Date("2026-09-07T16:20:00Z"),
      defectDetected: false,
      defectClass: "OK",
      confidence: 99.4,
      severity: "None",
      status: "Lolos QC",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Optical Scan", detail: "Geometri rotor presisi.", latency: "75ms" },
      ],
    },
    {
      id: "INS-2026-8835",
      batchId: batch1.id,
      timestamp: new Date("2026-09-07T14:10:30Z"),
      defectDetected: true,
      defectClass: "warna_abnormal",
      confidence: 91.8,
      severity: "High",
      status: "Ditahan",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Colorimeter Scan", detail: "Oksidasi termal pada raceway bearing.", latency: "80ms" },
      ],
    },
    {
      id: "INS-2026-8834",
      batchId: batch4.id,
      timestamp: new Date("2026-09-07T11:05:14Z"),
      defectDetected: false,
      defectClass: "OK",
      confidence: 98.7,
      severity: "None",
      status: "Lolos QC",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Scan Clean", detail: "Casting homogen.", latency: "72ms" },
      ],
    },
    {
      id: "INS-2026-8833",
      batchId: batch2.id,
      timestamp: new Date("2026-09-06T15:45:50Z"),
      defectDetected: true,
      defectClass: "lubang_gas",
      confidence: 89.2,
      severity: "Medium",
      status: "Pending Review",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Porosity Check", detail: "Cluster porositas mikro 1.1mm.", latency: "77ms" },
      ],
    },
    {
      id: "INS-2026-8832",
      batchId: batch4.id,
      timestamp: new Date("2026-09-06T09:30:12Z"),
      defectDetected: false,
      defectClass: "OK",
      confidence: 99.6,
      severity: "None",
      status: "Lolos QC",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Gear Scan", detail: "Gigi gear 18T sempurna tanpa chipping.", latency: "74ms" },
      ],
    },
    {
      id: "INS-2026-8831",
      batchId: batch1.id,
      timestamp: new Date("2026-09-05T14:15:00Z"),
      defectDetected: true,
      defectClass: "retak_permukaan",
      confidence: 95.0,
      severity: "High",
      status: "Ditahan",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Defect Analysis", detail: "Micro-crack pada sudut radius mounting.", latency: "79ms" },
      ],
    },
    {
      id: "INS-2026-8830",
      batchId: batch3.id,
      timestamp: new Date("2026-09-05T11:20:10Z"),
      defectDetected: false,
      defectClass: "OK",
      confidence: 98.9,
      severity: "None",
      status: "Lolos QC",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Clean Surface", detail: "Flange bersih sesuai toleransi.", latency: "71ms" },
      ],
    },
    {
      id: "INS-2026-8829",
      batchId: batch5.id,
      timestamp: new Date("2026-09-04T16:05:40Z"),
      defectDetected: true,
      defectClass: "dimensi_cacat",
      confidence: 96.2,
      severity: "Critical",
      status: "Ditolak",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Caliper Metric", detail: "Ketebalan dinding casting di bawah spek.", latency: "83ms" },
      ],
    },
    {
      id: "INS-2026-8828",
      batchId: batch2.id,
      timestamp: new Date("2026-09-04T10:18:22Z"),
      defectDetected: true,
      defectClass: "lubang_gas",
      confidence: 87.9,
      severity: "Medium",
      status: "Pending Review",
      agentReasoningTrace: [
        { step: "01", phase: "DETECT", title: "Pore Detect", detail: "Lubang gas pada permukaan atas housing.", latency: "78ms" },
      ],
    },
  ];

  for (const ins of sampleInspections) {
    await prisma.inspection.upsert({
      where: { id: ins.id },
      update: {},
      create: ins,
    });
  }

  // ===========================================================================
  // 4. DISPATCH RECORDS (8 Sample Records with Varied Consumers & Statuses)
  // ===========================================================================
  console.log("📤 4/4 Seeding 8 Sample Dispatch Records (varied consumers & statuses)...");

  const sampleDispatches = [
    {
      id: "DSP-2026-0419",
      batchId: batch1.id,
      triggerReason: "3 anomali warna_abnormal berulang dalam 8 menit",
      consumer: "SAP QM",
      status: "Dispatched",
      approvedBy: "Autonomous Vision Agent (Score > 0.70)",
      sapTicketId: "QM-NOTIF-98214",
      defectCode: "DEF-CAST-04",
      dispatchedAt: new Date("2026-09-08T14:32:00Z"),
      payload: {
        plant: "PLANT-01",
        defectClass: "Warna Abnormal",
        lotId: "#B-2026-0730",
        action: "QUALITY_HOLD",
      },
      sapResponse: { status: 201, message: "Created in SAP QM OData v4" },
    },
    {
      id: "DSP-2026-0418",
      batchId: batch1.id,
      triggerReason: "Supplier defect rate melampaui batas toleransi 4.5%",
      consumer: "SAP MM",
      status: "Dispatched",
      approvedBy: "Budi Pratama (QC Supervisor)",
      sapTicketId: "MM-FLAG-44012",
      defectCode: "VND-FLAG-REV",
      dispatchedAt: new Date("2026-09-08T14:15:00Z"),
      payload: {
        vendorCode: "VND-KRAKATAU-01",
        flag: "UNDER_REVIEW",
      },
      sapResponse: { status: 200, message: "Vendor PO flagged in SAP MM" },
    },
    {
      id: "DSP-2026-0417",
      batchId: batch2.id,
      triggerReason: "Alokasi raw material ditangguhkan akibat penahanan lot karantina",
      consumer: "SAP PP",
      status: "Pending Approval",
      approvedBy: "Menunggu Supervisor Shift",
      sapTicketId: "PP-RESCHED-1109",
      defectCode: "PLN-HOLD-02",
      dispatchedAt: new Date("2026-09-08T13:50:00Z"),
      payload: {
        productionOrder: "PRD-2026-8812",
        rescheduleTarget: "SHIFT-02",
      },
      sapResponse: { status: 102, message: "Draft queued for supervisor sign-off" },
    },
    {
      id: "DSP-2026-0416",
      batchId: batch1.id,
      triggerReason: "SLA persetujuan karantina tersisa < 5 menit",
      consumer: "Human Notification",
      status: "Dispatched",
      approvedBy: "SIGAP Escalation Engine",
      sapTicketId: "ALERT-WA-7703",
      defectCode: "MSG-URGENT-01",
      dispatchedAt: new Date("2026-09-08T13:20:00Z"),
      payload: {
        channel: "WhatsApp Gateway",
        recipients: ["Plant Head", "QC Lead"],
        priority: "URGENT",
      },
      sapResponse: { status: 200, message: "WhatsApp message delivered" },
    },
    {
      id: "DSP-2026-0415",
      batchId: batch1.id,
      triggerReason: "Retak mikro (micro-crack) terdeteksi pada 4 unit berurutan",
      consumer: "SAP QM",
      status: "Dispatched",
      approvedBy: "Autonomous Vision Agent (Score > 0.70)",
      sapTicketId: "QM-NOTIF-98201",
      defectCode: "DEF-CAST-01",
      dispatchedAt: new Date("2026-09-08T12:45:00Z"),
      payload: {
        defect: "Retak Mikro",
        blockingLocation: "STORAGE-QUARANTINE",
      },
      sapResponse: { status: 201, message: "Blocking notification created" },
    },
    {
      id: "DSP-2026-0414",
      batchId: batch5.id,
      triggerReason: "Kebutuhan pergeseran slot produksi akibat cacat dimensi",
      consumer: "SAP PP",
      status: "Rejected",
      approvedBy: "Ditolak oleh Budi Pratama (QC Supervisor)",
      sapTicketId: "PP-RESCHED-1098",
      defectCode: "PLN-REJ-01",
      dispatchedAt: new Date("2026-09-08T11:30:00Z"),
      payload: {
        rejectedAction: "SCRAP_RECYCLE",
      },
      sapResponse: { status: 400, message: "Order canceled by supervisor" },
    },
    {
      id: "DSP-2026-0413",
      batchId: batch2.id,
      triggerReason: "Porositas lubang gas melebihi 1.2mm pada seal ring",
      consumer: "SAP QM",
      status: "Dispatched",
      approvedBy: "Autonomous Vision Agent (Score > 0.70)",
      sapTicketId: "QM-NOTIF-98188",
      defectCode: "DEF-CAST-03",
      dispatchedAt: new Date("2026-09-08T10:18:00Z"),
      payload: {
        investigationRequired: true,
      },
      sapResponse: { status: 201, message: "Metallurgy investigation ticket generated" },
    },
    {
      id: "DSP-2026-0412",
      batchId: batch3.id,
      triggerReason: "Klaim garansi batch cacat ke vendor supplier",
      consumer: "SAP MM",
      status: "Pending Approval",
      approvedBy: "Menunggu QC Head",
      sapTicketId: "MM-CLAIM-3021",
      defectCode: "VND-CLM-01",
      dispatchedAt: new Date("2026-09-08T09:40:00Z"),
      payload: {
        claimAmount: 14500000,
        currency: "IDR",
      },
      sapResponse: { status: 102, message: "Pending signature" },
    },
  ];

  for (const dsp of sampleDispatches) {
    await prisma.dispatchRecord.upsert({
      where: { id: dsp.id },
      update: {},
      create: dsp,
    });
  }

  console.log("🎉 Seeding database SIGAP selesai dengan 100% sukses!");
  console.log("📊 Rekap Data:");
  console.log("   - 1 Setting Record (Detection Threshold: 68%, Window: 10m)");
  console.log("   - 5 Batch Records (held, pending_review, released, rejected)");
  console.log("   - 15 Inspection Records (varied defect classes & confidence)");
  console.log("   - 8 Dispatch Records (SAP QM, MM, PP, Human Notification)");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
