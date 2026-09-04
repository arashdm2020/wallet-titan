import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/session";
import { getWalletSnapshot } from "@/server/walletService";
import { apiError } from "@/server/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireSession(request);
    return NextResponse.json(getWalletSnapshot(session));
  } catch (error) {
    return apiError(error);
  }
}

