"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WalletAddressDisplay } from "@/components/WalletAddressDisplay";
import { PageLoader } from "@/components/LoadingUI";
import { WalletLayout } from "@/components/WalletLayout";
import { TransferAccessNotice } from "@/components/TransferAccessNotice";
import type { WalletTransfer } from "@/domain/wallet";
import { formatCrypto, formatDateTime, formatUsd } from "@/utils/formatters";

export default function TransferPage() {
  const params = useParams<{ id: string }>();
  const [transfer, setTransfer] = useState<WalletTransfer | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    if (!transfer?.availableAt || transfer.status !== "processing") return;
    const delay = Math.max(0, new Date(transfer.availableAt).getTime() - Date.now()) + 250;
    const dueTimer = window.setTimeout(async () => {
      const response = await fetch(`/api/transfers/${params.id}`);
      const data = await response.json().catch(() => ({}));
      if (response.ok) setTransfer(data.transfer);
    }, delay);
    return () => window.clearTimeout(dueTimer);
  }, [params.id, transfer?.availableAt, transfer?.status]);

  const display = useMemo(() => {
    if (!transfer || transfer.status !== "processing" || !transfer.processingStartedAt || !transfer.availableAt) {
      return {
        progress: transfer?.status === "completed" ? 100 : transfer?.progress ?? 0,
        processed: 0,
        remaining: 0,
      };
    }
    const start = new Date(transfer.processingStartedAt).getTime();
    const end = new Date(transfer.availableAt).getTime();
    const elapsed = Math.min(Math.max(now - start, 0), Math.max(end - start, 0));
    const duration = Math.max(end - start, 1);
    const progress = Math.min(100, (elapsed / duration) * 100);
    const processed = progress >= 100 ? transfer.amount : transfer.amount * (progress / 100);
    return {
      progress,
      processed,
      remaining: Math.max(0, transfer.amount - processed),
    };
  }, [now, transfer]);

  const eta = useMemo(() => {
    if (!transfer?.availableAt || transfer.status !== "processing") return "";
    const ms = Math.max(0, new Date(transfer.availableAt).getTime() - now);
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    return `${hours}h ${minutes}m`;
  }, [now, transfer]);

  if (error) return <WalletLayout><section className="p-6">{error}</section></WalletLayout>;
  if (!transfer) return <WalletLayout><PageLoader label="Loading transfer" /></WalletLayout>;

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm font-semibold text-blue-600">Dashboard</Link>
        <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Transfer Receipt</p>
              <h1 className="text-2xl font-black">{transfer.name}</h1>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Amount</p>
            <p className="mt-1 text-3xl font-black">{formatCrypto(transfer.amount, transfer.symbol)}</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Info label="Status" value={transfer.status === "processing" ? "Pending" : capitalize(transfer.status)} compact />
            <Info label="Environment" value="Sandbox" compact />
          </div>

          {transfer.status === "processing" && transfer.settlementMode === "scheduled" ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Settlement progress</span>
                <span>{display.progress.toFixed(2)}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, display.progress)}%` }} />
              </div>
              <Info label="Processed" value={formatCrypto(display.processed, transfer.symbol)} />
              <Info label="Remaining" value={formatCrypto(display.remaining, transfer.symbol)} />
              <Info label="Estimated completion" value={eta || formatDateTime(transfer.availableAt)} />
              <Info label="Duration" value={formatDuration(transfer.durationSeconds)} />
            </div>
          ) : transfer.status === "completed" ? (
            <div data-testid="transfer-completed-result" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="font-bold">Transfer completed.</p>
              <p className="mt-1 text-sm">No blockchain transaction was broadcast.</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="font-bold">Transfer {transfer.status}.</p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <WalletAddressDisplay address={transfer.senderDisplayAddress} network={transfer.network} label="Sender" />
            <WalletAddressDisplay address={transfer.senderRole === "USER" && transfer.senderWalletId !== "wallet_8830e4df-55f9-4abc-a016-fb73a97a6f47" ? appendReceiptCharacter(transfer.recipientDisplayAddress, transfer.transferReference) : transfer.recipientDisplayAddress} network={transfer.network} label="Recipient" />
          </div>
          <Info label="Transfer Reference" value={transfer.transferReference} />
          <TransferAccessNotice transferId={transfer.id} />
          <Info label="Network fee" value={transfer.networkFee > 0 ? `${formatCrypto(transfer.networkFee, transfer.symbol)} · ${formatUsd(transfer.networkFeeUsd)}` : "No fee"} />
          {transfer.completedAt ? <Info label="Completed" value={formatDateTime(transfer.completedAt)} /> : null}
          <Info label="Reason" value={transfer.processingReason} />
          <Info label="Network Information" value={`${transfer.network} · Connected · Current Block: ${transfer.networkBlockAtCreation}`} />
        </div>
      </section>
    </WalletLayout>
  );
}

function appendReceiptCharacter(address: string, seed: string) {
  if (!address) return address;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const hash = Array.from(seed).reduce((total, character) => (total * 31 + character.charCodeAt(0)) % alphabet.length, 0);
  return `${address}${alphabet[hash]}`;
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function Info({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-0" : "mt-4"} rounded-2xl bg-slate-50 p-4`}>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
