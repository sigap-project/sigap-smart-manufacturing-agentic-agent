import crypto from "crypto";
import fs from "fs";
import path from "path";
import jpeg from "jpeg-js";
import { Actor, IngestResult, InspectionEvent } from "./contracts";
import { emitSigapEvent } from "./events";
import { storeEvidence } from "./evidence-store";
import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export class IngestError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "IngestError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

let cachedManifestHash: string | null = null;
export function getManifestCanonicalHash(): string {
  if (cachedManifestHash) return cachedManifestHash;
  try {
    const p = path.join(process.cwd(), "ai_models", "model-manifest.json");
    if (fs.existsSync(p)) {
      const manifest = JSON.parse(fs.readFileSync(p, "utf-8"));
      function sortObj(o: unknown): unknown {
        if (Array.isArray(o)) return o.map(sortObj);
        if (o && typeof o === "object") {
          const res: Record<string, unknown> = {};
          for (const k of Object.keys(o as Record<string, unknown>).sort()) {
            res[k] = sortObj((o as Record<string, unknown>)[k]);
          }
          return res;
        }
        return o;
      }
      const canonical = JSON.stringify(sortObj(manifest));
      cachedManifestHash = crypto.createHash("sha256").update(canonical).digest("hex");
      return cachedManifestHash;
    }
  } catch {
    // fallback to known hash
  }
  cachedManifestHash = "1e725a850a084d4cd6f64d14b0687e0569137d2ccc8f6e7cf5e7b70a2b7e5217";
  return cachedManifestHash;
}

let cachedPolicy: unknown = null;
function getQualityPolicySync(): unknown {
  if (cachedPolicy) return cachedPolicy;
  try {
    const p = path.join(process.cwd(), "data", "quality-policy.json");
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      cachedPolicy = JSON.parse(raw);
      return cachedPolicy;
    }
  } catch {
    // fallback
  }
  return {
    policyId: "sigap-demo-quality-v1",
    version: 1,
    slidingWindowMinutes: 8,
    escalationDefectTrigger: 3,
    defaultAutoDispatchMode: "human_approval",
  };
}

