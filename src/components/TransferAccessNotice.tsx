"use client";

import Link from "next/link";
import { useWalletStore } from "@/state/walletStore";
import { formatIranTime, isTransferBlocked } from "@/utils/transferAccess";

export function TransferAccessNotice({ transferId }: { transferId?: string }) {
  const { transferAccess: access, now, serverTimeOffset } = useWalletStore();
  if (!access || (!access.lastTransferAt && !access.blockedUntil)) return null;
  if (transferId && access.lastTransferId !== transferId) return null;
  const blocked = isTransferBlocked(access, now + serverTimeOffset);
  const remaining = Math.max(0, Math.ceil(((access.blockedUntil ? Date.parse(access.blockedUntil) : 0) - now - serverTimeOffset) / 1000));
  return (
    <aside className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm" aria-label="Transfer request availability">
      <p className="font-bold">{blocked ? "Sending temporarily restricted" : "Sending available"}</p>
      {access.lastTransferAt ? (
        <p className="mt-2 text-slate-600">Last request: <time dateTime={access.lastTransferAt}>{formatIranTime(access.lastTransferAt)}</time></p>
      ) : null}
      {access.lastTransferId ? (
        <Link className="mt-1 block break-all font-semibold text-blue-600" href={`/transfer/${access.lastTransferId}`}>{access.lastTransferReference}</Link>
      ) : null}
      {access.blockedUntil ? (
        <p className="mt-2 font-semibold">{blocked ? "Sending reopens: " : "Restriction ended: "}<time dateTime={access.blockedUntil}>{formatIranTime(access.blockedUntil)}</time></p>
      ) : null}
      {blocked ? <p className="mt-1 tabular-nums text-slate-600">Remaining: {Math.floor(remaining / 3600)}h {Math.floor(remaining % 3600 / 60)}m {remaining % 60}s</p> : null}
    </aside>
  );
}
