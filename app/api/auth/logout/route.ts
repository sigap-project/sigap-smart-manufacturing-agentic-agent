import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    data: { loggedOut: true },
  });

  response.cookies.set({
    name: "sigap_session",
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
