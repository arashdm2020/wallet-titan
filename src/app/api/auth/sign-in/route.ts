import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/server/walletService";
import { createSession, sessionCookieName } from "@/server/session";
import { apiError } from "@/server/api";
import { isSecureRequest } from "@/server/cookies";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = authenticate(String(body.username || ""), String(body.password || ""));
    if (!user) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
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
