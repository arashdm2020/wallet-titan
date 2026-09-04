import { NextResponse, type NextRequest } from "next/server";
import { createUserWallet } from "@/server/walletService";
import { createSession, sessionCookieName } from "@/server/session";
import { apiError } from "@/server/api";
import { isSecureRequest } from "@/server/cookies";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = String(body.password || "").trim();
    if (password !== String(body.confirmPassword || "").trim()) throw new Error("Passwords do not match");
    const user = createUserWallet({
      username: String(body.username || ""),
      password,
      displayName: body.displayName ? String(body.displayName) : undefined,
      role: "USER",
    });
    const session = createSession(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(request),
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
