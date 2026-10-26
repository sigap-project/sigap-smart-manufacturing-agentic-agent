import { runQualityWorkflow } from "../lib/quality-agent";
import { dispatchToSap, readBackFromSap } from "../lib/sap-client";
import { emitSigapEvent } from "../lib/events";
import { prisma } from "../lib/prisma";

export async function processNextWorkflowRun(): Promise<boolean> {
  const now = new Date();
  const leaseExpiration = new Date(now.getTime() + 120 * 1000); // 120-second lease

  // Find a queued run or a crashed run whose lease has expired
  const candidate = await prisma.workflowRun.findFirst({
    where: {
      OR: [
        { status: "queued" },
        {
          status: "running",
          leaseUntil: { lt: now },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (!candidate) return false;

  // Claim lease atomically
  const claimed = await prisma.workflowRun.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: "queued" },
        { status: "running", leaseUntil: { lt: now } },
      ],
    },
    data: {
      status: "running",
      leaseUntil: leaseExpiration,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) return false;

  console.log(`[WORKER] Claimed WorkflowRun ${candidate.id} for inspection ${candidate.inspectionId}`);

  try {
    await runQualityWorkflow(candidate.id);
    console.log(`[WORKER] WorkflowRun ${candidate.id} completed successfully`);
  } catch (err) {
    console.error(`[WORKER ERROR] WorkflowRun ${candidate.id} failed:`, err);
    await prisma.workflowRun.update({
      where: { id: candidate.id },
      data: {
        status: "needs_review",
        lastError: err instanceof Error ? err.message : "Unknown workflow failure",
      },
    });
  }

  return true;
}

export async function processNextDispatch(): Promise<boolean> {
  const now = new Date();
  const leaseExpiration = new Date(now.getTime() + 120 * 1000);

  // Find an approved queued dispatch
  const candidate = await prisma.dispatchRecord.findFirst({
    where: {
      OR: [
        { status: "queued" },
        { status: "executing", leaseUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { batch: true },
  });

  if (!candidate || !candidate.actionType || !candidate.actionKey || !candidate.payloadHash) {
    return false;
  }

  const claimed = await prisma.dispatchRecord.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: "queued" },
        { status: "executing", leaseUntil: { lt: now } },
      ],
    },
    data: {
      status: "executing",
      leaseUntil: leaseExpiration,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) return false;

  console.log(`[WORKER] Executing dispatch ${candidate.id} (Action: ${candidate.actionType})`);

  const consumerMap: Record<string, "SAP_QM" | "SAP_MM" | "SAP_PP"> = {
    CREATE_QUALITY_NOTIFICATION: "SAP_QM",
    HOLD_MATERIAL_LOT: "SAP_MM",
    HOLD_WORK_ORDER: "SAP_PP",
  };

  const consumer = consumerMap[candidate.actionType] || "SAP_QM";
  const targetId =
    candidate.actionType === "HOLD_WORK_ORDER"
      ? candidate.batch.workOrderId || "WO-2026-771"
      : candidate.batch.materialNumber || "MAT-IMP-9842";

  // 1. Dispatch to SAP simulator
  const dispatchRes = await dispatchToSap({
    actionKey: candidate.actionKey,
    actionType: candidate.actionType as any,
    consumer,
    targetId,
    payloadHash: candidate.payloadHash,
    batchId: candidate.batchId,
    details: (candidate.payload as Record<string, unknown>) || {},
  });

  if (!dispatchRes.ok) {
    console.error(`[WORKER] Dispatch failed for ${candidate.id}: ${dispatchRes.error}`);
    await prisma.dispatchRecord.update({
      where: { id: candidate.id },
      data: {
        status: dispatchRes.retryable ? "queued" : "failed",
        errorCode: dispatchRes.code,
      },
    });
    return true;
  }

  // 2. Read back from simulator to verify state transition
  console.log(`[WORKER] Dispatched ${candidate.id} -> External ID: ${dispatchRes.externalId}. Verifying state...`);
  const readBack = await readBackFromSap(candidate.actionKey, candidate.actionType as any);

  if (readBack.ok && readBack.resultingState === dispatchRes.resultingState) {
    const verified = await prisma.dispatchRecord.update({
      where: { id: candidate.id },
      data: {
        status: "verified",
        sapTicketId: dispatchRes.externalId,
        sapResponse: JSON.parse(JSON.stringify(dispatchRes.response)),
        verifiedAt: new Date(),
      },
      include: { batch: true },
    });

    console.log(`[WORKER] Dispatch ${candidate.id} VERIFIED in state '${readBack.resultingState}'`);
    emitSigapEvent("dispatch:status_changed", verified);
  } else {
    console.warn(`[WORKER] Verification pending for ${candidate.id}: ${readBack.error || "state mismatch"}`);
    await prisma.dispatchRecord.update({
      where: { id: candidate.id },
      data: {
        status: "verifying",
        sapTicketId: dispatchRes.externalId,
      },
    });
  }

  return true;
}

async function main() {
  console.log("===============================================================================");
  console.log("SIGAP DURABLE WORKFLOW WORKER INITIALIZING");
  console.log("===============================================================================");

  let running = true;
  process.on("SIGINT", () => {
    console.log("\n[WORKER] Gracefully shutting down...");
    running = false;
  });

  while (running) {
    try {
      const didWorkRun = await processNextWorkflowRun();
      const didDispatch = await processNextDispatch();

      if (!didWorkRun && !didDispatch) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error("[WORKER LOOP ERROR]:", err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}
