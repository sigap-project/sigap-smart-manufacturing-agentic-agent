import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = verifySessionCookie(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "No active session" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      actor: {
        id: session.userId,
        role: session.role,
      },
      csrfToken: session.csrfToken,
    },
  });
}
