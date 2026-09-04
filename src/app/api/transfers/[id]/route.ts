import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/session";
import { getTransferByIdScoped } from "@/server/walletService";
import { apiError } from "@/server/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSession(request);
    const { id } = await context.params;
    const transfer = getTransferByIdScoped(id, session);
    if (!transfer) return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    return NextResponse.json({ transfer });
  } catch (error) {
    return apiError(error);
  }
}

