import crypto from "crypto";
import { runQualityWorkflow } from "../lib/quality-agent";
import { dispatchToSap, readBackFromSap } from "../lib/sap-client";
import { emitSigapEvent } from "../lib/events";
import { prisma } from "../lib/prisma";

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

const workerId = `worker-${process.pid}-${crypto.randomBytes(2).toString("hex")}`;

export async function processNextWorkflowRun(): Promise<boolean> {
  const now = new Date();
  const leaseExpiration = new Date(now.getTime() + 120 * 1000); // 120-second lease

  // Find a queued run or an executing run whose lease has expired
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

  // Max 5 attempts
  if (candidate.attempts >= 5) {
    await prisma.workflowRun.update({
      where: { id: candidate.id },
      data: {
        status: "needs_review",
        lastError: "Max workflow retry attempts (5) exhausted",
      },
    });
    return true;
  }

  // Claim lease atomically with leaseOwner
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
      leaseOwner: workerId,
      leaseUntil: leaseExpiration,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) return false;

  console.log(`[WORKER ${workerId}] Claimed WorkflowRun ${candidate.id} for inspection ${candidate.inspectionId}`);

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

  // Find an approved queued dispatch or an expired executing/verifying job
  const candidate = await prisma.dispatchRecord.findFirst({
    where: {
      OR: [
        { status: "queued" },
        { status: "executing", leaseUntil: { lt: now } },
        { status: "verifying", leaseUntil: { lt: now } }, // Reclaim crashed/abandoned verifying jobs
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { batch: true },
  });

  if (!candidate || !candidate.actionType || !candidate.actionKey || !candidate.payloadHash) {
    return false;
  }

  // Max 5 attempts
  if (candidate.attempts >= 5) {
    await prisma.dispatchRecord.update({
      where: { id: candidate.id },
      data: {
        status: "failed",
        errorCode: "MAX_DISPATCH_ATTEMPTS_EXCEEDED",
      },
    });
    return true;
  }

  const isReclaimedVerifying = candidate.status === "verifying";

  // Atomically claim dispatch record with leaseOwner
  const claimed = await prisma.dispatchRecord.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: "queued" },
        { status: "executing", leaseUntil: { lt: now } },
        { status: "verifying", leaseUntil: { lt: now } },
      ],
    },
    data: {
      status: isReclaimedVerifying ? "verifying" : "executing",
      leaseOwner: workerId,
      leaseUntil: leaseExpiration,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) return false;

  console.log(
    `[WORKER ${workerId}] Claimed dispatch ${candidate.id} (${candidate.actionType}, mode=${isReclaimedVerifying ? "reclaim-verifying" : "execute"})`
  );

  const consumerMap: Record<string, "SAP_QM" | "SAP_MM" | "SAP_PP"> = {
    CREATE_QUALITY_NOTIFICATION: "SAP_QM",
    HOLD_MATERIAL_LOT: "SAP_MM",
    HOLD_WORK_ORDER: "SAP_PP",
  };
  const consumer = consumerMap[candidate.actionType] || "SAP_QM";

  // Extract frozen target from immutable payload (no invented fallbacks!)
  const payloadObj = (candidate.payload as Record<string, unknown>) || {};
  const targetId = typeof payloadObj.targetId === "string" ? payloadObj.targetId : "";

  if (!targetId || targetId.trim() === "") {
    console.error(`[WORKER] Blocked dispatch ${candidate.id}: missing frozen target ID in approved payload`);
    await prisma.dispatchRecord.update({
      where: { id: candidate.id },
      data: {
        status: "failed",
        errorCode: "MISSING_FROZEN_TARGET",
      },
    });
    return true;
  }

  // If reclaimed while verifying: read back directly without re-invoking mutating POST
  if (isReclaimedVerifying) {
    console.log(`[WORKER] Re-verifying previously dispatched ${candidate.id} (External ID: ${candidate.sapTicketId})...`);
    const readBack = await readBackFromSap(candidate.actionKey, candidate.actionType as any);
    if (readBack.ok && readBack.resultingState) {
      const verified = await prisma.dispatchRecord.update({
        where: { id: candidate.id },
        data: {
          status: "verified",
          sapTicketId: readBack.externalId || candidate.sapTicketId,
          verifiedAt: new Date(),
        },
        include: { batch: true },
      });
      console.log(`[WORKER] Dispatch ${candidate.id} RE-VERIFIED successfully in state '${readBack.resultingState}'`);
      emitSigapEvent("dispatch:status_changed", verified);
      return true;
    }
  }

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

  // Persist external ID and transition to 'verifying' BEFORE read-back
  await prisma.dispatchRecord.update({
    where: { id: candidate.id },
    data: {
      status: "verifying",
      sapTicketId: dispatchRes.externalId,
    },
  });

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
  console.log(`SIGAP DURABLE WORKFLOW WORKER INITIALIZING (${workerId})`);
  console.log("===============================================================================");

  let running = true;
  const shutdown = () => {
    console.log("\n[WORKER] Gracefully shutting down...");
    running = false;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    try {
      const didWorkRun = await processNextWorkflowRun();
      const didDispatch = await processNextDispatch();

      if (!didWorkRun && !didDispatch) {
        await sleep(4000);
      }
    } catch (err) {
      console.error("[WORKER LOOP ERROR]:", err);
      await sleep(2000);
    }
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}
