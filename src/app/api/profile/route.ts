import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api";
import { requireSession } from "@/server/session";
import { updateUserDisplayName } from "@/server/walletService";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    const session = requireSession(request);
    const body = await request.json();
    updateUserDisplayName(session.userId, String(body.displayName || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
