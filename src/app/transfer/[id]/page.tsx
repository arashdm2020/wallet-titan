"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WalletLayout } from "@/components/WalletLayout";
import type { WalletTransfer } from "@/domain/wallet";
import { formatCrypto, formatDateTime } from "@/utils/formatters";

export default function TransferPage() {
  const params = useParams<{ id: string }>();
  const [transfer, setTransfer] = useState<WalletTransfer | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/transfers/${params.id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Transfer not found");
        return;
      }
      setTransfer(data.transfer);
    };
    load();
    const initialClock = window.setTimeout(() => setNow(Date.now()), 0);
    const refreshTimer = window.setInterval(load, 30_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialClock);
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [params.id]);

  const eta = useMemo(() => {
    if (!transfer?.availableAt || transfer.status !== "processing") return "";
    const ms = Math.max(0, new Date(transfer.availableAt).getTime() - now);
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    return `${hours}h ${minutes}m`;
  }, [now, transfer]);

  if (error) return <WalletLayout><section className="p-6">{error}</section></WalletLayout>;
  if (!transfer) return <WalletLayout><section className="p-6">Loading transfer</section></WalletLayout>;

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm font-semibold text-blue-600">Dashboard</Link>
        <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">{transfer.symbol} Transfer</p>
              <h1 className="text-2xl font-black capitalize">{transfer.status}</h1>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Amount</p>
            <p className="mt-1 text-3xl font-black">{formatCrypto(transfer.amount, transfer.symbol)}</p>
            <p className="mt-2 text-sm text-slate-500">No blockchain transaction was broadcast.</p>
          </div>

          {transfer.status === "processing" ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Settlement progress</span>
                <span>{transfer.progress.toFixed(1)}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, transfer.progress)}%` }} />
              </div>
              <Info label="Processing amount" value={formatCrypto(transfer.processingAmount, transfer.symbol)} />
              <Info label="Remaining" value={formatCrypto(transfer.remainingAmount, transfer.symbol)} />
              <Info label="Estimated completion" value={eta || formatDateTime(transfer.availableAt)} />
            </div>
          ) : (
            <div data-testid="simulated-transaction-result" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="font-bold">Simulated transaction completed.</p>
              <p className="mt-1 text-sm">No blockchain transaction was broadcast.</p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Info label="Sender" value={transfer.senderUsername} compact />
            <Info label="Recipient" value={transfer.recipientUsername} compact />
          </div>
          <Info label="Transfer Reference" value={transfer.transferReference} />
          <Info label="Reason" value={transfer.processingReason} />
          <Info label="Network Information" value={`${transfer.network} · Connected · Current Block: ${transfer.networkBlockAtCreation}`} />
        </div>
      </section>
    </WalletLayout>
  );
}

function Info({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-0" : "mt-4"} rounded-2xl bg-slate-50 p-4`}>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
