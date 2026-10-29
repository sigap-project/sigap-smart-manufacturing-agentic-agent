import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { createSessionCookie } from "../lib/auth";
import { BrowserInspectionRequest } from "../lib/contracts";

const BASE_URL = process.env.SIGAP_BASE_URL || "http://localhost:3000";

async function main() {
  console.log("===============================================================================");
  console.log("BROWSER INSPECTION REGRESSION GATE: ENDPOINT, PROVENANCE, IDEMPOTENCY & AUTH");
  console.log(`Targeting: ${BASE_URL}`);
  console.log("===============================================================================");

  const okFixturePath = path.join(process.cwd(), "ai_models", "evaluation", "images", "eval_ok_001.jpg");
  const defFixturePath = path.join(process.cwd(), "ai_models", "evaluation", "images", "eval_def_001.jpg");

  const okBuffer = fs.readFileSync(okFixturePath);
  const defBuffer = fs.readFileSync(defFixturePath);
  const okSha256 = crypto.createHash("sha256").update(okBuffer).digest("hex");
  const defSha256 = crypto.createHash("sha256").update(defBuffer).digest("hex");
  const okBase64 = okBuffer.toString("base64");
  const defBase64 = defBuffer.toString("base64");

  // Create unique test batch
  const testLotId = `#TEST-BROWSER-${Date.now()}`;
  const testBatch = await prisma.batch.create({
    data: {
      lotId: testLotId,
      productType: "Submersible Pump Impeller Casting",
      status: "pending",
      storageZone: "standard",
      version: 0,
      caseEpoch: 1,
      dataOrigin: "operational",
    },
  });

  const createdInspectionIds: string[] = [];
  const createdEvidenceKeys: string[] = [];

  // Generate test session cookies
  const operatorUser = { userId: "test-op-01", role: "operator" as const, salt: "", passwordHash: "" };
  const viewerUser = { userId: "test-view-01", role: "viewer" as const, salt: "", passwordHash: "" };
  const { cookieValue: opCookie, csrfToken: opCsrf } = createSessionCookie(operatorUser);
  const { cookieValue: viewCookie, csrfToken: viewCsrf } = createSessionCookie(viewerUser);

  try {
    // -------------------------------------------------------------------------
    // 1. Submit browser-upload Inspection (OK Fixture)
    // -------------------------------------------------------------------------
    console.log("\n1. Testing POST /api/inspection/analyze with browser-upload (OK Fixture)...");
    const uploadEventId = crypto.randomUUID();
    const uploadItemId = `ITEM-UP-${Date.now()}`;
    const uploadPayload: BrowserInspectionRequest = {
      eventId: uploadEventId,
      batchId: testBatch.id,
      itemId: uploadItemId,
      capturedAt: new Date().toISOString(),
      captureSource: "browser-upload",
      jpegBase64: okBase64,
    };

    const res1 = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": opCsrf,
      },
      body: JSON.stringify(uploadPayload),
    });

    if (res1.status !== 201) {
      const errText = await res1.text();
      throw new Error(`Expected 201 for browser-upload, got ${res1.status}: ${errText}`);
    }

    const data1 = await res1.json();
    if (!data1.success || data1.data.duplicate) {
      throw new Error(`Expected initial non-duplicate creation, got: ${JSON.stringify(data1)}`);
    }

    const ins1 = data1.data.inspection;
    createdInspectionIds.push(ins1.id);
    console.log(`   [PASS] Created inspection: ${ins1.id}`);
    console.log(`   [PASS] Stored imageUrl: ${ins1.imageUrl}`);

    // Verify DB record
    const dbRecord1 = await prisma.inspection.findUnique({
      where: { id: ins1.id },
      include: { workflowRun: true, agentLogs: true },
    });

    if (!dbRecord1) throw new Error("DB record not found for created inspection");
    if (dbRecord1.captureSource !== "browser-upload") {
      throw new Error(`Expected captureSource 'browser-upload', got '${dbRecord1.captureSource}'`);
    }
    if (dbRecord1.inferenceLocation !== "server") {
      throw new Error(`Expected inferenceLocation 'server', got '${dbRecord1.inferenceLocation}'`);
    }
    if (dbRecord1.deviceId !== null) {
      throw new Error(`Expected null deviceId, got '${dbRecord1.deviceId}'`);
    }
    if (dbRecord1.bindingVersion !== 1) {
      throw new Error(`Expected bindingVersion 1, got ${dbRecord1.bindingVersion}`);
    }
    if (dbRecord1.dataOrigin !== "operational") {
      throw new Error(`Expected operational dataOrigin, got ${dbRecord1.dataOrigin}`);
    }
    if (dbRecord1.imageSha256?.toLowerCase() !== okSha256.toLowerCase()) {
      throw new Error(`Stored SHA-256 mismatch: expected ${okSha256}, got ${dbRecord1.imageSha256}`);
    }
    if (!dbRecord1.workflowRun) {
      throw new Error("WorkflowRun record was not created transactionally");
    }
    if (dbRecord1.agentLogs.length === 0 || dbRecord1.agentLogs[0].stage !== "DETECT") {
      throw new Error("DETECT agent log was not created");
    }
    if (dbRecord1.imageKey) createdEvidenceKeys.push(dbRecord1.imageKey);

    const batchAfter1 = await prisma.batch.findUnique({ where: { id: testBatch.id } });
    if (!batchAfter1 || batchAfter1.inspectionCount !== 1) {
      throw new Error(`Expected batch inspectionCount 1, got ${batchAfter1?.inspectionCount}`);
    }
    console.log("   [PASS] DB record validated: null deviceId, server location, workflow queued, batch count 1.");

    // -------------------------------------------------------------------------
    // 2. Submit browser-webcam Inspection (Defect Fixture)
    // -------------------------------------------------------------------------
    console.log("\n2. Testing POST /api/inspection/analyze with browser-webcam (Defect Fixture)...");
    const camEventId = crypto.randomUUID();
    const camItemId = `ITEM-CAM-${Date.now()}`;
    const camPayload: BrowserInspectionRequest = {
      eventId: camEventId,
      batchId: testBatch.id,
      itemId: camItemId,
      capturedAt: new Date().toISOString(),
      captureSource: "browser-webcam",
      jpegBase64: defBase64,
    };

    const res2 = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": opCsrf,
      },
      body: JSON.stringify(camPayload),
    });

    if (res2.status !== 201) {
      const errText = await res2.text();
      throw new Error(`Expected 201 for browser-webcam, got ${res2.status}: ${errText}`);
    }

    const data2 = await res2.json();
    const ins2 = data2.data.inspection;
    createdInspectionIds.push(ins2.id);

    const dbRecord2 = await prisma.inspection.findUnique({
      where: { id: ins2.id },
    });
    if (!dbRecord2) throw new Error("DB record not found for webcam inspection");
    if (dbRecord2.captureSource !== "browser-webcam") {
      throw new Error(`Expected captureSource 'browser-webcam', got '${dbRecord2.captureSource}'`);
    }
    if (dbRecord2.outcome !== "defect") {
      throw new Error(`Expected outcome 'defect', got '${dbRecord2.outcome}'`);
    }
    if (dbRecord2.defectClass !== "defect") {
      throw new Error(`Expected defectClass 'defect', got '${dbRecord2.defectClass}'`);
    }
    if (!Array.isArray(dbRecord2.boundingBoxes) || (dbRecord2.boundingBoxes as any[]).length === 0) {
      throw new Error("Expected boundingBoxes on defect outcome");
    }
    if (dbRecord2.imageKey) createdEvidenceKeys.push(dbRecord2.imageKey);

    const batchAfter2 = await prisma.batch.findUnique({ where: { id: testBatch.id } });
    if (!batchAfter2 || batchAfter2.inspectionCount !== 2 || batchAfter2.defectCount !== 1) {
      throw new Error(`Expected batch inspectionCount 2 and defectCount 1, got ${batchAfter2?.inspectionCount}, ${batchAfter2?.defectCount}`);
    }
    console.log("   [PASS] Webcam inspection created: defect outcome, boxes persisted, batch count 2, defect count 1.");

    // -------------------------------------------------------------------------
    // 3. Exact Duplicate Replay -> 200 OK with duplicate: true
    // -------------------------------------------------------------------------
    console.log("\n3. Testing exact replay of eventId...");
    const resReplay = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": opCsrf,
      },
      body: JSON.stringify(uploadPayload),
    });

    if (resReplay.status !== 200) {
      throw new Error(`Expected 200 for replay, got ${resReplay.status}`);
    }
    const replayData = await resReplay.json();
    if (!replayData.success || !replayData.data.duplicate || replayData.data.inspection.id !== ins1.id) {
      throw new Error(`Expected duplicate=true with id ${ins1.id}, got ${JSON.stringify(replayData)}`);
    }
    const batchAfterReplay = await prisma.batch.findUnique({ where: { id: testBatch.id } });
    if (batchAfterReplay?.inspectionCount !== 2) {
      throw new Error(`Duplicate replay must not increment batch count: ${batchAfterReplay?.inspectionCount}`);
    }
    console.log("   [PASS] Exact duplicate acknowledged with 200, duplicate: true, 0 count increment.");

    // -------------------------------------------------------------------------
    // 4. Conflicting Event Reuse (Same eventId, different image) -> 409 EVENT_CONFLICT
    // -------------------------------------------------------------------------
    console.log("\n4. Testing modified payload on existing eventId...");
    const conflictRes = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": opCsrf,
      },
      body: JSON.stringify({
        ...uploadPayload,
        jpegBase64: defBase64, // Different image
      }),
    });
    if (conflictRes.status !== 409) {
      throw new Error(`Expected 409 for event conflict, got ${conflictRes.status}`);
    }
    const conflictData = await conflictRes.json();
    if (conflictData.code !== "EVENT_CONFLICT") {
      throw new Error(`Expected code EVENT_CONFLICT, got ${conflictData.code}`);
    }
    console.log("   [PASS] Conflicting payload rejected with 409 EVENT_CONFLICT.");

    // -------------------------------------------------------------------------
    // 5. Item Already Inspected in Batch -> 409 ITEM_ALREADY_INSPECTED
    // -------------------------------------------------------------------------
    console.log("\n5. Testing new eventId on already inspected itemId...");
    const duplicateItemRes = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": opCsrf,
      },
      body: JSON.stringify({
        ...uploadPayload,
        eventId: crypto.randomUUID(), // New event ID
        // Same batchId and itemId
      }),
    });
    if (duplicateItemRes.status !== 409) {
      throw new Error(`Expected 409 for item already inspected, got ${duplicateItemRes.status}`);
    }
    const duplicateItemData = await duplicateItemRes.json();
    if (duplicateItemData.code !== "ITEM_ALREADY_INSPECTED") {
      throw new Error(`Expected code ITEM_ALREADY_INSPECTED, got ${duplicateItemData.code}`);
    }
    console.log("   [PASS] Reused item rejected with 409 ITEM_ALREADY_INSPECTED.");

    // -------------------------------------------------------------------------
    // 6. Auth and Input Rejections
    // -------------------------------------------------------------------------
    console.log("\n6. Testing Auth and Input Rejections...");

    // 6a. No session cookie -> 401
    const resNoAuth = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uploadPayload),
    });
    if (resNoAuth.status !== 401) throw new Error(`Expected 401 without cookie, got ${resNoAuth.status}`);
    console.log("   [PASS] 6a. Missing session cookie -> 401 UNAUTHORIZED");

    // 6b. Viewer role -> 403
    const resViewer = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${viewCookie}`,
        "x-csrf-token": viewCsrf,
      },
      body: JSON.stringify(uploadPayload),
    });
    if (resViewer.status !== 403) throw new Error(`Expected 403 for viewer role, got ${resViewer.status}`);
    console.log("   [PASS] 6b. Viewer role -> 403 FORBIDDEN");

    // 6c. Invalid CSRF -> 403
    const resBadCsrf = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": "bad-csrf-token-12345",
      },
      body: JSON.stringify(uploadPayload),
    });
    if (resBadCsrf.status !== 403) throw new Error(`Expected 403 for bad CSRF, got ${resBadCsrf.status}`);
    console.log("   [PASS] 6c. Invalid CSRF token -> 403 INVALID_CSRF");

    // 6d. Malformed JSON -> 400
    const resMalformed = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": opCsrf,
      },
      body: "{ not json",
    });
    if (resMalformed.status !== 400) throw new Error(`Expected 400 for malformed JSON, got ${resMalformed.status}`);
    console.log("   [PASS] 6d. Malformed JSON -> 400 MALFORMED_JSON");

    // 6e. Nonexistent batch -> 404
    const resNoBatch = await fetch(`${BASE_URL}/api/inspection/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sigap_session=${opCookie}`,
        "x-csrf-token": opCsrf,
      },
      body: JSON.stringify({
        ...uploadPayload,
        eventId: crypto.randomUUID(),
        batchId: "nonexistent-batch-id",
        itemId: "ITEM-NO-BATCH",
      }),
    });
    if (resNoBatch.status !== 404) throw new Error(`Expected 404 for nonexistent batch, got ${resNoBatch.status}`);
    console.log("   [PASS] 6e. Nonexistent batch -> 404 BATCH_NOT_FOUND");

    // 6f. Internal Pi endpoint rejects browser provenance -> 403
    console.log("\n7. Testing that internal Pi route rejects browser provenance...");
    const internalRes = await fetch(`${BASE_URL}/api/internal/inspection-result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.INTERNAL_API_KEY || "sigap-internal-dev-key-2026"}`,
      },
      body: JSON.stringify({
        schemaVersion: 1,
        eventId: crypto.randomUUID(),
        deviceId: null,
        batchId: testBatch.id,
        bindingVersion: 1,
        itemId: "ITEM-INTERNAL-REJECT",
        capturedAt: new Date().toISOString(),
        captureSource: "browser-upload",
        inferenceLocation: "server",
        modelVersion: "4c762ef2a0c3d2e1f5d9dd21b2dda9ff74e8ce7c7cce95047ac306ea2a67e6de",
        inferenceMs: 50,
        classificationMs: 50,
        localizationMs: null,
        localizationStatus: "skipped",
        localAlertMs: null,
        outcome: "ok",
        probabilities: { ok: 0.99, defect: 0.01 },
        confidence: 99.0,
        frame: {
          jpegBase64: okBase64,
          sha256: okSha256,
          width: 512,
          height: 512,
        },
        coordinateSpace: "source-percent",
        boundingBoxes: [],
      }),
    });
    if (internalRes.status !== 403) {
      throw new Error(`Expected internal Pi route to reject browser provenance with 403, got ${internalRes.status}`);
    }
    console.log("   [PASS] Internal Pi route rejected browser provenance with 403 FORBIDDEN.");

    console.log("\n===============================================================================");
    console.log("BROWSER INSPECTION REGRESSION GATE PASSED! All requirements verified.");
    console.log("===============================================================================");
  } finally {
    console.log("\nCleaning up test fixtures...");
    for (const id of createdInspectionIds) {
      await prisma.agentLog.deleteMany({ where: { inspectionId: id } }).catch(() => {});
      await prisma.workflowRun.deleteMany({ where: { inspectionId: id } }).catch(() => {});
      await prisma.inspection.deleteMany({ where: { id } }).catch(() => {});
    }
    await prisma.batch.deleteMany({ where: { id: testBatch.id } }).catch(() => {});
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  }
}

main().catch((err) => {
  console.error("\n[TEST REGRESSION GATE FAILED]:", err);
  process.exit(1);
});
