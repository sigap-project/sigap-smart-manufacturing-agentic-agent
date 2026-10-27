import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { runQualityWorkflow } from "../lib/quality-agent";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

interface QualityScenario {
  id: string;
  name: string;
  outcome: "ok" | "defect" | "unknown";
  defectCountInWindow: number;
  supplierName: string | null;
  materialNumber: string | null;
  workOrderId: string | null;
  expectedAction: string;
  expectedSupervisorApproval: boolean;
}

async function loadPolicy() {
  const p = path.join(process.cwd(), "data", "quality-policy.json");
  return JSON.parse(await fs.readFile(p, "utf-8"));
}

async function runScenarioEvaluation(providerArg: string) {
  console.log("===============================================================================");
  console.log(`SIGAP AI QUALITY REASONING EVALUATION — PROVIDER: ${providerArg.toUpperCase()}`);
  console.log("===============================================================================");

  // Set provider explicitly for workflow orchestrator
  process.env.SIGAP_AI_PROVIDER = providerArg;

  const scenariosFile = path.join(process.cwd(), "scripts", "fixtures", "quality-scenarios.json");
  const raw = await fs.readFile(scenariosFile, "utf-8");
  const scenarios: QualityScenario[] = JSON.parse(raw);
  const policy = await loadPolicy();

  let passedScenarios = 0;
  const totalScenarios = scenarios.length;

  for (const s of scenarios) {
    const testBatchId = `batch-eval-${s.id.slice(0, 12)}-${crypto.randomBytes(2).toString("hex")}`;
    const testBatch = await prisma.batch.create({
      data: {
        id: testBatchId,
        lotId: `#LOT-${s.id.slice(0, 8).toUpperCase()}`,
        productType: "Submersible Pump Impeller Casting",
        supplierName: s.supplierName,
        materialNumber: s.materialNumber,
        workOrderId: s.workOrderId,
        status: s.outcome === "ok" ? "pending" : "held",
        version: 1,
        caseEpoch: 1,
      },
    });

    const now = Date.now();

    // Create prior in-window defect inspections if scenario requires it
    if (s.defectCountInWindow > 1) {
      for (let i = 1; i < s.defectCountInWindow; i++) {
        await prisma.inspection.create({
          data: {
            batchId: testBatch.id,
            itemId: `PREV-DEF-${i}`,
            outcome: "defect",
            confidence: 94.0,
            defectDetected: true,
            capturedAt: new Date(now - i * 60 * 1000), // Within 8-min closed window
            receivedAt: new Date(now - i * 60 * 1000),
            caseEpoch: 1,
          },
        });
      }
    }

    const currentInspection = await prisma.inspection.create({
      data: {
        batchId: testBatch.id,
        itemId: `ITEM-${s.id}`,
        outcome: s.outcome,
        confidence: s.outcome === "ok" ? 99.0 : (s.outcome === "defect" ? 95.0 : null),
        defectDetected: s.outcome === "defect",
        capturedAt: new Date(now),
        receivedAt: new Date(now),
        caseEpoch: 1,
        errorCode: s.outcome === "unknown" ? "low_confidence" : undefined,
      },
    });

    const workflowRun = await prisma.workflowRun.create({
      data: {
        inspectionId: currentInspection.id,
        batchId: testBatch.id,
        caseEpoch: 1,
        contextSnapshot: { batchId: testBatch.id },
        policySnapshot: policy as Prisma.InputJsonValue,
        status: "queued",
      },
    });

    try {
      const t0 = Date.now();
      await runQualityWorkflow(workflowRun.id);
      const elapsedMs = Date.now() - t0;

      const dispatches = await prisma.dispatchRecord.findMany({
        where: { runId: workflowRun.id },
      });

      const updatedRun = await prisma.workflowRun.findUnique({
        where: { id: workflowRun.id },
      });

      const proposedActionTypes = dispatches.map((d) => d.actionType);
      let passed = false;

      if (s.expectedAction === "NONE") {
        passed = proposedActionTypes.length === 0 && updatedRun?.status === "completed";
      } else if (s.expectedAction === "REVIEW_ONLY") {
        passed = proposedActionTypes.length === 0 && updatedRun?.status === "needs_review";
      } else if (s.expectedAction === "CREATE_QUALITY_NOTIFICATION") {
        passed = proposedActionTypes.includes("CREATE_QUALITY_NOTIFICATION");
        // If material hold should be blocked due to missing target or low count:
        if (s.materialNumber === null || s.defectCountInWindow < 3) {
          passed = passed && !proposedActionTypes.includes("HOLD_MATERIAL_LOT");
        }
      } else if (s.expectedAction === "HOLD_MATERIAL_LOT") {
        passed =
          proposedActionTypes.includes("HOLD_MATERIAL_LOT") &&
          proposedActionTypes.includes("CREATE_QUALITY_NOTIFICATION");
        // If work order is null, assert that HOLD_WORK_ORDER was blocked
        if (s.workOrderId === null) {
          passed = passed && !proposedActionTypes.includes("HOLD_WORK_ORDER");
        }
      }

      // Assert supervisor approval requirement on all dispatches
      for (const d of dispatches) {
        if (d.status !== "pending_approval") {
          passed = false;
        }
      }

      if (passed) passedScenarios++;

      console.log(`[${passed ? "PASS" : "FAIL"}] Scenario: ${s.name} (${elapsedMs}ms)`);
      console.log(`       Outcome: ${s.outcome} | Window Defects: ${s.defectCountInWindow}`);
      console.log(`       Run Status: ${updatedRun?.status} | Actions: [${proposedActionTypes.join(", ") || "none"}]`);
    } catch (err) {
      console.log(`[FAIL] Scenario: ${s.name} - Exception: ${err instanceof Error ? err.message : err}`);
    } finally {
      await prisma.dispatchRecord.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.agentLog.deleteMany({ where: { inspectionId: currentInspection.id } });
      await prisma.workflowRun.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.inspection.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.batch.delete({ where: { id: testBatch.id } });
    }
  }

  console.log("===============================================================================");
  console.log(
    `EVALUATION SUMMARY: ${passedScenarios}/${totalScenarios} passed (${((passedScenarios / totalScenarios) * 100).toFixed(1)}%)`
  );
  console.log("===============================================================================");

  await prisma.$disconnect();

  if (passedScenarios < totalScenarios) {
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const providerIndex = args.indexOf("--provider");
const provider = providerIndex !== -1 && args[providerIndex + 1] ? args[providerIndex + 1] : "bedrock";

runScenarioEvaluation(provider).catch((err) => {
  console.error("Evaluation fatal error:", err);
  process.exit(1);
});
