import crypto from "crypto";
import { runQualityWorkflow } from "../lib/quality-agent";
import { processNextDispatch } from "./workflow-worker";
import { prisma } from "../lib/prisma";

async function runPhase04Gate() {
  console.log("===============================================================================");
  console.log("PHASE 0.4 GATE TEST: DURABLE AGENT, SUPERVISOR APPROVAL & SIMULATOR READ-BACK");
  console.log("===============================================================================");

  const testBatch = await prisma.batch.create({
    data: {
      lotId: `#GATE04-${Date.now()}`,
      productType: "Submersible Pump Impeller Casting",
      supplierName: "PT Krakatau Scrap Ind.",
      materialNumber: "MAT-IMP-9842",
      workOrderId: "WO-2026-771",
      status: "held",
      storageZone: "quarantine",
      version: 1,
      caseEpoch: 1,
    },
  });

  const inspection = await prisma.inspection.create({
    data: {
      id: `INS-G04-${Date.now().toString().slice(-6)}`,
      batchId: testBatch.id,
      itemId: "ITEM-G04-1",
      outcome: "defect",
      confidence: 96.5,
      defectDetected: true,
      defectClass: "defect",
      status: "Ditahan",
      caseEpoch: 1,
      dataOrigin: "operational",
    },
  });

  const workflowRun = await prisma.workflowRun.create({
    data: {
      id: `RUN-G04-${Date.now().toString().slice(-6)}`,
      inspectionId: inspection.id,
      batchId: testBatch.id,
      caseEpoch: 1,
      contextSnapshot: { batchId: testBatch.id, itemId: "ITEM-G04-1" },
      policySnapshot: { policyId: "sigap-demo-quality-v1" },
      status: "running",
    },
  });

  try {
    // 1. Execute agent reasoning workflow
    console.log("1. Running durable quality workflow (Bedrock tool-loop)...");
    await runQualityWorkflow(workflowRun.id);

    // Verify logs
    const logs = await prisma.agentLog.findMany({
      where: { runId: workflowRun.id },
      orderBy: { sequence: "asc" },
    });

    console.log(`   Generated ${logs.length} sequenced AgentLog records.`);
    const stages = logs.map((l) => `${l.stage}:${l.stepName}`);
    console.log(`   Observed stages: ${stages.join(" -> ")}`);

    const hasMemory = logs.some((l) => l.stage === "MEMORY");
    const hasFormula = logs.some((l) => l.stage === "FORMULA");
    const hasDecision = logs.some((l) => l.stage === "DECISION");
    const hasDispatch = logs.some((l) => l.stage === "DISPATCH");

    if (!hasMemory || !hasFormula || !hasDecision || !hasDispatch) {
      throw new Error(`Missing expected stage groups in agent logs: observed ${stages.join(", ")}`);
    }
    console.log("   [PASS] Tool loop executed: context retrieved, formula evaluated, action proposed.");

    // Check created proposal
    const dispatches = await prisma.dispatchRecord.findMany({
      where: { runId: workflowRun.id },
    });

    if (dispatches.length === 0) {
      throw new Error("Expected at least 1 proposed DispatchRecord, found 0");
    }

    const proposedDispatch = dispatches[0];
    console.log(`   Proposed dispatch: ${proposedDispatch.id} (Action: ${proposedDispatch.actionType}, Status: ${proposedDispatch.status})`);
    if (proposedDispatch.status !== "pending_approval") {
      throw new Error(`Expected dispatch status 'pending_approval', found '${proposedDispatch.status}'`);
    }

    // 2. Simulate Supervisor Approval
    console.log("2. Simulating supervisor approval...");
    await prisma.dispatchRecord.update({
      where: { id: proposedDispatch.id },
      data: {
        status: "queued",
        approvedBy: "supervisor-auto-test",
        revision: { increment: 1 },
      },
    });

    // 3. Worker execution and simulator read-back
    console.log("3. Executing dispatch worker and persistent simulator read-back...");
    // Mock local simulator call within process by testing directly against route handler or mock API
    const didDispatch = await processNextDispatch();
    console.log(`   Worker executed dispatch: ${didDispatch}`);

    const verifiedDispatch = await prisma.dispatchRecord.findUnique({
      where: { id: proposedDispatch.id },
    });

    console.log(`   Final dispatch status: ${verifiedDispatch?.status}`);
    console.log(`   SAP Ticket ID: ${verifiedDispatch?.sapTicketId}`);

    if (verifiedDispatch?.status !== "verified") {
      throw new Error(`Expected dispatch status 'verified', got '${verifiedDispatch?.status}'`);
    }

    // Verify SimulatorRecord
    const simRecord = await prisma.simulatorRecord.findUnique({
      where: { actionKey: proposedDispatch.actionKey! },
    });
    console.log(`   Simulator record verified: External ID: ${simRecord?.externalId}, State: ${simRecord?.resultingState}`);

    if (!simRecord || simRecord.resultingState !== "OPEN") {
      throw new Error("Simulator record missing or state not 'OPEN'");
    }

    console.log("===============================================================================");
    console.log("PHASE 0.4 GATE PASSED: Durable agent loop, approval & read-back verified.");
    console.log("===============================================================================");
  } finally {
    // Cleanup test data
    await prisma.dispatchRecord.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.agentLog.deleteMany({ where: { inspectionId: inspection.id } });
    await prisma.workflowRun.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.inspection.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.batch.delete({ where: { id: testBatch.id } });
    await prisma.$disconnect();
  }
}

runPhase04Gate().catch((err) => {
  console.error("GATE FAILURE:", err);
  process.exit(1);
});
