import { NextRequest, NextResponse } from "next/server";

/**
 * Memvalidasi kunci API bersama (Shared Secret API Key) untuk endpoint internal
 * yang hanya boleh diakses oleh service AI engineer (inference & agent orchestration).
 *
 * Mendukung autentikasi melalui:
 * - Header: 'x-api-key: <INTERNAL_API_KEY>'
 * - Header: 'Authorization: Bearer <INTERNAL_API_KEY>'
 */
export function validateInternalApiKey(request: NextRequest): {
  authorized: boolean;
  error?: string;
} {
  const expectedKey =
    process.env.INTERNAL_API_KEY || "sigap-internal-dev-key-2026";

  const xApiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  const providedKey = xApiKey?.trim() || bearerToken;

  if (!providedKey) {
    return {
      authorized: false,
      error:
        "Unauthorized: Header 'x-api-key' atau 'Authorization: Bearer <token>' wajib disertakan.",
    };
  }

  if (providedKey !== expectedKey) {
    return {
      authorized: false,
      error: "Unauthorized: API Key yang diberikan tidak valid.",
    };
  }

  return { authorized: true };
}

/**
 * Helper pembuat response 401 Unauthorized standar
 */
export function unauthorizedResponse(
  message = "Unauthorized: Kredensial API Key internal tidak valid."
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": "ApiKey realm='SIGAP Internal API'",
      },
    }
  );
}
