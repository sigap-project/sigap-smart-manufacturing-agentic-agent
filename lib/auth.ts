import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Actor, UserRole } from "./contracts";
import { prisma } from "./prisma";

export interface UserConfig {
  userId: string;
  role: UserRole;
  salt: string; // base64
  passwordHash: string; // base64
}

export interface SessionPayload {
  userId: string;
  role: UserRole;
  csrfToken: string;
  expiresAt: number; // ms
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getSessionSecret(): string {
  const secret = process.env.SIGAP_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SIGAP_SESSION_SECRET is not configured");
  }
  return secret;
}

function getUsers(): UserConfig[] {
  const raw = process.env.SIGAP_USERS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as UserConfig[];
  } catch {
    // Corrupted user config fails closed
  }
  return [];
}

export function authenticateUser(userId: string, password: string): UserConfig | null {
  const users = getUsers();
  const user = users.find((u) => u.userId === userId);
  if (!user) return null;

  try {
    const saltBuffer = Buffer.from(user.salt, "base64");
    const expectedHashBuffer = Buffer.from(user.passwordHash, "base64");
    const computedHashBuffer = crypto.scryptSync(password, saltBuffer, 64);

    if (
      computedHashBuffer.length === expectedHashBuffer.length &&
      crypto.timingSafeEqual(computedHashBuffer, expectedHashBuffer)
    ) {
      return user;
    }
  } catch {
    return null;
  }

  return null;
}

export function createSessionCookie(user: UserConfig): {
  cookieValue: string;
  csrfToken: string;
  expiresInSeconds: number;
} {
  const secret = getSessionSecret();
  const csrfToken = crypto.randomBytes(24).toString("hex");
  const expiresInSeconds = 8 * 60 * 60; // 8 hours
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  const payload: SessionPayload = {
    userId: user.userId,
    role: user.role,
    csrfToken,
    expiresAt,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const cookieValue = `${payloadB64}.${signature}`;
  return { cookieValue, csrfToken, expiresInSeconds };
}

export function verifySessionCookie(request: NextRequest): SessionPayload | null {
  const cookie = request.cookies.get("sigap_session")?.value;
  if (!cookie) return null;

  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  try {
    const secret = getSessionSecret();
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest("base64url");

    if (!safeEqual(signature, expectedSig)) return null;

    const payloadRaw = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(payloadRaw);

    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function validateDeviceToken(
  request: NextRequest,
  expectedDeviceId?: string
): Promise<{ authorized: boolean; deviceId?: string; batchId?: string; bindingVersion?: number; error?: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false, error: "Missing or invalid Bearer token" };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { authorized: false, error: "Empty Bearer token" };
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  try {
    const device = await prisma.device.findFirst({
      where: {
        tokenHash,
        enabled: true,
        ...(expectedDeviceId ? { id: expectedDeviceId } : {}),
      },
    });

    if (!device) {
      return { authorized: false, error: "Unrecognized or disabled device token" };
    }

    return {
      authorized: true,
      deviceId: device.id,
      batchId: device.batchId || undefined,
      bindingVersion: device.bindingVersion,
    };
  } catch (err) {
    return { authorized: false, error: "Database error during device validation" };
  }
}

export function validateInternalApiKey(request: NextRequest): {
  authorized: boolean;
  error?: string;
} {
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey) {
    return {
      authorized: false,
      error: "Internal API Key is not configured on server",
    };
  }

  const xApiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  const providedKey = xApiKey?.trim() || bearerToken;
  if (!providedKey) {
    return {
      authorized: false,
      error: "Unauthorized: Missing internal API Key",
    };
  }

  if (!safeEqual(providedKey, expectedKey)) {
    return {
      authorized: false,
      error: "Unauthorized: Invalid internal API Key",
    };
  }

  return { authorized: true };
}

export async function resolveActor(request: NextRequest): Promise<Actor | null> {
  // 1. Session Cookie (User)
  const session = verifySessionCookie(request);
  if (session) {
    return {
      type: "user",
      id: session.userId,
      role: session.role,
    };
  }

  // 2. Device Bearer Token
  const deviceCheck = await validateDeviceToken(request);
  if (deviceCheck.authorized && deviceCheck.deviceId) {
    return {
      type: "device",
      id: deviceCheck.deviceId,
      deviceId: deviceCheck.deviceId,
      batchId: deviceCheck.batchId,
    };
  }

  // 3. Server Internal Key (System/Operator)
  const internalCheck = validateInternalApiKey(request);
  if (internalCheck.authorized) {
    return {
      type: "user",
      id: "system-internal",
      role: "supervisor",
    };
  }

  return null;
}

export function unauthorizedResponse(message = "Unauthorized: Kredensial tidak valid.") {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": "Bearer realm='SIGAP API'",
      },
    }
  );
}

export function forbiddenResponse(message = "Forbidden: Akses ditolak untuk role ini.") {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 403 }
  );
}
