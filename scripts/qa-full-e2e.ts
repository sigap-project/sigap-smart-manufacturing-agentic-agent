import crypto from "crypto";
import { prisma } from "../lib/prisma";

const BASE_URL = process.env.SIGAP_BASE_URL || "http://localhost:3000";

interface TestResult {
  suite: string;
  test: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const results: TestResult[] = [];

function record(suite: string, test: string, passed: boolean, details?: string) {
  const status = passed ? "PASS" : "FAIL";
  results.push({ suite, test, status, details });
  const icon = passed ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${suite}: ${test}${details ? ` (${details})` : ""}`);
}

async function seedDemoData() {
  console.log("===============================================================================");
  console.log("SEEDING DEMO DATA (--seed-demo)");
  console.log("===============================================================================");

  // 1. Seed Setting
  await prisma.setting.upsert({
    where: { id: "default" },
    update: {
      autoDispatchMode: "human_approval",
      escalationWindowMinutes: 8,
      escalationCountTrigger: 3,
      detectionConfidenceThreshold: 85.0,
      approvalSlaMinutes: 15,
      mockMode: true,
    },
    create: {
      id: "default",
      autoDispatchMode: "human_approval",
      escalationWindowMinutes: 8,
      escalationCountTrigger: 3,
      detectionConfidenceThreshold: 85.0,
      approvalSlaMinutes: 15,
      mockMode: true,
    },
  });
  console.log("  [+] Configured Setting: 8-min window, 3-defect trigger, human_approval mode.");

  // 2. Seed FINAL-OK batch
  const finalOk = await prisma.batch.upsert({
    where: { lotId: "#FINAL-OK" },
    update: {
      status: "pending",
      storageZone: "standard",
      inspectionCount: 0,
      defectCount: 0,
      dataOrigin: "operational",
    },
    create: {
      id: "final-ok",
      lotId: "#FINAL-OK",
      productType: "Submersible Pump Impeller Casting",
      supplierName: "PT Mitra Logam Presisi",
      materialNumber: "MAT-IMP-9842",
      workOrderId: "WO-2026-771",
      status: "pending",
      storageZone: "standard",
      inspectionCount: 0,
      defectCount: 0,
      version: 1,
      caseEpoch: 1,
      dataOrigin: "operational",
    },
  });
  console.log(`  [+] Batch final-ok seeded: ID=${finalOk.id}, lotId=${finalOk.lotId}`);

  // 3. Seed FINAL-01 batch
  const final01 = await prisma.batch.upsert({
    where: { lotId: "#FINAL-01" },
    update: {
      status: "pending",
      storageZone: "standard",
      inspectionCount: 0,
      defectCount: 0,
      materialNumber: "MAT-IMP-9842",
      workOrderId: "WO-2026-771",
      supplierName: "PT Krakatau Scrap Ind.",
      dataOrigin: "operational",
    },
    create: {
      id: "final-01",
      lotId: "#FINAL-01",
      productType: "Submersible Pump Impeller Casting",
      supplierName: "PT Krakatau Scrap Ind.",
      materialNumber: "MAT-IMP-9842",
      workOrderId: "WO-2026-771",
      status: "pending",
      storageZone: "standard",
      inspectionCount: 0,
      defectCount: 0,
      version: 1,
      caseEpoch: 1,
      dataOrigin: "operational",
    },
  });
  console.log(`  [+] Batch final-01 seeded: ID=${final01.id}, lotId=${final01.lotId}`);

  // 4. Seed Missing Target batch
  const finalMissing = await prisma.batch.upsert({
    where: { lotId: "#FINAL-MISSING" },
    update: {
      status: "pending",
      materialNumber: null,
      workOrderId: null,
    },
    create: {
      id: "final-missing-target",
      lotId: "#FINAL-MISSING",
      productType: "Submersible Pump Impeller Casting",
      supplierName: "PT Krakatau Scrap Ind.",
      materialNumber: null,
      workOrderId: null,
      status: "pending",
      storageZone: "standard",
      version: 1,
      caseEpoch: 1,
      dataOrigin: "operational",
    },
  });
  console.log(`  [+] Batch final-missing-target seeded: ID=${finalMissing.id}, lotId=${finalMissing.lotId}`);

  // 5. Provision device pi-01 bound initially to final-ok
  const token = process.env.SIGAP_DEVICE_TOKEN || "sigap-dev-pi-token-2026";
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const device = await prisma.device.upsert({
    where: { id: "pi-01" },
    update: {
      batchId: finalOk.id,
      enabled: true,
      tokenHash,
      bindingVersion: 1,
      stateVersion: 1,
      lastSeenAt: new Date(),
    },
    create: {
      id: "pi-01",
      batchId: finalOk.id,
      enabled: true,
      tokenHash,
      bindingVersion: 1,
      stateVersion: 1,
      lastSeenAt: new Date(),
    },
  });
  console.log(`  [+] Device pi-01 provisioned and bound to batch: ${device.batchId}`);

  console.log("===============================================================================");
  console.log("DEMO SEEDING COMPLETED.");
  console.log("===============================================================================");
}

async function runCriticalSuite() {
  console.log("===============================================================================");
  console.log("RUNNING SIGAP CRITICAL END-TO-END QA SUITE");
  console.log("===============================================================================");

  // 1. Database Check
  try {
    const batchCount = await prisma.batch.count();
    record("Database", "PostgreSQL Connection & Query Execution", true, `Batches present: ${batchCount}`);
  } catch (err) {
    record("Database", "PostgreSQL Connection & Query Execution", false, err instanceof Error ? err.message : String(err));
  }

  // 2. Settings Check
  try {
    const setting = await prisma.setting.findUnique({ where: { id: "default" } });
    const valid = setting !== null && setting.escalationWindowMinutes === 8 && setting.escalationCountTrigger === 3;
    record("Settings", "Quality Policy Configuration (8m window, 3 trigger)", valid, setting?.autoDispatchMode);
  } catch (err) {
    record("Settings", "Quality Policy Configuration", false, String(err));
  }

  // 3. Device Provisioning Check
  try {
    const device = await prisma.device.findUnique({ where: { id: "pi-01" } });
    record("Hardware Device", "Device pi-01 Registration & Binding", device !== null && device.enabled, `Batch: ${device?.batchId}`);
  } catch (err) {
    record("Hardware Device", "Device Registration", false, String(err));
  }

  // 4. Summarize results
  console.log("===============================================================================");
  const failures = results.filter((r) => r.status === "FAIL");
  console.log(`TOTAL AUDIT CHECKS: ${results.length} | PASS: ${results.length - failures.length} | FAIL: ${failures.length}`);
  console.log("===============================================================================");

  if (failures.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

async function main() {
  const isSeedDemo = process.argv.includes("--seed-demo");
  const isCritical = process.argv.includes("--critical");

  if (isSeedDemo) {
    await seedDemoData();
  }

  if (isCritical || !isSeedDemo) {
    await runCriticalSuite();
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
