import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { runQualityWorkflow } from "../lib/quality-agent";
import { processNextDispatch } from "./workflow-worker";
import { createSessionCookie } from "../lib/auth";
import { PATCH as approveDispatch } from "../app/api/dispatch/[id]/approve/route";
import { PATCH as rejectDispatch } from "../app/api/dispatch/[id]/reject/route";
import { PATCH as approveBatch } from "../app/api/batches/[id]/approve/route";
import { PATCH as reviewInspection } from "../app/api/inspections/[id]/review/route";
import { prisma } from "../lib/prisma";

async function runPhase04Gate() {
  console.log("===============================================================================");
  console.log("PHASE 0.4 GATE TEST: DURABLE AGENT, HTTP APPROVAL BOUNDARIES & SIMULATOR READ-BACK");
  console.log("===============================================================================");

  process.env.SIGAP_TEST_MODE = "1";

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
      capturedAt: new Date(),
      receivedAt: new Date(),
    },
  });

  const workflowRun = await prisma.workflowRun.create({
    data: {
      id: `RUN-G04-${Date.now().toString().slice(-6)}`,
      inspectionId: inspection.id,
      batchId: testBatch.id,
      caseEpoch: 1,
      contextSnapshot: { batchId: testBatch.id, itemId: "ITEM-G04-1" },
      policySnapshot: JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "quality-policy.json"), "utf-8")),
      status: "running",
    },
  });

  // Create real signed session cookies for testing HTTP authorization boundaries
  const supervisorUser = { userId: "test-supervisor", role: "supervisor" as const, salt: "", passwordHash: "" };
  const { cookieValue: supervisorCookie, csrfToken: supervisorCsrf } = createSessionCookie(supervisorUser);

  const operatorUser = { userId: "test-operator", role: "operator" as const, salt: "", passwordHash: "" };
  const { cookieValue: operatorCookie, csrfToken: operatorCsrf } = createSessionCookie(operatorUser);

  try {
    // -------------------------------------------------------------------------
    // 1. Execute agent reasoning workflow
    // -------------------------------------------------------------------------
    console.log("1. Running durable quality workflow (Bedrock tool-loop)...");
    await runQualityWorkflow(workflowRun.id);

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

    if (!hasMemory || !hasFormula || !hasDecision) {
      throw new Error(`Missing expected stage groups in agent logs: observed ${stages.join(", ")}`);
    }
    console.log("   [PASS] Tool loop executed: context retrieved, formula evaluated, action proposed.");

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

    // -------------------------------------------------------------------------
    // 2. HTTP Authorization Boundaries for Dispatch Approval (Actual Routes)
    // -------------------------------------------------------------------------
    console.log("2. Testing HTTP authorization boundaries on PATCH /api/dispatch/[id]/approve...");

    // 2a. Logged-out (anonymous) -> 401
    const reqAnon = new NextRequest(`http://localhost:3000/api/dispatch/${proposedDispatch.id}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: 1, expectedBatchVersion: 1, reason: "Test approve" }),
    });
    const resAnon = await approveDispatch(reqAnon, { params: Promise.resolve({ id: proposedDispatch.id }) });
    if (resAnon.status !== 401) throw new Error(`Expected anonymous approve to return 401, got ${resAnon.status}`);
    console.log("   [PASS] 2a. Anonymous approval rejected with 401.");

    // 2b. Operator role -> 403
    const reqOp = new NextRequest(`http://localhost:3000/api/dispatch/${proposedDispatch.id}/approve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${operatorCookie}`,
        "x-csrf-token": operatorCsrf,
      },
      body: JSON.stringify({ expectedRevision: 1, expectedBatchVersion: 1, reason: "Operator approve" }),
    });
    const resOp = await approveDispatch(reqOp, { params: Promise.resolve({ id: proposedDispatch.id }) });
    if (resOp.status !== 403) throw new Error(`Expected operator approve to return 403, got ${resOp.status}`);
    console.log("   [PASS] 2b. Operator approval rejected with 403.");

    // 2c. Supervisor with stale revision -> 409
    const reqStale = new NextRequest(`http://localhost:3000/api/dispatch/${proposedDispatch.id}/approve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${supervisorCookie}`,
        "x-csrf-token": supervisorCsrf,
      },
      body: JSON.stringify({ expectedRevision: 999, expectedBatchVersion: 1, reason: "Stale approve" }),
    });
    const resStale = await approveDispatch(reqStale, { params: Promise.resolve({ id: proposedDispatch.id }) });
    if (resStale.status !== 409) throw new Error(`Expected stale revision to return 409, got ${resStale.status}`);
    console.log("   [PASS] 2c. Stale revision rejected with 409.");

    // 2d. Valid supervisor approval -> 200, status queued
    const reqValid = new NextRequest(`http://localhost:3000/api/dispatch/${proposedDispatch.id}/approve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${supervisorCookie}`,
        "x-csrf-token": supervisorCsrf,
      },
      body: JSON.stringify({
        expectedRevision: proposedDispatch.revision,
        expectedBatchVersion: testBatch.version,
        reason: "Authorized quality notification for supplier follow-up",
      }),
    });
    const resValid = await approveDispatch(reqValid, { params: Promise.resolve({ id: proposedDispatch.id }) });
    if (resValid.status !== 200) {
      const errText = await resValid.text();
      throw new Error(`Expected valid supervisor approve to return 200, got ${resValid.status}: ${errText}`);
    }

    const approvedInDb = await prisma.dispatchRecord.findUnique({ where: { id: proposedDispatch.id } });
    if (approvedInDb?.status !== "queued") {
      throw new Error(`Expected dispatch status 'queued' after approval, got '${approvedInDb?.status}'`);
    }
    console.log("   [PASS] 2d. Valid supervisor approval transitioned status to 'queued'.");

    // -------------------------------------------------------------------------
    // 3. Worker Execution and Simulator Read-back
    // -------------------------------------------------------------------------
    console.log("3. Executing dispatch worker and persistent simulator read-back...");
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

    const simRecord = await prisma.simulatorRecord.findUnique({
      where: { actionKey: proposedDispatch.actionKey! },
    });
    console.log(`   Simulator record verified: External ID: ${simRecord?.externalId}, State: ${simRecord?.resultingState}`);

    if (!simRecord || simRecord.resultingState !== "OPEN") {
      throw new Error("Simulator record missing or state not 'OPEN'");
    }
    console.log("   [PASS] Simulator execution and read-back verified in state 'OPEN'.");

    // -------------------------------------------------------------------------
    // 4. Batch Release Governance: Hold Active and Unreviewed Suspect Checks
    // -------------------------------------------------------------------------
    console.log("4. Testing batch release governance (ERP hold active & suspect unresolved checks)...");

    // 4a. Active ERP hold blocks release
    // Create an active verified ERP hold on this batch
    const erpHoldDispatch = await prisma.dispatchRecord.create({
      data: {
        id: `DSP-HOLD-${Date.now().toString().slice(-6)}`,
        batchId: testBatch.id,
        triggerReason: "Test material hold",
        consumer: "SAP_MM",
        actionType: "HOLD_MATERIAL_LOT",
        actionKey: `${testBatch.id}:1:HOLD_MATERIAL_LOT`,
        payload: { targetId: "MAT-IMP-9842" },
        status: "verified",
        payloadHash: "fake-hold-hash",
      },
    });

    const currentBatch = await prisma.batch.findUnique({ where: { id: testBatch.id } });

    const reqHoldBlock = new NextRequest(`http://localhost:3000/api/batches/${testBatch.id}/approve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${supervisorCookie}`,
        "x-csrf-token": supervisorCsrf,
      },
      body: JSON.stringify({ expectedBatchVersion: currentBatch?.version, reason: "Try release with active hold" }),
    });
    const resHoldBlock = await approveBatch(reqHoldBlock, { params: Promise.resolve({ id: testBatch.id }) });
    if (resHoldBlock.status !== 409) {
      throw new Error(`Expected release to be blocked by active ERP hold with 409, got ${resHoldBlock.status}`);
    }
    console.log("   [PASS] 4a. Batch release blocked by active verified ERP hold (409 ERP_HOLD_ACTIVE).");

    // Remove the ERP hold to test suspect check
    await prisma.dispatchRecord.delete({ where: { id: erpHoldDispatch.id } });

    // 4b. Unreviewed suspect blocks release
    const reqSuspectBlock = new NextRequest(`http://localhost:3000/api/batches/${testBatch.id}/approve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${supervisorCookie}`,
        "x-csrf-token": supervisorCsrf,
      },
      body: JSON.stringify({ expectedBatchVersion: currentBatch?.version, reason: "Try release with unreviewed defect" }),
    });
    const resSuspectBlock = await approveBatch(reqSuspectBlock, { params: Promise.resolve({ id: testBatch.id }) });
    if (resSuspectBlock.status !== 409) {
      throw new Error(`Expected release to be blocked by unreviewed suspect with 409, got ${resSuspectBlock.status}`);
    }
    console.log("   [PASS] 4b. Batch release blocked by unreviewed suspect inspection (409).");

    // 4c. Review suspect to 'confirmed_ok'
    console.log("4c. Reviewing suspect to 'confirmed_ok' via PATCH /api/inspections/[id]/review...");
    const batchBeforeReview = await prisma.batch.findUnique({ where: { id: testBatch.id } });
    const reqReview = new NextRequest(`http://localhost:3000/api/inspections/${inspection.id}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${supervisorCookie}`,
        "x-csrf-token": supervisorCsrf,
      },
      body: JSON.stringify({
        reviewOutcome: "confirmed_ok",
        reason: "Visual re-inspection confirms casting flash only; dimensional integrity passed.",
        expectedBatchVersion: batchBeforeReview?.version,
      }),
    });
    const resReview = await reviewInspection(reqReview, { params: Promise.resolve({ id: inspection.id }) });
    if (resReview.status !== 200) {
      const errText = await resReview.text();
      throw new Error(`Expected inspection review to return 200, got ${resReview.status}: ${errText}`);
    }
    console.log("   [PASS] 4c. Suspect inspection successfully reviewed and confirmed as 'confirmed_ok'.");

    // 4d. Release batch now succeeds
    console.log("4d. Authorizing clean batch release via PATCH /api/batches/[id]/approve...");
    const batchBeforeRelease = await prisma.batch.findUnique({ where: { id: testBatch.id } });
    const reqCleanRelease = new NextRequest(`http://localhost:3000/api/batches/${testBatch.id}/approve`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${supervisorCookie}`,
        "x-csrf-token": supervisorCsrf,
      },
      body: JSON.stringify({
        expectedBatchVersion: batchBeforeRelease?.version,
        reason: "Supervisor confirms all suspects reviewed; batch released for manufacturing.",
      }),
    });
    const resCleanRelease = await approveBatch(reqCleanRelease, { params: Promise.resolve({ id: testBatch.id }) });
    if (resCleanRelease.status !== 200) {
      const errText = await resCleanRelease.text();
      throw new Error(`Expected clean release to return 200, got ${resCleanRelease.status}: ${errText}`);
    }

    const releasedBatch = await prisma.batch.findUnique({ where: { id: testBatch.id } });
    if (releasedBatch?.status !== "released" || releasedBatch.caseEpoch !== 2) {
      throw new Error(`Expected released batch in status 'released' and caseEpoch 2, got status='${releasedBatch?.status}', caseEpoch=${releasedBatch?.caseEpoch}`);
    }
    console.log("   [PASS] 4d. Clean batch release succeeded (status='released', caseEpoch=2).");

    console.log("===============================================================================");
    console.log("PHASE 0.4 & 0.5 GATES PASSED: Durable agent, approvals, governance & release verified!");
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
