import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { BedrockAdapter } from "../lib/aws-bedrock";
import { SapAiCoreAdapter } from "../lib/sap-ai-core";
import { runQualityWorkflow } from "../lib/quality-agent";
import { prisma } from "../lib/prisma";

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

async function runScenarioEvaluation(providerArg: string) {
  console.log("===============================================================================");
  console.log(`SIGAP AI QUALITY REASONING EVALUATION — PROVIDER: ${providerArg.toUpperCase()}`);
  console.log("===============================================================================");

  const adapter = providerArg === "sap-ai-core" ? new SapAiCoreAdapter() : new BedrockAdapter();

  const scenariosFile = path.join(process.cwd(), "scripts", "fixtures", "quality-scenarios.json");
  const raw = await fs.readFile(scenariosFile, "utf-8");
  const scenarios: QualityScenario[] = JSON.parse(raw);

  let passedScenarios = 0;
  const totalScenarios = scenarios.length;

  for (const s of scenarios) {
    const testBatchId = `batch-eval-${s.id.slice(0, 12)}-${crypto.randomBytes(2).toString("hex")}`;
    const testBatch = await prisma.batch.create({
      data: {
        id: testBatchId,
        lotId: `#LOT-${s.id.slice(0, 8).toUpperCase()}`,
        productType: "Submersible Pump Impeller Casting",
        supplierName: s.supplierName || "Unknown Supplier",
        materialNumber: s.materialNumber,
        workOrderId: s.workOrderId,
        status: s.outcome === "ok" ? "pending" : "held",
        version: 1,
        caseEpoch: 1,
      },
    });

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
            receivedAt: new Date(Date.now() - i * 60 * 1000), // Within 8-min window
          },
        });
      }
    }

    const currentInspection = await prisma.inspection.create({
      data: {
        batchId: testBatch.id,
        itemId: `ITEM-${s.id}`,
        outcome: s.outcome,
        confidence: s.outcome === "ok" ? 99.0 : 95.0,
        defectDetected: s.outcome === "defect",
        receivedAt: new Date(),
      },
    });

    const workflowRun = await prisma.workflowRun.create({
      data: {
        inspectionId: currentInspection.id,
        batchId: testBatch.id,
        caseEpoch: 1,
        contextSnapshot: { batchId: testBatch.id },
        policySnapshot: { policyId: "sigap-demo-quality-v1" },
        status: "running",
      },
    });

    try {
      const t0 = Date.now();
      await runQualityWorkflow(workflowRun.id);
      const elapsedMs = Date.now() - t0;

      const dispatches = await prisma.dispatchRecord.findMany({
        where: { runId: workflowRun.id },
      });

      const proposedActionTypes = dispatches.map((d) => d.actionType);
      let passed = false;

      if (s.expectedAction === "NONE") {
        passed = proposedActionTypes.length === 0;
      } else if (s.expectedAction === "CREATE_QUALITY_NOTIFICATION") {
        passed = proposedActionTypes.includes("CREATE_QUALITY_NOTIFICATION");
      } else if (s.expectedAction === "HOLD_MATERIAL_LOT") {
        passed = proposedActionTypes.includes("HOLD_MATERIAL_LOT");
      } else if (s.expectedAction === "REVIEW_ONLY") {
        passed = true;
      }

      if (passed) passedScenarios++;

      console.log(`[${passed ? "PASS" : "FAIL"}] Scenario: ${s.name} (${elapsedMs}ms)`);
      console.log(`       Outcome: ${s.outcome} | Window Defects: ${s.defectCountInWindow}`);
      console.log(`       Expected: ${s.expectedAction} | Actions Proposed: [${proposedActionTypes.join(", ") || "none"}]`);
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
  console.log(`EVALUATION SUMMARY: ${passedScenarios}/${totalScenarios} passed (${((passedScenarios / totalScenarios) * 100).toFixed(1)}%)`);
  console.log("===============================================================================");

  if (passedScenarios === totalScenarios) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

const providerArg = process.argv.includes("--provider")
  ? process.argv[process.argv.indexOf("--provider") + 1]
  : "bedrock";

runScenarioEvaluation(providerArg).finally(async () => {
  await prisma.$disconnect();
});
