import crypto from "crypto";
import jpeg from "jpeg-js";
import { ingestInspection, validateInspectionEvent, IngestError } from "../lib/inspection-service";
import { InspectionEvent } from "../lib/contracts";
import { prisma } from "../lib/prisma";

function createTestJpeg(width = 640, height = 480): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  // Fill with dummy color pattern
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = 100;
    buf[i + 1] = 150;
    buf[i + 2] = 200;
    buf[i + 3] = 255;
  }
  return jpeg.encode({ data: buf, width, height }, 50).data;
}

async function runPhase01Gate() {
  console.log("===============================================================================");
  console.log("PHASE 0.1 GATE TEST: VALIDATION, CONCURRENCY, IDEMPOTENCY, AND AUTH CHECKS");
  console.log("===============================================================================");

  process.env.SIGAP_TEST_MODE = "1";

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

  const testDevice = await prisma.device.upsert({
    where: { id: "test-pi-01" },
    update: {
      batchId: testBatch.id,
      enabled: true,
      bindingVersion: 1,
    },
    create: {
      id: "test-pi-01",
      tokenHash: crypto.createHash("sha256").update("test-device-token").digest("hex"),
      batchId: testBatch.id,
      enabled: true,
      bindingVersion: 1,
    },
  });

  const supervisorActor = {
    type: "user" as const,
    id: "test-supervisor",
    role: "supervisor" as const,
  };

  const deviceActor = {
    type: "device" as const,
    id: testDevice.id,
    deviceId: testDevice.id,
    batchId: testBatch.id,
  };

  const sampleBuffer = createTestJpeg(640, 480);
  const sampleSha256 = crypto.createHash("sha256").update(sampleBuffer).digest("hex");
  const sampleBase64 = sampleBuffer.toString("base64");
  const eventId = crypto.randomUUID();
  const itemId = "ITEM-TEST-001";

  const baseValidPayload: InspectionEvent = {
    schemaVersion: 1,
    eventId,
    deviceId: testDevice.id,
    batchId: testBatch.id,
    bindingVersion: 1,
    itemId,
    capturedAt: new Date().toISOString(),
    captureSource: "pi-file-replay",
    inferenceLocation: "pi",
    modelVersion: "test-model-v1",
    inferenceMs: 124.5,
    classificationMs: 42.3,
    localizationMs: 82.2,
    localizationStatus: "completed",
    localAlertMs: 44.8,
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
    // -------------------------------------------------------------------------
    // TEST 1: The 5 Invalid Events reproduced in audit must return 422
    // -------------------------------------------------------------------------
    console.log("1. Testing 5 Reproduced Invalid Event Failures (must reject with 422)...");

    // 1a. Absent probabilities / confidence
    let caught1a = false;
    try {
      const invalid = { ...baseValidPayload, eventId: crypto.randomUUID(), probabilities: undefined, confidence: undefined };
      validateInspectionEvent(invalid);
    } catch (err) {
      if (err instanceof IngestError && err.statusCode === 422) caught1a = true;
    }
    if (!caught1a) throw new Error("1a. Failed to reject absent probabilities/confidence with 422");
    console.log("   [PASS] 1a. Absent probabilities/confidence rejected with 422.");

    // 1b. coordinateSpace="pixels"
    let caught1b = false;
    try {
      const invalid = { ...baseValidPayload, eventId: crypto.randomUUID(), coordinateSpace: "pixels" as any };
      validateInspectionEvent(invalid);
    } catch (err) {
      if (err instanceof IngestError && err.statusCode === 422 && err.code === "INVALID_COORDINATE_SPACE") caught1b = true;
    }
    if (!caught1b) throw new Error("1b. Failed to reject coordinateSpace='pixels' with 422");
    console.log("   [PASS] 1b. coordinateSpace='pixels' rejected with 422.");

    // 1c. Contradictory outcome / probabilities
    let caught1c = false;
    try {
      const invalid = {
        ...baseValidPayload,
        eventId: crypto.randomUUID(),
        outcome: "defect" as const,
        probabilities: { ok: 0.95, defect: 0.05 },
        confidence: 95.0,
      };
      validateInspectionEvent(invalid);
    } catch (err) {
      if (err instanceof IngestError && err.statusCode === 422) caught1c = true;
    }
    if (!caught1c) throw new Error("1c. Failed to reject contradictory outcome/probabilities with 422");
    console.log("   [PASS] 1c. Contradictory outcome/probabilities rejected with 422.");

    // 1d. Box confidence 1000
    let caught1d = false;
    try {
      const invalid = {
        ...baseValidPayload,
        eventId: crypto.randomUUID(),
        boundingBoxes: [{ id: "box-1", label: "defect" as const, x: 10, y: 10, width: 20, height: 20, confidence: 1000 }],
      };
      validateInspectionEvent(invalid);
    } catch (err) {
      if (err instanceof IngestError && err.statusCode === 422 && err.code === "INVALID_BOX_CONFIDENCE") caught1d = true;
    }
    if (!caught1d) throw new Error("1d. Failed to reject box confidence 1000 with 422");
    console.log("   [PASS] 1d. Box confidence 1000 rejected with 422.");

    // 1e. Hashed non-image bytes
    let caught1e = false;
    try {
      const fakeBytes = Buffer.from("NOT_A_REAL_JPEG_IMAGE_DATA", "utf-8");
      const fakeSha = crypto.createHash("sha256").update(fakeBytes).digest("hex");
      const invalid = {
        ...baseValidPayload,
        eventId: crypto.randomUUID(),
        frame: {
          jpegBase64: fakeBytes.toString("base64"),
          sha256: fakeSha,
          width: 640,
          height: 480,
        },
      };
      validateInspectionEvent(invalid);
    } catch (err) {
      if (err instanceof IngestError && err.statusCode === 422 && err.code === "INVALID_JPEG") caught1e = true;
    }
    if (!caught1e) throw new Error("1e. Failed to reject hashed non-image bytes with 422");
    console.log("   [PASS] 1e. Hashed non-image bytes rejected with 422.");

    // Verify no DB mutations occurred during invalid validation
    const zeroInspections = await prisma.inspection.count({ where: { batchId: testBatch.id } });
    if (zeroInspections !== 0) throw new Error(`DB mutated during invalid tests: count=${zeroInspections}`);
    console.log("   [PASS] All 5 invalid events rejected with 422; 0 records written to DB.");

    // -------------------------------------------------------------------------
    // TEST 2: 10 Concurrent identical submissions -> exactly 1 write, 9 acks
    // -------------------------------------------------------------------------
    console.log("2. Executing 10 concurrent identical event submissions...");
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() => ingestInspection(baseValidPayload, deviceActor))
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

    // -------------------------------------------------------------------------
    // TEST 3: Fractional-millisecond timing columns persisted accurately
    // -------------------------------------------------------------------------
    console.log("3. Verifying fractional-millisecond timing columns in DB...");
    const saved = dbInspections[0];
    if (saved.inferenceMs !== 124.5) throw new Error(`Expected inferenceMs 124.5, got ${saved.inferenceMs}`);
    if (saved.classificationMs !== 42.3) throw new Error(`Expected classificationMs 42.3, got ${saved.classificationMs}`);
    if (saved.localizationMs !== 82.2) throw new Error(`Expected localizationMs 82.2, got ${saved.localizationMs}`);
    if (saved.localAlertMs !== 44.8) throw new Error(`Expected localAlertMs 44.8, got ${saved.localAlertMs}`);
    if (!saved.payloadHash) throw new Error("Expected saved.payloadHash to be non-empty");
    console.log("   [PASS] Fractional timings (124.5ms, 42.3ms, 82.2ms, 44.8ms) and payloadHash saved.");

    // -------------------------------------------------------------------------
    // TEST 4: Device bound to another batch is denied
    // -------------------------------------------------------------------------
    console.log("4. Testing device bound to another batch (must return 403 DEVICE_BATCH_MISMATCH)...");
    const otherBatch = await prisma.batch.create({
      data: {
        lotId: `#OTHER-BATCH-${Date.now()}`,
        productType: "Bracket Motor A7",
        status: "pending",
        storageZone: "standard",
      },
    });

    const foreignDeviceActor = {
      type: "device" as const,
      id: "foreign-pi-02",
      deviceId: "foreign-pi-02",
      batchId: otherBatch.id,
    };

    await prisma.device.upsert({
      where: { id: "foreign-pi-02" },
      update: { batchId: otherBatch.id, enabled: true, bindingVersion: 1 },
      create: {
        id: "foreign-pi-02",
        tokenHash: crypto.createHash("sha256").update("foreign-token").digest("hex"),
        batchId: otherBatch.id,
        enabled: true,
        bindingVersion: 1,
      },
    });

    let mismatchCaught = false;
    try {
      const foreignEvent: InspectionEvent = {
        ...baseValidPayload,
        eventId: crypto.randomUUID(),
        deviceId: "foreign-pi-02",
        batchId: testBatch.id, // Trying to ingest into testBatch while bound to otherBatch!
        itemId: "ITEM-FOREIGN-01",
      };
      await ingestInspection(foreignEvent, foreignDeviceActor);
    } catch (err) {
      if (err instanceof IngestError && err.code === "DEVICE_BATCH_MISMATCH" && err.statusCode === 403) {
        mismatchCaught = true;
      }
    }
    if (!mismatchCaught) {
      throw new Error("Failed to reject device from another batch with 403 DEVICE_BATCH_MISMATCH");
    }
    console.log("   [PASS] Device from another batch rejected with 403 DEVICE_BATCH_MISMATCH.");

    // -------------------------------------------------------------------------
    // TEST 5: Conflicting payload reuse on same event ID -> 409 EVENT_CONFLICT
    // -------------------------------------------------------------------------
    console.log("5. Testing eventId conflict with modified payload...");
    const conflictBuffer = createTestJpeg(640, 480);
    // alter a byte to create distinct hash
    conflictBuffer[100] = (conflictBuffer[100] + 1) % 255;
    const conflictSha256 = crypto.createHash("sha256").update(conflictBuffer).digest("hex");
    const conflictPayload: InspectionEvent = {
      ...baseValidPayload,
      frame: {
        jpegBase64: conflictBuffer.toString("base64"),
        sha256: conflictSha256,
        width: 640,
        height: 480,
      },
    };

    let conflictCaught = false;
    try {
      await ingestInspection(conflictPayload, deviceActor);
    } catch (err) {
      if (err instanceof IngestError && err.code === "EVENT_CONFLICT" && err.statusCode === 409) {
        conflictCaught = true;
      }
    }
    if (!conflictCaught) {
      throw new Error("Failed to reject conflicting event payload with 409 EVENT_CONFLICT");
    }
    console.log("   [PASS] Modified payload on existing eventId rejected with 409 EVENT_CONFLICT.");

    // -------------------------------------------------------------------------
    // TEST 6: Duplicate (batchId, itemId) with different eventId -> 409 ITEM_ALREADY_INSPECTED
    // -------------------------------------------------------------------------
    console.log("6. Testing (batchId, itemId) duplicate inspection prevention...");
    const newItemEventPayload: InspectionEvent = {
      ...baseValidPayload,
      eventId: crypto.randomUUID(), // new event ID
    };

    let itemAlreadyInspectedCaught = false;
    try {
      await ingestInspection(newItemEventPayload, deviceActor);
    } catch (err) {
      if (err instanceof IngestError && err.code === "ITEM_ALREADY_INSPECTED" && err.statusCode === 409) {
        itemAlreadyInspectedCaught = true;
      }
    }
    if (!itemAlreadyInspectedCaught) {
      throw new Error("Failed to reject repeated item inspection with 409 ITEM_ALREADY_INSPECTED");
    }
    console.log("   [PASS] Same item re-inspection rejected with 409 ITEM_ALREADY_INSPECTED.");

    // Cleanup otherBatch
    await prisma.device.deleteMany({ where: { id: "foreign-pi-02" } });
    await prisma.batch.delete({ where: { id: otherBatch.id } });

    console.log("===============================================================================");
    console.log("PHASE 0.1 GATE PASSED: All contracts, validations, and rules verified!");
    console.log("===============================================================================");
  } finally {
    // Cleanup test data
    await prisma.inspection.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.workflowRun.deleteMany({ where: { batchId: testBatch.id } });
    await prisma.device.deleteMany({ where: { id: "test-pi-01" } });
    await prisma.batch.delete({ where: { id: testBatch.id } });
    await prisma.$disconnect();
  }
}

runPhase01Gate().catch((err) => {
  console.error("GATE FAILURE:", err);
  process.exit(1);
});
