import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/auth";
import {
  Actor,
  BrowserInspectionRequest,
  BrowserInspectionResult,
  InspectionEvent,
} from "@/lib/contracts";
import {
  IngestError,
  ingestInspection,
  validateInspectionEvent,
} from "@/lib/inspection-service";
import { prisma } from "@/lib/prisma";
import { sigapStore } from "@/lib/store";
import { formatInspectionRecord } from "@/lib/formatters";
import { analyzeJpeg } from "@/lib/vision-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_550_000;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  // 1. Authenticate Session Cookie
  const session = verifySessionCookie(request);
  if (!session) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED", error: "Authentication required" },
      { status: 401 }
    );
  }

  // 2. Authorize Role (Operator or Supervisor only)
  if (session.role !== "operator" && session.role !== "supervisor") {
    return NextResponse.json(
      {
        success: false,
        code: "FORBIDDEN",
        error: "Operator or supervisor role required for inspection analysis",
      },
      { status: 403 }
    );
  }

  // 3. Verify CSRF Token
  const clientCsrf = request.headers.get("x-csrf-token");
  if (!clientCsrf || !safeEqual(clientCsrf, session.csrfToken)) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_CSRF",
        error: "Missing or invalid CSRF token (x-csrf-token header required)",
      },
      { status: 403 }
    );
  }

  // 4. Validate Content-Type
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      {
        success: false,
        code: "UNSUPPORTED_MEDIA_TYPE",
        error: "Content-Type must be application/json",
      },
      { status: 415 }
    );
  }

  // 5. Stream and bound request body bytes before parsing
  let bodyBuffer: Buffer;
  try {
    const reader = request.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { success: false, code: "MALFORMED_JSON", error: "Missing request body" },
        { status: 400 }
      );
    }
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > MAX_BODY_BYTES) {
        return NextResponse.json(
          {
            success: false,
            code: "PAYLOAD_TOO_LARGE",
            error: "Request body exceeds 1.55 MB limit",
          },
          { status: 413 }
        );
      }
      chunks.push(value);
    }
    bodyBuffer = Buffer.concat(chunks);
  } catch {
    return NextResponse.json(
      { success: false, code: "MALFORMED_JSON", error: "Failed to read request body stream" },
      { status: 400 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(bodyBuffer.toString("utf-8"));
  } catch {
    return NextResponse.json(
      { success: false, code: "MALFORMED_JSON", error: "Malformed JSON payload in request body" },
      { status: 400 }
    );
  }

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json(
      { success: false, code: "INVALID_ANALYSIS_REQUEST", error: "Request body must be an object" },
      { status: 422 }
    );
  }

  const req = rawBody as Record<string, unknown>;

  // 6. Validate Required Request Fields
  if (
    typeof req.eventId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.eventId)
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "eventId must be a valid 36-character UUID",
      },
      { status: 422 }
    );
  }

  if (typeof req.batchId !== "string" || !req.batchId.trim()) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "batchId must be a non-empty string",
      },
      { status: 422 }
    );
  }

  // itemId is optional: when omitted the server assigns the next ID in the lot
  const requestedItemId = typeof req.itemId === "string" ? req.itemId.trim() : "";
  if (
    req.itemId !== undefined &&
    req.itemId !== null &&
    (typeof req.itemId !== "string" || req.itemId.length > 64)
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "itemId must be a string <= 64 characters when provided",
      },
      { status: 422 }
    );
  }

  if (typeof req.capturedAt !== "string" || isNaN(Date.parse(req.capturedAt))) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "capturedAt must be a valid ISO-8601 date",
      },
      { status: 422 }
    );
  }
  const captureEpoch = Date.parse(req.capturedAt);
  if (captureEpoch > Date.now() + 120_000) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "capturedAt timestamp cannot be more than 2 minutes ahead of server time",
      },
      { status: 422 }
    );
  }

  if (req.captureSource !== "browser-upload" && req.captureSource !== "browser-webcam") {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "captureSource must be 'browser-upload' or 'browser-webcam'",
      },
      { status: 422 }
    );
  }

  if (typeof req.jpegBase64 !== "string" || !req.jpegBase64.trim()) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "jpegBase64 must be a non-empty string",
      },
      { status: 422 }
    );
  }

  if (req.jpegBase64.length > 1_500_000) {
    return NextResponse.json(
      {
        success: false,
        code: "PAYLOAD_TOO_LARGE",
        error: "jpegBase64 exceeds maximum allowed base64 length",
      },
      { status: 413 }
    );
  }

  let jpegBytes: Buffer;
  try {
    jpegBytes = Buffer.from(req.jpegBase64, "base64");
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_ANALYSIS_REQUEST",
        error: "Failed to decode jpegBase64",
      },
      { status: 422 }
    );
  }

  if (jpegBytes.length > 1048576) {
    return NextResponse.json(
      {
        success: false,
        code: "PAYLOAD_TOO_LARGE",
        error: "Decoded JPEG image exceeds maximum size of 1 MiB",
      },
      { status: 413 }
    );
  }

  const computedImageSha256 = crypto.createHash("sha256").update(jpegBytes).digest("hex");

  try {
    // 7. Verify Batch exists before inference
    const batch = await prisma.batch.findUnique({
      where: { id: req.batchId },
    });
    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          code: "BATCH_NOT_FOUND",
          error: `Batch '${req.batchId}' does not exist`,
        },
        { status: 404 }
      );
    }

    // 8. Pre-inference Idempotency Check on eventId
    const existingEvent = await prisma.inspection.findUnique({
      where: { eventId: req.eventId },
      include: { workflowRun: true, batch: true },
    });

    if (existingEvent) {
      const matchingHash =
        existingEvent.imageSha256?.toLowerCase() === computedImageSha256.toLowerCase();
      const matchingBatch = existingEvent.batchId === req.batchId;
      // A retry without an explicit itemId matches whatever ID was auto-assigned first time
      const matchingItem = !requestedItemId || existingEvent.itemId === requestedItemId;
      const matchingSource = existingEvent.captureSource === req.captureSource;
      const existingCapturedAt = existingEvent.capturedAt
        ? new Date(existingEvent.capturedAt).toISOString()
        : null;
      const reqCapturedAt = new Date(req.capturedAt).toISOString();
      const matchingCapturedAt = existingCapturedAt === reqCapturedAt;
      const matchingDevice = existingEvent.deviceId === null;
      const matchingLocation = existingEvent.inferenceLocation === "server";

      const isExactDuplicate =
        matchingHash &&
        matchingBatch &&
        matchingItem &&
        matchingSource &&
        matchingCapturedAt &&
        matchingDevice &&
        matchingLocation;

      if (isExactDuplicate) {
        const persistedRecord =
          (await sigapStore.getInspectionById(existingEvent.id)) ||
          formatInspectionRecord(existingEvent);
        const duplicateResult: BrowserInspectionResult = {
          inspection: persistedRecord,
          runId: existingEvent.workflowRun?.id || `run-${existingEvent.id}`,
          duplicate: true,
        };
        return NextResponse.json(
          {
            success: true,
            data: duplicateResult,
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            code: "EVENT_CONFLICT",
            error: `Event ID '${req.eventId}' already used with different payload or batch/item`,
          },
          { status: 409 }
        );
      }
    }

    // 9. Auto-assign "<lotId>-NNN" when no itemId was given, then check (batchId, itemId) is unused
    let itemId = requestedItemId;
    if (!itemId) {
      let seq = (await prisma.inspection.count({ where: { batchId: req.batchId } })) + 1;
      do {
        itemId = `${batch.lotId}-${String(seq++).padStart(3, "0")}`;
      } while (
        await prisma.inspection.findFirst({
          where: { batchId: req.batchId, itemId },
          select: { id: true },
        })
      );
    }

    const existingItem = await prisma.inspection.findFirst({
      where: {
        batchId: req.batchId,
        itemId,
      },
    });

    if (existingItem) {
      return NextResponse.json(
        {
          success: false,
          code: "ITEM_ALREADY_INSPECTED",
          error: `Item '${itemId}' has already been inspected in batch '${req.batchId}' (inspection ${existingItem.id})`,
          details: { existingInspectionId: existingItem.id },
        },
        { status: 409 }
      );
    }

    // 10. Run Server Vision Inference
    const vision = await analyzeJpeg(jpegBytes);

    // 11. Construct Full Server-Owned InspectionEvent
    const fullEvent: InspectionEvent = {
      schemaVersion: 1,
      eventId: req.eventId,
      deviceId: null,
      batchId: req.batchId,
      bindingVersion: 1,
      itemId,
      capturedAt: new Date(req.capturedAt).toISOString(),
      captureSource: req.captureSource as "browser-upload" | "browser-webcam",
      inferenceLocation: "server",
      modelVersion: vision.modelVersion,
      inferenceMs: vision.inferenceMs,
      classificationMs: vision.classificationMs,
      localizationMs: vision.localizationMs,
      localizationStatus: vision.localizationStatus,
      localAlertMs: null,
      outcome: vision.outcome,
      probabilities: vision.probabilities,
      confidence: vision.confidence,
      frame: {
        jpegBase64: req.jpegBase64,
        sha256: vision.imageSha256,
        width: vision.imageWidth,
        height: vision.imageHeight,
      },
      coordinateSpace: "source-percent",
      boundingBoxes: vision.boundingBoxes,
      errorCode: vision.errorCode,
    };

    // 12. Validate Event
    const validatedEvent = validateInspectionEvent(fullEvent);

    // 13. Ingest with Transactional Persistence and Event Emission
    const actor: Actor = {
      type: "user",
      id: session.userId,
      role: session.role,
    };

    const ingestResult = await ingestInspection(validatedEvent, actor);

    // 14. Fetch Persisted Formatted Record
    const inspectionRecord = await sigapStore.getInspectionById(ingestResult.inspectionId);
    if (!inspectionRecord) {
      throw new IngestError(
        500,
        "PERSISTENCE_FETCH_FAILED",
        `Failed to retrieve persisted inspection ${ingestResult.inspectionId}`
      );
    }

    const responseData: BrowserInspectionResult = {
      inspection: inspectionRecord,
      runId: ingestResult.runId,
      duplicate: ingestResult.duplicate,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { status: ingestResult.duplicate ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof IngestError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
