import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/session";
import { createTransfer } from "@/server/transferService";
import { getTransfersForWallet } from "@/server/walletService";
import { apiError } from "@/server/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = requireSession(request);
    return NextResponse.json({ transfers: getTransfersForWallet(session.walletId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireSession(request);
    const body = await request.json();
    const transfer = createTransfer({
      senderWalletId: session.walletId,
      recipientUsername: String(body.recipientUsername || ""),
      assetId: String(body.assetId || ""),
      amount: String(body.amount || ""),
      settlementMode: body.settlementMode,
      durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
    });
    return NextResponse.json({ transfer });
  } catch (error) {
    return apiError(error);
  }
}

