import crypto from "crypto";
import { Actor, IngestResult, InspectionEvent } from "./contracts";
import { emitSigapEvent } from "./events";
import { storeEvidence } from "./evidence-store";
import { prisma } from "./prisma";

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

export function validateInspectionEvent(event: unknown): InspectionEvent {
  if (!event || typeof event !== "object") {
    throw new IngestError(400, "MALFORMED_JSON", "Request body must be a valid JSON object");
  }

  const e = event as Record<string, unknown>;

  if (e.schemaVersion !== 1) {
    throw new IngestError(422, "INVALID_SCHEMA_VERSION", "Only schemaVersion 1 is supported");
  }

  if (typeof e.eventId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(e.eventId)) {
    throw new IngestError(422, "INVALID_EVENT_ID", "eventId must be a valid 36-character UUID");
  }

  if (typeof e.deviceId !== "string" || !e.deviceId.trim()) {
    throw new IngestError(422, "INVALID_DEVICE_ID", "deviceId must be a non-empty string");
  }

  if (typeof e.batchId !== "string" || !e.batchId.trim()) {
    throw new IngestError(422, "INVALID_BATCH_ID", "batchId must be a non-empty string");
  }

  if (typeof e.bindingVersion !== "number" || !Number.isInteger(e.bindingVersion) || e.bindingVersion < 1) {
    throw new IngestError(422, "INVALID_BINDING_VERSION", "bindingVersion must be an integer >= 1");
  }

  if (typeof e.itemId !== "string" || !e.itemId.trim() || e.itemId.length > 64) {
    throw new IngestError(422, "INVALID_ITEM_ID", "itemId must be a non-empty string <= 64 characters");
  }

  if (typeof e.capturedAt !== "string" || isNaN(Date.parse(e.capturedAt))) {
    throw new IngestError(422, "INVALID_CAPTURED_AT", "capturedAt must be a valid ISO-8601 date");
  }

  if (e.captureSource !== "pi-webcam" && e.captureSource !== "pi-file-replay") {
    throw new IngestError(422, "INVALID_CAPTURE_SOURCE", "captureSource must be 'pi-webcam' or 'pi-file-replay'");
  }

  if (e.inferenceLocation !== "pi") {
    throw new IngestError(422, "INVALID_INFERENCE_LOCATION", "inferenceLocation must be 'pi'");
  }

  if (typeof e.modelVersion !== "string" || !e.modelVersion.trim()) {
    throw new IngestError(422, "INVALID_MODEL_VERSION", "modelVersion must be a non-empty string");
  }

  if (typeof e.inferenceMs !== "number" || e.inferenceMs < 0) {
    throw new IngestError(422, "INVALID_INFERENCE_MS", "inferenceMs must be a non-negative number");
  }

  if (typeof e.classificationMs !== "number" || e.classificationMs < 0) {
    throw new IngestError(422, "INVALID_CLASSIFICATION_MS", "classificationMs must be a non-negative number");
  }

  if (e.outcome !== "ok" && e.outcome !== "defect" && e.outcome !== "unknown") {
    throw new IngestError(422, "INVALID_OUTCOME", "outcome must be 'ok', 'defect', or 'unknown'");
  }

  // Probabilities and confidence checks
  if (e.probabilities !== null && typeof e.probabilities === "object") {
    const probs = e.probabilities as { ok?: number; defect?: number };
    if (
      typeof probs.ok !== "number" ||
      typeof probs.defect !== "number" ||
      probs.ok < 0 ||
      probs.ok > 1 ||
      probs.defect < 0 ||
      probs.defect > 1 ||
      Math.abs(probs.ok + probs.defect - 1) > 1e-3
    ) {
      throw new IngestError(422, "INVALID_PROBABILITIES", "Probabilities must be in [0,1] and sum to 1 within 1e-3");
    }

    if (typeof e.confidence === "number") {
      const winningProb = Math.max(probs.ok, probs.defect) * 100;
      if (Math.abs(winningProb - e.confidence) > 0.05) {
        throw new IngestError(422, "CONFIDENCE_MISMATCH", "Confidence must match winning class probability * 100");
      }
    }
  }

  // Frame checks
  if (!e.frame || typeof e.frame !== "object") {
    throw new IngestError(422, "MISSING_FRAME", "frame object is required");
  }
  const f = e.frame as Record<string, unknown>;
  if (typeof f.jpegBase64 !== "string" || !f.jpegBase64) {
    throw new IngestError(422, "INVALID_FRAME_BASE64", "frame.jpegBase64 must be a non-empty string");
  }
  if (typeof f.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(f.sha256)) {
    throw new IngestError(422, "INVALID_FRAME_SHA256", "frame.sha256 must be a 64-character hex string");
  }
  if (typeof f.width !== "number" || typeof f.height !== "number" || f.width <= 0 || f.height <= 0) {
    throw new IngestError(422, "INVALID_FRAME_DIMENSIONS", "frame width and height must be positive numbers");
  }
  if (f.width > 1920 || f.height > 1080) {
    throw new IngestError(422, "FRAME_DIMENSIONS_EXCEEDED", "frame dimensions must not exceed 1920x1080");
  }

  // Decode JPEG base64 and check size
  let frameBuffer: Buffer;
  try {
    frameBuffer = Buffer.from(f.jpegBase64, "base64");
  } catch {
    throw new IngestError(422, "INVALID_BASE64_ENCODING", "Failed to decode jpegBase64");
  }

  if (frameBuffer.length > 1048576) {
    throw new IngestError(413, "PAYLOAD_TOO_LARGE", "Decoded JPEG image exceeds maximum size of 1 MiB");
  }

  const computedHash = crypto.createHash("sha256").update(frameBuffer).digest("hex");
  if (computedHash.toLowerCase() !== (f.sha256 as string).toLowerCase()) {
    throw new IngestError(422, "FRAME_HASH_MISMATCH", "Computed JPEG SHA-256 does not match frame.sha256");
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
    if (typeof b.id !== "string" || !b.id) {
      throw new IngestError(422, "INVALID_BOX_ID", "Box id must be a non-empty string");
    }
    if (boxIds.has(b.id)) {
      throw new IngestError(422, "DUPLICATE_BOX_ID", `Duplicate box ID: ${b.id}`);
    }
    boxIds.add(b.id);

    if (
      typeof b.x !== "number" ||
      typeof b.y !== "number" ||
      typeof b.width !== "number" ||
      typeof b.height !== "number" ||
      b.x < 0 ||
      b.y < 0 ||
      b.width <= 0 ||
      b.height <= 0 ||
      b.x + b.width > 100.01 ||
      b.y + b.height > 100.01
    ) {
      throw new IngestError(422, "INVALID_BOX_COORDINATES", "Box coordinates must be within [0, 100] bounds");
    }
  }

  return event as InspectionEvent;
}

