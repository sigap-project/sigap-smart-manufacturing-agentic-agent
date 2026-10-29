import { NextRequest, NextResponse } from "next/server";
import { resolveActor, unauthorizedResponse } from "@/lib/auth";
import {
  IngestError,
  ingestInspection,
  validateInspectionEvent,
} from "@/lib/inspection-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/inspection-result
 * Authenticated ingestion endpoint for Raspberry Pi Edge Vision Worker & Labeled Replay.
 * Protected by Device Bearer Token or Server Internal API Key.
 * Implements Schema Version 1 Shared Inspection Contract.
 */
export async function POST(request: NextRequest) {
  // 1. Authenticate Actor (Device Token or Internal API Key)
  const actor = await resolveActor(request);
  if (!actor) {
    return unauthorizedResponse("Missing or invalid Device Token");
  }

  const isTestMode = process.env.SIGAP_TEST_MODE === "1";
  if (actor.type !== "device" && !isTestMode) {
    return NextResponse.json(
      {
        success: false,
        code: "FORBIDDEN",
        error: "Operational ingestion requires a valid authenticated device token",
      },
      { status: 403 }
    );
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Malformed JSON payload in request body" },
        { status: 400 }
      );
    }

    // 2. Validate Event Schema
    const validatedEvent = validateInspectionEvent(body);

    if (
      validatedEvent.captureSource === "browser-upload" ||
      validatedEvent.captureSource === "browser-webcam" ||
      validatedEvent.inferenceLocation === "server"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          error: "Browser inspection provenance is not permitted on the internal device route",
        },
        { status: 403 }
      );
    }

    // 3. Ingest with Idempotency and Transactional Persistence
    const result = await ingestInspection(validatedEvent, actor);

    const statusCode = result.duplicate ? 200 : 201;
    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: statusCode }
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

    console.error("[POST /api/internal/inspection-result Unexpected Error]:", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        error: error instanceof Error ? error.message : "Internal server error during inspection ingestion",
      },
      { status: 500 }
    );
  }
}