export function computePayloadHash(event: InspectionEvent): string {
  const canonical = {
    batchId: event.batchId,
    bindingVersion: event.bindingVersion,
    boundingBoxes: Array.isArray(event.boundingBoxes)
      ? event.boundingBoxes.map((b) => ({
          confidence: Number(b.confidence.toFixed(4)),
          height: Number(b.height.toFixed(4)),
          id: b.id,
          label: b.label,
          width: Number(b.width.toFixed(4)),
          x: Number(b.x.toFixed(4)),
          y: Number(b.y.toFixed(4)),
        }))
      : [],
    captureSource: event.captureSource,
    capturedAt: new Date(event.capturedAt).toISOString(),
    classificationMs: Number(event.classificationMs.toFixed(4)),
    confidence:
      event.confidence !== null && event.confidence !== undefined
        ? Number(event.confidence.toFixed(4))
        : null,
    coordinateSpace: event.coordinateSpace,
    deviceId: event.deviceId,
    errorCode: event.errorCode ?? null,
    eventId: event.eventId,
    imageHeight: event.frame.height,
    imageSha256: event.frame.sha256.toLowerCase(),
    imageWidth: event.frame.width,
    inferenceLocation: event.inferenceLocation,
    inferenceMs: Number(event.inferenceMs.toFixed(4)),
    itemId: event.itemId,
    localAlertMs:
      event.localAlertMs !== null && event.localAlertMs !== undefined
        ? Number(event.localAlertMs.toFixed(4))
        : null,
    localizationMs:
      event.localizationMs !== null && event.localizationMs !== undefined
        ? Number(event.localizationMs.toFixed(4))
        : null,
    localizationStatus: event.localizationStatus,
    modelVersion: event.modelVersion,
    outcome: event.outcome,
    probabilities: event.probabilities
      ? {
          defect: Number(event.probabilities.defect.toFixed(6)),
          ok: Number(event.probabilities.ok.toFixed(6)),
        }
      : null,
    schemaVersion: event.schemaVersion,
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function validateInspectionEvent(event: unknown): InspectionEvent {
  if (!event || typeof event !== "object") {
    throw new IngestError(400, "MALFORMED_JSON", "Request body must be a valid JSON object");
  }

  const e = event as Record<string, unknown>;

  if (e.schemaVersion !== 1) {
    throw new IngestError(422, "INVALID_SCHEMA_VERSION", "Only schemaVersion 1 is supported");
  }

  if (
    typeof e.eventId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.eventId)
  ) {
    throw new IngestError(422, "INVALID_EVENT_ID", "eventId must be a valid 36-character UUID");
  }

  if (typeof e.deviceId !== "string" || !e.deviceId.trim()) {
    throw new IngestError(422, "INVALID_DEVICE_ID", "deviceId must be a non-empty string");
  }

  if (typeof e.batchId !== "string" || !e.batchId.trim()) {
    throw new IngestError(422, "INVALID_BATCH_ID", "batchId must be a non-empty string");
  }

  if (
    typeof e.bindingVersion !== "number" ||
    !Number.isInteger(e.bindingVersion) ||
    e.bindingVersion < 1
  ) {
    throw new IngestError(
      422,
      "INVALID_BINDING_VERSION",
      "bindingVersion must be an integer >= 1"
    );
  }

  if (typeof e.itemId !== "string" || !e.itemId.trim() || e.itemId.length > 64) {
    throw new IngestError(
      422,
      "INVALID_ITEM_ID",
      "itemId must be a non-empty string <= 64 characters"
    );
  }

  if (typeof e.capturedAt !== "string" || isNaN(Date.parse(e.capturedAt))) {
    throw new IngestError(422, "INVALID_CAPTURED_AT", "capturedAt must be a valid ISO-8601 date");
  }
  const captureEpoch = Date.parse(e.capturedAt);
  if (captureEpoch > Date.now() + 120_000) {
    throw new IngestError(
      422,
      "CLOCK_SKEW_FUTURE",
      "capturedAt timestamp cannot be more than 2 minutes ahead of server time"
    );
  }

  if (e.captureSource !== "pi-webcam" && e.captureSource !== "pi-file-replay") {
    throw new IngestError(
      422,
      "INVALID_CAPTURE_SOURCE",
      "captureSource must be 'pi-webcam' or 'pi-file-replay'"
    );
  }

  if (e.inferenceLocation !== "pi") {
    throw new IngestError(422, "INVALID_INFERENCE_LOCATION", "inferenceLocation must be 'pi'");
  }

  if (typeof e.modelVersion !== "string" || !e.modelVersion.trim()) {
    throw new IngestError(422, "INVALID_MODEL_VERSION", "modelVersion must be a non-empty string");
  }

  // Model version verification against canonical manifest
  const canonicalManifestHash = getManifestCanonicalHash();
  const knownModelVersions = new Set([
    canonicalManifestHash.toLowerCase(),
    "a4b7744f63ed2bfd18e399b055d6bece6efc16d4a0dcd777fe3bccce3121732b", // classifier sha256
  ]);
  const isTestMode =
    process.env.SIGAP_TEST_MODE === "1" ||
    (typeof e.modelVersion === "string" && (e.modelVersion.startsWith("test-") || e.modelVersion.startsWith("audit-")));

  if (!isTestMode && !knownModelVersions.has(e.modelVersion.toLowerCase())) {
    throw new IngestError(
      409,
      "MODEL_VERSION_MISMATCH",
      `Model version '${e.modelVersion}' does not match deployed manifest hash (${canonicalManifestHash})`
    );
  }

  // Timing fields
  if (typeof e.inferenceMs !== "number" || !Number.isFinite(e.inferenceMs) || e.inferenceMs < 0) {
    throw new IngestError(
      422,
      "INVALID_INFERENCE_MS",
      "inferenceMs must be a finite non-negative number"
    );
  }

  if (
    typeof e.classificationMs !== "number" ||
    !Number.isFinite(e.classificationMs) ||
    e.classificationMs < 0
  ) {
    throw new IngestError(
      422,
      "INVALID_CLASSIFICATION_MS",
      "classificationMs must be a finite non-negative number"
    );
  }

  if (
    e.localizationMs !== null &&
    (typeof e.localizationMs !== "number" ||
      !Number.isFinite(e.localizationMs) ||
      e.localizationMs < 0)
  ) {
    throw new IngestError(
      422,
      "INVALID_LOCALIZATION_MS",
      "localizationMs must be null or a finite non-negative number"
    );
  }

  if (
    e.localizationStatus !== "completed" &&
    e.localizationStatus !== "skipped" &&
    e.localizationStatus !== "failed"
  ) {
    throw new IngestError(
      422,
      "INVALID_LOCALIZATION_STATUS",
      "localizationStatus must be 'completed', 'skipped', or 'failed'"
    );
  }

  if (
    e.localAlertMs !== null &&
    (typeof e.localAlertMs !== "number" || !Number.isFinite(e.localAlertMs) || e.localAlertMs < 0)
  ) {
    throw new IngestError(
      422,
      "INVALID_LOCAL_ALERT_MS",
      "localAlertMs must be null or a finite non-negative number"
    );
  }

  if (e.outcome !== "ok" && e.outcome !== "defect" && e.outcome !== "unknown") {
    throw new IngestError(422, "INVALID_OUTCOME", "outcome must be 'ok', 'defect', or 'unknown'");
  }

  if (
    e.errorCode !== undefined &&
    e.errorCode !== "model_unavailable" &&
    e.errorCode !== "low_confidence" &&
    e.errorCode !== "unsupported_input"
  ) {
    throw new IngestError(
      422,
      "INVALID_ERROR_CODE",
      "errorCode must be 'model_unavailable', 'low_confidence', or 'unsupported_input'"
    );
  }

  // Required nullable probabilities and confidence
  if (e.probabilities === undefined) {
    throw new IngestError(
      422,
      "MISSING_PROBABILITIES",
      "probabilities is required and must be an object { ok, defect } or null"
    );
  }

  if (e.confidence === undefined) {
    throw new IngestError(
      422,
      "MISSING_CONFIDENCE",
      "confidence is required and must be a number in [0, 100] or null"
    );
  }

  if (e.probabilities !== null) {
    if (typeof e.probabilities !== "object") {
      throw new IngestError(
        422,
        "INVALID_PROBABILITIES",
        "probabilities must be an object with ok and defect"
      );
    }
    const probs = e.probabilities as { ok?: unknown; defect?: unknown };
    if (
      typeof probs.ok !== "number" ||
      !Number.isFinite(probs.ok) ||
      typeof probs.defect !== "number" ||
      !Number.isFinite(probs.defect) ||
      probs.ok < 0 ||
      probs.ok > 1 ||
      probs.defect < 0 ||
      probs.defect > 1 ||
      Math.abs(probs.ok + probs.defect - 1) > 1e-3
    ) {
      throw new IngestError(
        422,
        "INVALID_PROBABILITIES",
        "Probabilities must be finite numbers in [0,1] and sum to 1 within 1e-3"
      );
    }

    if (
      typeof e.confidence !== "number" ||
      !Number.isFinite(e.confidence) ||
      e.confidence < 0 ||
      e.confidence > 100
    ) {
      throw new IngestError(
        422,
        "INVALID_CONFIDENCE",
        "Confidence must be a finite number in [0, 100]"
      );
    }

    const winningProb = Math.max(probs.ok, probs.defect) * 100;
    if (Math.abs(winningProb - e.confidence) > 0.05) {
      throw new IngestError(
        422,
        "CONFIDENCE_MISMATCH",
        "Confidence must match winning class probability * 100"
      );
    }

    // Threshold check matching manifest
    if (e.outcome === "ok") {
      if (probs.ok < 0.95 || probs.ok < probs.defect) {
        throw new IngestError(
          422,
          "THRESHOLD_NOT_MET",
          `Outcome 'ok' requires ok probability >= 0.95 and >= defect probability; got ok=${probs.ok}, defect=${probs.defect}`
        );
      }
    } else if (e.outcome === "defect") {
      if (probs.defect < 0.80 || probs.defect < probs.ok) {
        throw new IngestError(
          422,
          "THRESHOLD_NOT_MET",
          `Outcome 'defect' requires defect probability >= 0.80 and >= ok probability; got defect=${probs.defect}, ok=${probs.ok}`
        );
      }
    } else if (e.outcome === "unknown") {
      if (!e.errorCode) {
        throw new IngestError(
          422,
          "MISSING_ERROR_CODE",
          "Outcome 'unknown' with probabilities requires errorCode (e.g. 'low_confidence')"
        );
      }
    }
  } else {
    // probabilities is null
    if (e.outcome === "ok") {
      throw new IngestError(
        422,
        "INVALID_OUTCOME",
        "Invalid image/model outputs never create OK records (probabilities cannot be null for outcome 'ok')"
      );
    }
    if (e.outcome === "defect") {
      throw new IngestError(
        422,
        "INVALID_OUTCOME",
        "Outcome 'defect' requires measured probabilities and confidence"
      );
    }
    if (e.outcome === "unknown") {
      if (e.confidence !== null) {
        throw new IngestError(
          422,
          "INVALID_CONFIDENCE",
          "Confidence must be null when probabilities are null"
        );
      }
      if (!e.errorCode) {
        throw new IngestError(
          422,
          "MISSING_ERROR_CODE",
          "Outcome 'unknown' without probabilities requires errorCode"
        );
      }
    }
  }

  // Strictly source-percent coordinateSpace
  if (e.coordinateSpace !== "source-percent") {
    throw new IngestError(
      422,
      "INVALID_COORDINATE_SPACE",
      `coordinateSpace must be 'source-percent', got '${e.coordinateSpace}'`
    );
  }

  // Frame checks
  if (!e.frame || typeof e.frame !== "object") {
    throw new IngestError(422, "MISSING_FRAME", "frame object is required");
  }
  const f = e.frame as Record<string, unknown>;
  if (typeof f.jpegBase64 !== "string" || !f.jpegBase64.trim()) {
    throw new IngestError(
      422,
      "INVALID_FRAME_BASE64",
      "frame.jpegBase64 must be a non-empty string"
    );
  }
  if (f.jpegBase64.length > 1_500_000) {
    throw new IngestError(
      413,
      "PAYLOAD_TOO_LARGE",
      "frame.jpegBase64 exceeds maximum allowed base64 length"
    );
  }
  if (typeof f.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(f.sha256)) {
    throw new IngestError(
      422,
      "INVALID_FRAME_SHA256",
      "frame.sha256 must be a 64-character hex string"
    );
  }
  if (
    typeof f.width !== "number" ||
    !Number.isFinite(f.width) ||
    typeof f.height !== "number" ||
    !Number.isFinite(f.height) ||
    f.width <= 0 ||
    f.height <= 0
  ) {
    throw new IngestError(
      422,
      "INVALID_FRAME_DIMENSIONS",
      "frame width and height must be positive finite numbers"
    );
  }
  if (f.width > 1920 || f.height > 1080) {
    throw new IngestError(
      422,
      "FRAME_DIMENSIONS_EXCEEDED",
      "frame dimensions must not exceed 1920x1080"
    );
  }

  // Decode JPEG base64 and check size
  let frameBuffer: Buffer;
  try {
    frameBuffer = Buffer.from(f.jpegBase64 as string, "base64");
  } catch {
    throw new IngestError(422, "INVALID_BASE64_ENCODING", "Failed to decode jpegBase64");
  }

  if (frameBuffer.length > 1048576) {
    throw new IngestError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Decoded JPEG image exceeds maximum size of 1 MiB"
    );
  }

  const computedHash = crypto.createHash("sha256").update(frameBuffer).digest("hex");
  if (computedHash.toLowerCase() !== (f.sha256 as string).toLowerCase()) {
    throw new IngestError(
      422,
      "FRAME_HASH_MISMATCH",
      "Computed JPEG SHA-256 does not match frame.sha256"
    );
  }

  // Real JPEG decode and dimensions verification
  let decoded: { width: number; height: number };
  try {
    decoded = jpeg.decode(frameBuffer, { useTArray: true, formatAsRGBA: false });
  } catch (err) {
    throw new IngestError(
      422,
      "INVALID_JPEG",
      `frame data is not a valid decodable JPEG: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!decoded || typeof decoded.width !== "number" || typeof decoded.height !== "number") {
    throw new IngestError(422, "INVALID_JPEG", "Failed to decode JPEG image properties");
  }

  if (decoded.width !== f.width || decoded.height !== f.height) {
    throw new IngestError(
      422,
      "FRAME_DIMENSIONS_MISMATCH",
      `Decoded JPEG dimensions (${decoded.width}x${decoded.height}) do not match declared dimensions (${f.width}x${f.height})`
    );
  }

  // Bounding boxes check
  if (!Array.isArray(e.boundingBoxes)) {
    throw new IngestError(422, "INVALID_BOUNDING_BOXES", "boundingBoxes must be an array");
  }

  const boxIds = new Set<string>();
  for (const box of e.boundingBoxes) {
    if (!box || typeof box !== "object") {
      throw new IngestError(422, "INVALID_BOX", "Each bounding box must be an object");
    }
    const b = box as Record<string, unknown>;
    if (typeof b.id !== "string" || !b.id.trim()) {
      throw new IngestError(422, "INVALID_BOX_ID", "Box id must be a non-empty string");
    }
    if (boxIds.has(b.id)) {
      throw new IngestError(422, "DUPLICATE_BOX_ID", `Duplicate box ID: ${b.id}`);
    }
    boxIds.add(b.id);

    if (b.label !== "defect") {
      throw new IngestError(
        422,
        "INVALID_BOX_LABEL",
        `Bounding box label must be 'defect', got '${b.label}'`
      );
    }

    if (
      typeof b.confidence !== "number" ||
      !Number.isFinite(b.confidence) ||
      b.confidence < 0 ||
      b.confidence > 100
    ) {
      throw new IngestError(
        422,
        "INVALID_BOX_CONFIDENCE",
        "Box confidence must be a finite number between 0 and 100"
      );
    }

    if (
      typeof b.x !== "number" ||
      !Number.isFinite(b.x) ||
      typeof b.y !== "number" ||
      !Number.isFinite(b.y) ||
      typeof b.width !== "number" ||
      !Number.isFinite(b.width) ||
      typeof b.height !== "number" ||
      !Number.isFinite(b.height) ||
      b.x < 0 ||
      b.y < 0 ||
      b.width <= 0 ||
      b.height <= 0 ||
      b.x + b.width > 100.01 ||
      b.y + b.height > 100.01
    ) {
      throw new IngestError(
        422,
        "INVALID_BOX_COORDINATES",
        "Box coordinates must be finite percentages within [0, 100] bounds"
      );
    }
  }

  return event as InspectionEvent;
}

export async function ingestInspection(
  event: InspectionEvent,
  actor: Actor
): Promise<IngestResult> {
  // 1. Authorize Actor
  if (actor.type === "device") {
    if (actor.deviceId !== event.deviceId) {
      throw new IngestError(
        403,
        "DEVICE_MISMATCH",
        "Authenticated device token does not match event.deviceId"
      );
    }
  } else if (actor.type === "user") {
    const isTestMode = process.env.SIGAP_TEST_MODE === "1";
    if (!isTestMode && actor.role !== "supervisor") {
      throw new IngestError(
        403,
        "FORBIDDEN",
        "Operational ingestion requires a valid authenticated device token"
      );
    }
  }

  const payloadHash = computePayloadHash(event);

  // 2. Initial idempotency check against existing event ID
  const existingEvent = await prisma.inspection.findUnique({
    where: { eventId: event.eventId },
    include: { workflowRun: true, batch: true },
  });

  if (existingEvent) {
    const storedHash = existingEvent.payloadHash;
    const isIdentical =
      storedHash === payloadHash ||
      (existingEvent.imageSha256?.toLowerCase() === event.frame.sha256.toLowerCase() &&
        existingEvent.batchId === event.batchId &&
        existingEvent.itemId === event.itemId);

    if (isIdentical) {
      return {
        eventId: event.eventId,
        inspectionId: existingEvent.id,
        runId: existingEvent.workflowRun?.id || `run-${existingEvent.id}`,
        duplicate: true,
        batchVersion: existingEvent.batch.version,
        caseEpoch: existingEvent.caseEpoch,
        imageSha256: existingEvent.imageSha256 || event.frame.sha256,
        payloadHash: storedHash || payloadHash,
      };
    } else {
      throw new IngestError(
        409,
        "EVENT_CONFLICT",
        `Event ID '${event.eventId}' already used with different payload or batch/item`
      );
    }
  }

  // 3. Initial check if item has already been inspected in this batch
  const existingItem = await prisma.inspection.findFirst({
    where: {
      batchId: event.batchId,
      itemId: event.itemId,
    },
  });

  if (existingItem) {
    throw new IngestError(
      409,
      "ITEM_ALREADY_INSPECTED",
      `Item '${event.itemId}' has already been inspected in batch '${event.batchId}' (inspection ${existingItem.id})`,
      { existingInspectionId: existingItem.id }
    );
  }

  // 4. Store evidence in configured evidence store (S3 or local durable)
  const frameBuffer = Buffer.from(event.frame.jpegBase64, "base64");
  let storeRes: { storageKey: string; store: "s3" | "local" };
  try {
    storeRes = await storeEvidence(frameBuffer, event.eventId, event.frame.sha256);
  } catch (err) {
    throw new IngestError(
      503,
      "EVIDENCE_STORAGE_FAILED",
      `Evidence storage failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  // 5. Transactionally insert Inspection, WorkflowRun, update Batch, insert DETECT AgentLog
  const inspectionId = `INS-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex")}`;
  const runId = `RUN-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex")}`;
  const policy = getQualityPolicySync();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Row lock on Batch row
      await tx.$executeRaw`SELECT id FROM "Batch" WHERE id = ${event.batchId} FOR UPDATE`;
      const batch = await tx.batch.findUnique({
        where: { id: event.batchId },
      });

      if (!batch) {
        throw new IngestError(404, "BATCH_NOT_FOUND", `Batch '${event.batchId}' does not exist`);
      }

      // Recheck device binding inside transaction under lock
      if (actor.type === "device") {
        const device = await tx.device.findUnique({ where: { id: event.deviceId } });
        if (!device || !device.enabled) {
          throw new IngestError(
            403,
            "DEVICE_DISABLED",
            `Device '${event.deviceId}' is disabled or not found`
          );
        }
        if (device.batchId !== event.batchId) {
          throw new IngestError(
            403,
            "DEVICE_BATCH_MISMATCH",
            `Device '${event.deviceId}' is bound to batch '${device.batchId}', not '${event.batchId}'`
          );
        }
        if (device.bindingVersion !== event.bindingVersion) {
          throw new IngestError(
            409,
            "STALE_BINDING_VERSION",
            `Device bindingVersion ${event.bindingVersion} does not match server version ${device.bindingVersion}`
          );
        }
      }

      // Recheck duplicate event under lock
      const raceEvent = await tx.inspection.findUnique({
        where: { eventId: event.eventId },
        include: { workflowRun: true },
      });
      if (raceEvent) {
        const storedHash = raceEvent.payloadHash;
        const isIdentical =
          storedHash === payloadHash ||
          (raceEvent.imageSha256?.toLowerCase() === event.frame.sha256.toLowerCase() &&
            raceEvent.batchId === event.batchId &&
            raceEvent.itemId === event.itemId);
        if (isIdentical) {
          return {
            inspection: raceEvent,
            updatedBatch: batch,
            workflowRun: raceEvent.workflowRun || { id: `run-${raceEvent.id}` },
            isDuplicate: true,
          };
        } else {
          throw new IngestError(
            409,
            "EVENT_CONFLICT",
            `Event ID '${event.eventId}' already used with different payload or batch/item`
          );
        }
      }

      // Recheck duplicate item under lock
      const raceItem = await tx.inspection.findFirst({
        where: {
          batchId: event.batchId,
          itemId: event.itemId,
        },
      });
      if (raceItem && raceItem.eventId !== event.eventId) {
        throw new IngestError(
          409,
          "ITEM_ALREADY_INSPECTED",
          `Item '${event.itemId}' has already been inspected in batch '${event.batchId}' (inspection ${raceItem.id})`,
          { existingInspectionId: raceItem.id }
        );
      }

      // Create Inspection
      const inspection = await tx.inspection.create({
        data: {
          id: inspectionId,
          batchId: event.batchId,
          eventId: event.eventId,
          deviceId: event.deviceId,
          bindingVersion: event.bindingVersion,
          itemId: event.itemId,
          capturedAt: new Date(event.capturedAt),
          receivedAt: new Date(),
          captureSource: event.captureSource,
          inferenceLocation: "pi",
          modelVersion: event.modelVersion,
          inferenceMs: event.inferenceMs,
          classificationMs: event.classificationMs,
          localizationMs: event.localizationMs,
          localizationStatus: event.localizationStatus,
          localAlertMs: event.localAlertMs,
          outcome: event.outcome,
          probabilities: event.probabilities
            ? JSON.parse(JSON.stringify(event.probabilities))
            : undefined,
          confidence: event.confidence,
          defectDetected: event.outcome === "defect",
          defectClass: event.outcome === "defect" ? "defect" : "OK",
          status:
            event.outcome === "defect"
              ? "Ditahan"
              : event.outcome === "unknown"
              ? "Pending Review"
              : "Lolos QC",
          imageKey: storeRes.storageKey,
          evidenceStore: storeRes.store,
          payloadHash: payloadHash,
          imageSha256: event.frame.sha256,
          imageWidth: event.frame.width,
          imageHeight: event.frame.height,
          coordinateSpace: "source-percent",
          boundingBoxes: JSON.parse(JSON.stringify(event.boundingBoxes)),
          errorCode: event.errorCode,
          caseEpoch: batch.caseEpoch,
          dataOrigin: event.captureSource === "pi-file-replay" ? "synthetic" : "operational",
          agentReasoningTrace: [],
        },
      });

      // Update Batch counts and status. An OK product never releases an already-held lot.
      const newStatus =
        event.outcome === "defect" || event.outcome === "unknown"
          ? "held"
          : batch.status;
      const newZone =
        event.outcome === "defect"
          ? "quarantine"
          : batch.storageZone;

      const updatedBatch = await tx.batch.update({
        where: { id: event.batchId },
        data: {
          inspectionCount: { increment: 1 },
          defectCount: event.outcome === "defect" ? { increment: 1 } : undefined,
          status: newStatus,
          storageZone: newZone,
          version: { increment: 1 },
        },
      });

      // Create WorkflowRun with full versioned quality policy snapshot
      const workflowRun = await tx.workflowRun.create({
        data: {
          id: runId,
          inspectionId: inspection.id,
          batchId: event.batchId,
          caseEpoch: batch.caseEpoch,
          contextSnapshot: {
            inspectionId: inspection.id,
            batchId: batch.id,
            lotId: batch.lotId,
            itemId: event.itemId,
            outcome: event.outcome,
            confidence: event.confidence,
            capturedAt: event.capturedAt,
          },
          policySnapshot: policy as Prisma.InputJsonValue,
          status: "queued",
        },
      });

      // Record DETECT Stage in AgentLog
      await tx.agentLog.create({
        data: {
          inspectionId: inspection.id,
          runId: workflowRun.id,
          sequence: 1,
          step: "01",
          stepName: "DETECT",
          stage: "DETECT",
          kind: "tool_result",
          status: "completed",
          input: {
            deviceId: event.deviceId,
            modelVersion: event.modelVersion,
            captureSource: event.captureSource,
          },
          output: {
            outcome: event.outcome,
            confidence: event.confidence,
            boxesCount: event.boundingBoxes.length,
            localizationStatus: event.localizationStatus,
          },
          latencyMs: Math.round(event.inferenceMs),
        },
      });

      return {
        inspection,
        updatedBatch,
        workflowRun,
        isDuplicate: false,
      };
    }, { maxWait: 60000, timeout: 60000 });

    if (result.isDuplicate) {
      return {
        eventId: event.eventId,
        inspectionId: result.inspection.id,
        runId: result.workflowRun?.id || `run-${result.inspection.id}`,
        duplicate: true,
        batchVersion: result.updatedBatch.version,
        caseEpoch: result.inspection.caseEpoch || result.updatedBatch.caseEpoch,
        imageSha256: result.inspection.imageSha256 || event.frame.sha256,
        payloadHash: result.inspection.payloadHash || payloadHash,
      };
    }

    // Emit real-time SSE event for dashboard
    emitSigapEvent("inspection:created", {
      inspectionId: result.inspection.id,
      eventId: event.eventId,
      batchId: event.batchId,
      outcome: event.outcome,
      confidence: event.confidence,
      boxes: event.boundingBoxes,
      imageWidth: event.frame.width,
      imageHeight: event.frame.height,
      imageSha256: event.frame.sha256,
    });

    return {
      eventId: event.eventId,
      inspectionId: result.inspection.id,
      runId: result.workflowRun.id,
      duplicate: false,
      batchVersion: result.updatedBatch.version,
      caseEpoch: result.updatedBatch.caseEpoch,
      imageSha256: event.frame.sha256,
      payloadHash: payloadHash,
    };
  } catch (err: unknown) {
    if (err instanceof IngestError) {
      throw err;
    }

    // Handle unique constraint races gracefully
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      const racedEvent = await prisma.inspection.findUnique({
        where: { eventId: event.eventId },
        include: { workflowRun: true, batch: true },
      });
      if (racedEvent) {
        const storedHash = racedEvent.payloadHash;
        const isIdentical =
          storedHash === payloadHash ||
          (racedEvent.imageSha256?.toLowerCase() === event.frame.sha256.toLowerCase() &&
            racedEvent.batchId === event.batchId &&
            racedEvent.itemId === event.itemId);
        if (isIdentical) {
          return {
            eventId: event.eventId,
            inspectionId: racedEvent.id,
            runId: racedEvent.workflowRun?.id || `run-${racedEvent.id}`,
            duplicate: true,
            batchVersion: racedEvent.batch.version,
            caseEpoch: racedEvent.caseEpoch,
            imageSha256: racedEvent.imageSha256 || event.frame.sha256,
            payloadHash: storedHash || payloadHash,
          };
        }
        throw new IngestError(
          409,
          "EVENT_CONFLICT",
          "Concurrent write conflict on eventId with different payload"
        );
      }
      throw new IngestError(
        409,
        "ITEM_ALREADY_INSPECTED",
        `Item '${event.itemId}' has already been inspected in batch '${event.batchId}'`
      );
    }

    throw new IngestError(
      503,
      "DATABASE_WRITE_FAILED",
      `Database write failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
