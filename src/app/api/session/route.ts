import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/server/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  return NextResponse.json({ session });
}

