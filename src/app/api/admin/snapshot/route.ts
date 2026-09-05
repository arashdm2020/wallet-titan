import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/server/session";
import { createUserWallet, deleteAssetDefinition, getAdminSnapshot, resetUserPassword, saveAssetDefinition, setUserEnabled, setWalletBalance, updateSettlementSettings } from "@/server/walletService";
import { createTransfer } from "@/server/transferService";
import { apiError } from "@/server/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    return NextResponse.json(getAdminSnapshot());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireAdmin(request);
    const body = await request.json();
    if (body.action === "createUser") {
      createUserWallet({ username: String(body.username || ""), password: String(body.password || ""), displayName: body.displayName ? String(body.displayName) : undefined, role: "USER" });
    } else if (body.action === "setBalance") {
      setWalletBalance(String(body.walletId || ""), String(body.assetId || ""), String(body.amount || "0"));
    } else if (body.action === "setUserEnabled") {
      setUserEnabled(String(body.userId || ""), Boolean(body.enabled));
    } else if (body.action === "resetPassword") {
      resetUserPassword(String(body.userId || ""), String(body.password || ""));
    } else if (body.action === "saveAsset") {
      saveAssetDefinition({
        id: body.id ? String(body.id) : undefined,
        symbol: String(body.symbol || ""),
        name: String(body.name || ""),
        network: String(body.network || ""),
        displayAddress: String(body.displayAddress || ""),
        enabled: Boolean(body.enabled),
        withdrawalEnabled: Boolean(body.withdrawalEnabled),
        withdrawalAvailableAt: body.withdrawalAvailableAt ? String(body.withdrawalAvailableAt) : undefined,
      });
    } else if (body.action === "deleteAsset") {
      deleteAssetDefinition(String(body.assetId || ""));
    } else if (body.action === "updateSettings") {
      updateSettlementSettings({
        defaultMode: String(body.defaultMode || "scheduled"),
        defaultDurationSeconds: body.defaultDurationSeconds ? Number(body.defaultDurationSeconds) : undefined,
        defaultDurationMinutes: body.defaultDurationMinutes ? Number(body.defaultDurationMinutes) : undefined,
        maxDurationSeconds: body.maxDurationSeconds ? Number(body.maxDurationSeconds) : undefined,
        maxDurationMinutes: body.maxDurationMinutes ? Number(body.maxDurationMinutes) : undefined,
        dailyWithdrawalLimitUsdCents: body.dailyWithdrawalLimitUsdCents ? Number(body.dailyWithdrawalLimitUsdCents) : undefined,
        processingReason: String(body.processingReason || "Full ledger verification from block 0"),
        immediateEnabled: Boolean(body.immediateEnabled),
        scheduledEnabled: Boolean(body.scheduledEnabled),
      });
    } else if (body.action === "createTransfer") {
      createTransfer({
        senderWalletId: String(body.senderWalletId || session.walletId),
        recipient: String(body.recipient || body.recipientUsername || ""),
        assetId: String(body.assetId || ""),
        amount: String(body.amount || ""),
      });
    } else {
      throw new Error("Unknown admin action");
    }
    return NextResponse.json(getAdminSnapshot());
  } catch (error) {
    return apiError(error);
  }
}