export async function ingestInspection(
  event: InspectionEvent,
  actor: Actor
): Promise<IngestResult> {
  // 1. Authorize device vs batch
  if (actor.type === "device") {
    if (actor.deviceId !== event.deviceId) {
      throw new IngestError(403, "DEVICE_MISMATCH", "Authenticated device token does not match event.deviceId");
    }
  }

  // 2. Validate batch exists
  const batch = await prisma.batch.findUnique({
    where: { id: event.batchId },
  });

  if (!batch) {
    throw new IngestError(404, "BATCH_NOT_FOUND", `Batch '${event.batchId}' does not exist`);
  }

  // Check device binding version if submitted by device
  if (actor.type === "device") {
    const device = await prisma.device.findUnique({ where: { id: event.deviceId } });
    if (device && device.bindingVersion !== event.bindingVersion) {
      throw new IngestError(
        409,
        "STALE_BINDING_VERSION",
        `Device bindingVersion ${event.bindingVersion} does not match server version ${device.bindingVersion}`
      );
    }
  }

  // 3. Check existing event idempotency
  const existingEvent = await prisma.inspection.findUnique({
    where: { eventId: event.eventId },
    include: { workflowRun: true },
  });

  if (existingEvent) {
    // Check if canonical payload matches
    if (
      existingEvent.imageSha256?.toLowerCase() === event.frame.sha256.toLowerCase() &&
      existingEvent.batchId === event.batchId &&
      existingEvent.itemId === event.itemId
    ) {
      return {
        eventId: event.eventId,
        inspectionId: existingEvent.id,
        runId: existingEvent.workflowRun?.id || `run-${existingEvent.id}`,
        duplicate: true,
        batchVersion: batch.version,
        imageSha256: existingEvent.imageSha256,
      };
    } else {
      throw new IngestError(
        409,
        "EVENT_CONFLICT",
        `Event ID '${event.eventId}' already used with different payload or batch/item`
      );
    }
  }

  // 4. Check if item has already been inspected in this batch
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

  // 5. Store evidence in configured evidence store (S3 or local durable)
  const frameBuffer = Buffer.from(event.frame.jpegBase64, "base64");
  let storageKey: string;
  try {
    const storeRes = await storeEvidence(frameBuffer, event.eventId, event.frame.sha256);
    storageKey = storeRes.storageKey;
  } catch (err) {
    throw new IngestError(
      503,
      "EVIDENCE_STORAGE_FAILED",
      `Evidence storage failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  // 6. Transactionally insert Inspection, WorkflowRun, update Batch, insert DETECT AgentLog
  const inspectionId = `INS-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex")}`;
  const runId = `RUN-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex")}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
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
          probabilities: event.probabilities ? JSON.parse(JSON.stringify(event.probabilities)) : undefined,
          confidence: event.confidence ?? 0,
          defectDetected: event.outcome === "defect",
          defectClass: event.outcome === "defect" ? "defect" : "OK",
          status:
            event.outcome === "defect"
              ? "Ditahan"
              : event.outcome === "unknown"
              ? "Pending Review"
              : "Lolos QC",
          imageKey: storageKey,
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

      // Update Batch counts and status
      const updatedBatch = await tx.batch.update({
        where: { id: event.batchId },
        data: {
          inspectionCount: { increment: 1 },
          defectCount: event.outcome === "defect" ? { increment: 1 } : undefined,
          status:
            event.outcome === "defect" || event.outcome === "unknown" ? "held" : batch.status,
          storageZone: event.outcome === "defect" ? "quarantine" : batch.storageZone,
          version: { increment: 1 },
        },
      });

      // Create WorkflowRun
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
          policySnapshot: {
            policyId: "sigap-demo-quality-v1",
            windowMinutes: 8,
            defectThreshold: 3,
            autoDispatchMode: "human_approval",
          },
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
          latencyMs: event.inferenceMs,
        },
      });

      return {
        inspection,
        updatedBatch,
        workflowRun,
      };
    });

    // Emit real-time SSE event for dashboard
    emitSigapEvent("inspection:created", {
      inspectionId: result.inspection.id,
      eventId: event.eventId,
      batchId: event.batchId,
      outcome: event.outcome,
      confidence: event.confidence,
      boxes: event.boundingBoxes,
    });

    return {
      eventId: event.eventId,
      inspectionId: result.inspection.id,
      runId: result.workflowRun.id,
      duplicate: false,
      batchVersion: result.updatedBatch.version,
      imageSha256: event.frame.sha256,
    };
  } catch (err: unknown) {
    // Resolve unique constraint race gracefully
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      const racedEvent = await prisma.inspection.findUnique({
        where: { eventId: event.eventId },
        include: { workflowRun: true },
      });
      if (racedEvent && racedEvent.imageSha256?.toLowerCase() === event.frame.sha256.toLowerCase()) {
        return {
          eventId: event.eventId,
          inspectionId: racedEvent.id,
          runId: racedEvent.workflowRun?.id || `run-${racedEvent.id}`,
          duplicate: true,
          batchVersion: batch.version,
          imageSha256: racedEvent.imageSha256,
        };
      }
      throw new IngestError(409, "EVENT_CONFLICT", "Concurrent write conflict on eventId or itemId");
    }

    throw new IngestError(
      503,
      "DATABASE_WRITE_FAILED",
      `Database write failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}
