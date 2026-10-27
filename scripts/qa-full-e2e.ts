import crypto from "crypto";
import jpeg from "jpeg-js";
import { prisma } from "../lib/prisma";
import { createSessionCookie } from "../lib/auth";
import { runQualityWorkflow } from "../lib/quality-agent";
import { processNextDispatch } from "./workflow-worker";
import { PATCH as approveDispatch } from "../app/api/dispatch/[id]/approve/route";
import { NextRequest } from "next/server";

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

function createTestJpeg(width = 640, height = 480): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = 110;
    buf[i + 1] = 140;
    buf[i + 2] = 180;
    buf[i + 3] = 255;
  }
  return jpeg.encode({ data: buf, width, height }, 50).data;
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
  console.log("RUNNING SIGAP CRITICAL END-TO-END QA SUITE (INGESTION -> REASONING -> APPROVAL -> DISPATCH -> READ-BACK)");
  console.log("===============================================================================");

  process.env.SIGAP_TEST_MODE = "1";

  // Supervisor session
  const supervisorUser = { userId: "qa-supervisor", role: "supervisor" as const, salt: "", passwordHash: "" };
  const { cookieValue: supervisorCookie, csrfToken: supervisorCsrf } = createSessionCookie(supervisorUser);

  // Rehearse 3 consecutive end-to-end runs
  for (let runIndex = 1; runIndex <= 3; runIndex++) {
    console.log(`\n--- REHEARSAL RUN ${runIndex} / 3 ---`);
    const testBatchId = `batch-e2e-run-${runIndex}-${crypto.randomBytes(3).toString("hex")}`;
    const testBatch = await prisma.batch.create({
      data: {
        id: testBatchId,
        lotId: `#E2E-RUN-${runIndex}-${Date.now().toString().slice(-4)}`,
        productType: "Submersible Pump Impeller Casting",
        supplierName: "PT Krakatau Scrap Ind.",
        materialNumber: "MAT-IMP-9842",
        workOrderId: "WO-2026-771",
        status: "pending",
        storageZone: "standard",
        version: 1,
        caseEpoch: 1,
        dataOrigin: "synthetic",
      },
    });

    const testDevice = await prisma.device.upsert({
      where: { id: `pi-e2e-${runIndex}` },
      update: { batchId: testBatch.id, enabled: true, bindingVersion: 1 },
      create: {
        id: `pi-e2e-${runIndex}`,
        tokenHash: crypto.createHash("sha256").update(`token-e2e-${runIndex}`).digest("hex"),
        batchId: testBatch.id,
        enabled: true,
        bindingVersion: 1,
      },
    });

    const jpegBuffer = createTestJpeg(640, 480);
    const jpegSha256 = crypto.createHash("sha256").update(jpegBuffer).digest("hex");
    const eventId = crypto.randomUUID();
    const itemId = `ITEM-E2E-${runIndex}-01`;

    const inspection = await prisma.inspection.create({
      data: {
        id: `INS-E2E-${runIndex}-${Date.now().toString().slice(-6)}`,
        batchId: testBatch.id,
        eventId,
        deviceId: testDevice.id,
        bindingVersion: 1,
        itemId,
        outcome: "defect",
        confidence: 96.2,
        defectDetected: true,
        defectClass: "defect",
        status: "Ditahan",
        imageSha256: jpegSha256,
        imageWidth: 640,
        imageHeight: 480,
        caseEpoch: 1,
        dataOrigin: "synthetic",
        capturedAt: new Date(),
        receivedAt: new Date(),
      },
    });

    const workflowRun = await prisma.workflowRun.create({
      data: {
        id: `RUN-E2E-${runIndex}-${Date.now().toString().slice(-6)}`,
        inspectionId: inspection.id,
        batchId: testBatch.id,
        caseEpoch: 1,
        contextSnapshot: { batchId: testBatch.id, itemId },
        policySnapshot: {
          policyId: "sigap-demo-quality-v1",
          slidingWindowMinutes: 8,
          escalationDefectTrigger: 3,
          allowedActions: ["CREATE_QUALITY_NOTIFICATION", "HOLD_MATERIAL_LOT", "HOLD_WORK_ORDER"],
        },
        status: "queued",
      },
    });

    try {
      // 1. Run durable workflow (tool loop)
      const t0_workflow = Date.now();
      await runQualityWorkflow(workflowRun.id);
      const elapsedWorkflow = Date.now() - t0_workflow;
      record("End-to-End Workflow", `Run ${runIndex}: Reasoning Tool Loop Execution`, true, `${elapsedWorkflow}ms`);

      const dispatches = await prisma.dispatchRecord.findMany({
        where: { runId: workflowRun.id },
      });
      const hasQnotif = dispatches.some((d) => d.actionType === "CREATE_QUALITY_NOTIFICATION");
      record("End-to-End Workflow", `Run ${runIndex}: Governed QM Action Proposal`, hasQnotif && dispatches[0].status === "pending_approval", `Action: ${dispatches[0]?.actionType}`);

      // 2. Approve via HTTP Route
      const proposed = dispatches[0];
      const currentBatch = await prisma.batch.findUnique({ where: { id: testBatch.id } });
      const reqApprove = new NextRequest(`http://localhost:3000/api/dispatch/${proposed.id}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `sigap_session=${supervisorCookie}`,
          "x-csrf-token": supervisorCsrf,
        },
        body: JSON.stringify({
          expectedRevision: proposed.revision,
          expectedBatchVersion: currentBatch?.version,
          reason: `Supervisor approval for rehearsal run ${runIndex}`,
        }),
      });

      const resApprove = await approveDispatch(reqApprove, { params: Promise.resolve({ id: proposed.id }) });
      record("End-to-End Approval", `Run ${runIndex}: HTTP Supervisor Authorization`, resApprove.status === 200, `Status HTTP: ${resApprove.status}`);

      // 3. Worker Execution & Simulator Read-back
      const didDispatch = await processNextDispatch();
      const verifiedDispatch = await prisma.dispatchRecord.findUnique({ where: { id: proposed.id } });
      const isVerified = verifiedDispatch?.status === "verified";
      record("End-to-End Dispatch", `Run ${runIndex}: Worker Execution & Simulator Read-back`, isVerified, `Ticket: ${verifiedDispatch?.sapTicketId}`);

      // 4. Verify persistent SimulatorRecord
      const simRecord = await prisma.simulatorRecord.findUnique({ where: { actionKey: proposed.actionKey! } });
      record("End-to-End Persistence", `Run ${runIndex}: Persistent ERP Simulator Record`, simRecord !== null && simRecord.resultingState === "OPEN", `State: ${simRecord?.resultingState}`);
    } finally {
      // Clean up test iteration
      await prisma.simulatorRecord.deleteMany({ where: { actionKey: { startsWith: testBatch.id } } });
      await prisma.dispatchRecord.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.agentLog.deleteMany({ where: { inspectionId: inspection.id } });
      await prisma.workflowRun.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.inspection.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.device.deleteMany({ where: { id: `pi-e2e-${runIndex}` } });
      await prisma.batch.delete({ where: { id: testBatch.id } });
    }
  }

  // Summarize results
  console.log("===============================================================================");
  const failures = results.filter((r) => r.status === "FAIL");
  console.log(`TOTAL E2E AUDIT CHECKS: ${results.length} | PASS: ${results.length - failures.length} | FAIL: ${failures.length}`);
  console.log("===============================================================================");

  if (failures.length > 0) {
    process.exit(1);
  } else {
    console.log("ALL CRITICAL END-TO-END WORKFLOW AUDITS PASSED WITH DEFENSIBLE EVIDENCE!");
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
