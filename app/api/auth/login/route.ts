import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, password } = body;

    if (!userId || !password || typeof userId !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "userId and password are required" },
        { status: 400 }
      );
    }

    const user = authenticateUser(userId.trim(), password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const { cookieValue, csrfToken, expiresInSeconds } = createSessionCookie(user);

    const response = NextResponse.json({
      success: true,
      data: {
        actor: {
          id: user.userId,
          role: user.role,
        },
        csrfToken,
      },
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
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Authentication internal error" },
      { status: 500 }
    );
  }
}
