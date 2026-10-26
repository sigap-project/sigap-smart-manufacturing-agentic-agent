import crypto from "crypto";
import { ingestInspection, IngestError } from "../lib/inspection-service";
import { InspectionEvent } from "../lib/contracts";
import { prisma } from "../lib/prisma";

async function runPhase01Gate() {
  console.log("===============================================================================");
  console.log("PHASE 0.1 GATE TEST: CONCURRENCY, IDEMPOTENCY, AND CONFLICT VERIFICATION");
  console.log("===============================================================================");

  const testLotId = `#TEST-LOT-${Date.now()}`;
  const testBatch = await prisma.batch.create({
    data: {
      lotId: testLotId,
      productType: "Submersible Pump Impeller Casting",
      status: "pending",
      storageZone: "standard",
      version: 0,
      caseEpoch: 1,
    },
  });

  const actor = {
    type: "user" as const,
    id: "test-supervisor",
    role: "supervisor" as const,
  };

  const sampleBuffer = Buffer.from("DUMMY_JPEG_TEST_DATA", "utf-8");
  const sampleSha256 = crypto.createHash("sha256").update(sampleBuffer).digest("hex");
  const sampleBase64 = sampleBuffer.toString("base64");
  const eventId = crypto.randomUUID();
  const itemId = "ITEM-TEST-001";

  const eventPayload: InspectionEvent = {
    schemaVersion: 1,
    eventId,
    deviceId: "pi-01",
    batchId: testBatch.id,
    bindingVersion: 1,
    itemId,
    capturedAt: new Date().toISOString(),
    captureSource: "pi-file-replay",
    inferenceLocation: "pi",
    modelVersion: "test-model-v1",
    inferenceMs: 120,
    classificationMs: 40,
    localizationMs: 80,
    localizationStatus: "completed",
    localAlertMs: 45,
    outcome: "defect",
    probabilities: { ok: 0.1, defect: 0.9 },
    confidence: 90.0,
    frame: {
      jpegBase64: sampleBase64,
      sha256: sampleSha256,
      width: 640,
      height: 480,
    },
    coordinateSpace: "source-percent",
    boundingBoxes: [
      {
        id: "box-1",
        label: "defect",
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        confidence: 85,
      },
    ],
  };

  try {
    // 1. Ten concurrent submissions of the identical event
    console.log("1. Executing 10 concurrent identical event ingestions...");
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() => ingestInspection(eventPayload, actor))
    );

    const firstInspections = results.filter((r) => !r.duplicate);
    const duplicateInspections = results.filter((r) => r.duplicate);

    console.log(`   Initial (201 equivalent): ${firstInspections.length}`);
    console.log(`   Duplicate (200 equivalent): ${duplicateInspections.length}`);

    if (firstInspections.length !== 1 || duplicateInspections.length !== 9) {
      throw new Error(`Expected exactly 1 new write and 9 duplicates, got ${firstInspections.length} and ${duplicateInspections.length}`);
    }

    // Verify DB records
    const dbInspections = await prisma.inspection.findMany({
      where: { eventId },
    });
    if (dbInspections.length !== 1) {
      throw new Error(`Expected 1 Inspection row in DB, found ${dbInspections.length}`);
    }

    const updatedBatch = await prisma.batch.findUnique({
      where: { id: testBatch.id },
    });
    if (updatedBatch?.inspectionCount !== 1) {
      throw new Error(`Expected Batch inspectionCount to be 1, found ${updatedBatch?.inspectionCount}`);
    }
    if (updatedBatch?.defectCount !== 1) {
      throw new Error(`Expected Batch defectCount to be 1, found ${updatedBatch?.defectCount}`);
    }

    const workflowRuns = await prisma.workflowRun.findMany({
      where: { inspectionId: dbInspections[0].id },
    });
    if (workflowRuns.length !== 1) {
      throw new Error(`Expected 1 WorkflowRun in DB, found ${workflowRuns.length}`);
    }
    console.log("   [PASS] 10 concurrent requests -> exactly 1 inspection, 1 count, 1 workflow run.");

    // 2. Conflicting payload reuse on same event ID
    console.log("2. Testing eventId conflict with modified payload...");
    const conflictBuffer = Buffer.from("MODIFIED_JPEG_DATA", "utf-8");
    const conflictSha256 = crypto.createHash("sha256").update(conflictBuffer).digest("hex");
    const conflictPayload: InspectionEvent = {
      ...eventPayload,
      frame: {
        jpegBase64: conflictBuffer.toString("base64"),
        sha256: conflictSha256,
        width: 640,
        height: 480,
      },
    };

    let conflictCaught = false;
    try {
      await ingestInspection(conflictPayload, actor);
    } catch (err) {
      if (err instanceof IngestError && err.code === "EVENT_CONFLICT" && err.statusCode === 409) {
        conflictCaught = true;
      }
    }
    if (!conflictCaught) {
      throw new Error("Failed to reject conflicting event payload with 409 EVENT_CONFLICT");
    }
    console.log("   [PASS] Modified payload on existing eventId rejected with 409 EVENT_CONFLICT.");

    // 3. Reusing inspected item ID in same batch with new event ID
    console.log("3. Testing (batchId, itemId) duplicate inspection prevention...");
    const newItemEventPayload: InspectionEvent = {
      ...eventPayload,
      eventId: crypto.randomUUID(), // new event ID
    };

    let itemAlreadyInspectedCaught = false;
    try {
      await ingestInspection(newItemEventPayload, actor);
    } catch (err) {
      if (err instanceof IngestError && err.code === "ITEM_ALREADY_INSPECTED" && err.statusCode === 409) {
        itemAlreadyInspectedCaught = true;
      }
    }
    if (!itemAlreadyInspectedCaught) {
      throw new Error("Failed to reject repeated item inspection with 409 ITEM_ALREADY_INSPECTED");
    }
    console.log("   [PASS] Same item re-inspection rejected with 409 ITEM_ALREADY_INSPECTED.");

    console.log("===============================================================================");
    console.log("PHASE 0.1 GATE PASSED: All concurrency, idempotency, and conflict rules proven.");
    console.log("===============================================================================");
  } finally {
    // Cleanup test data
    await prisma.inspection.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.workflowRun.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.batch.delete({ where: { id: testBatch.id } });
    await prisma.$disconnect();
  }
}

runPhase01Gate().catch((err) => {
  console.error("GATE FAILURE:", err);
  process.exit(1);
});
