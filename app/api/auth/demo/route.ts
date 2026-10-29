import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, getDemoSupervisor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/demo
 * One-click supervisor session for the homepage "Demo Supervisor" button (no password).
 * Set SIGAP_DEMO_LOGIN=off to disable it.
 */
export async function POST(request: NextRequest) {
  const user = getDemoSupervisor();
  if (!user) {
    return NextResponse.json({ success: false, error: "Demo login is disabled" }, { status: 404 });
  }

  // Browsers always send Origin on cross-site POSTs; refuse anything not from this host
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ success: false, error: "Cross-site request refused" }, { status: 403 });
  }

  const { cookieValue, csrfToken, expiresInSeconds } = createSessionCookie(user);

  const response = NextResponse.json({
    success: true,
    data: { actor: { id: user.userId, role: user.role }, csrfToken },
  });

  response.cookies.set({
    name: "sigap_session",
    value: cookieValue,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: expiresInSeconds,
  });

  return response;
}
