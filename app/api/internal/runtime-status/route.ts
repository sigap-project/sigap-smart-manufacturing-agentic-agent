import { NextRequest, NextResponse } from "next/server";
import { validateInternalApiKey, unauthorizedResponse } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/runtime-status
 * Internal telemetry endpoint for QA and deployment safety gating.
 * Returns sanitized runtime configuration hashes without exposing secrets.
 */
export async function GET(request: NextRequest) {
  const auth = validateInternalApiKey(request);
  if (!auth.authorized) {
    return unauthorizedResponse("Internal authentication required");
  }

  const dbUrl = process.env.DATABASE_URL || "";
  const dbIdentityMatch = dbUrl.match(/@([^:\/]+)(?::\d+)?\/([^?]+)/);
  const dbIdentity = dbIdentityMatch ? `${dbIdentityMatch[1]}/${dbIdentityMatch[2]}` : "unconfigured";
  const dbIdentityHash = crypto.createHash("sha256").update(dbIdentity).digest("hex");

  const provider = process.env.SIGAP_AI_PROVIDER || "bedrock";
  const evidenceStore = process.env.SIGAP_EVIDENCE_STORE || (process.env.SIGAP_S3_BUCKET_NAME ? "s3" : "local");
  const erpMode = process.env.SAP_MODE || "simulator";
  const testMode = process.env.SIGAP_TEST_MODE === "1";

  return NextResponse.json({
    success: true,
    data: {
      testMode,
      dbIdentityHash,
      provider,
      evidenceStore,
      erpMode,
      nodeVersion: process.version,
    },
  });
}
