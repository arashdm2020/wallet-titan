import { getDb } from "@/server/db";
import type { TransferAccess } from "@/domain/wallet";
import { formatIranTime } from "@/utils/transferAccess";

export function getTransferAccess(walletId: string, now = new Date()): TransferAccess {
  const account = getDb().prepare(`SELECT users.role, wallets.send_blocked_until, wallets.transfer_cooldown_exempt
    FROM wallets JOIN users ON users.id = wallets.user_id WHERE wallets.id = ?`)
    .get(walletId) as { role: string; send_blocked_until: string | null; transfer_cooldown_exempt: number } | undefined;
  if (!account) throw new Error("Wallet not found");
  const last = getDb().prepare(`SELECT id, transfer_reference, created_at FROM transfers
    WHERE sender_wallet_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`)
    .get(walletId) as { id: string; transfer_reference: string; created_at: string } | undefined;
  const limited = getDb().prepare(`SELECT MAX(created_at) AS created_at FROM transfers
    WHERE sender_wallet_id = ? AND status IN ('pending', 'processing', 'completed', 'failed')`)
    .get(walletId) as { created_at: string | null };
  const rollingEnd = account.role !== "ADMIN" && !account.transfer_cooldown_exempt && limited.created_at
    ? Date.parse(limited.created_at) + 86_400_000 : 0;
  const manualEnd = account.send_blocked_until ? Date.parse(account.send_blocked_until) : 0;
  const blockedUntil = Math.max(rollingEnd, manualEnd);
  return {
    lastTransferId: last?.id ?? null,
    lastTransferReference: last?.transfer_reference ?? null,
    lastTransferAt: last?.created_at ?? null,
    blockedUntil: blockedUntil ? new Date(blockedUntil).toISOString() : null,
    evaluatedAt: now.toISOString(),
  };
}

export class TransferAccessError extends Error {
  constructor(public readonly access: TransferAccess) {
    const last = access.lastTransferAt ? ` Last request: ${formatIranTime(access.lastTransferAt)} (${access.lastTransferReference}).` : "";
    super(`Sending is temporarily restricted.${last} Sending reopens: ${formatIranTime(access.blockedUntil!)}. Only one request is allowed per rolling 24 hours; the daily transfer limit is $500,000 USD. An additional account restriction may extend the reopening time.`);
    this.name = "TransferAccessError";
  }
}
