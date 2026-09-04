import { NextResponse, type NextRequest } from "next/server";
import { revokeSession, sessionCookieName } from "@/server/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  revokeSession(request.cookies.get(sessionCookieName)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

