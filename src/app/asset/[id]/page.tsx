"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { AuthRequired } from "@/components/AuthRequired";
import { AssetIcon } from "@/components/AssetIcon";
import { StatusPill } from "@/components/StatusPill";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";
import { formatCrypto, formatDateTime, formatPercent, formatUsd, shortAddress } from "@/utils/formatters";
import { getWithdrawalState } from "@/utils/withdrawal";

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const { session, getPortfolioAsset, getActivities, now, loading } = useWalletStore();
  const asset = getPortfolioAsset(params.id);

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;
  if (!asset && !loading) notFound();
  if (!asset) return <WalletLayout><div className="p-6">Loading asset</div></WalletLayout>;

  const withdrawal = getWithdrawalState(asset, now);
  const activities = getActivities(asset.id).slice(0, 4);

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm font-semibold text-blue-600">Back</Link>

        <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <AssetIcon asset={asset} size="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black">{asset.name}</h1>
              <p className="text-sm text-slate-500">{asset.symbol} on {asset.network}</p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-500">Simulated balance</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{formatCrypto(asset.balance, asset.symbol)}</p>
            <p className="mt-1 text-lg font-bold text-slate-500">{formatUsd(asset.usdValue)}</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">{asset.symbol}/USD price</p>
              <p className="mt-1 font-bold">{formatUsd(asset.usdPrice)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">24h movement</p>
              <p className={`mt-1 font-bold ${asset.change24h && asset.change24h >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{asset.stalePrice ? "stale" : formatPercent(asset.change24h)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <ActionButton href={`/send/${asset.id}`} label="Send">↑</ActionButton>
          <ActionButton href={`/receive/${asset.id}`} label="Receive">↓</ActionButton>
        </div>

        <div className="mt-6 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="font-bold">Withdrawal</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {withdrawal.available ? "Withdrawal available" : `Withdrawal available ${formatDateTime(asset.withdrawalAvailableAt)}`}
          </p>
          {withdrawal.countdown ? <p data-testid="withdrawal-countdown" className="mt-1 text-sm font-bold text-blue-600">Available in {withdrawal.countdown}</p> : null}
        </div>

        <div className="mt-4 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="font-bold">Display address</p>
          <p className="mt-2 break-all text-sm text-slate-500">{shortAddress(asset.displayAddress)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">Simulator display data only. This address is never used for signing.</p>
        </div>

        <div className="mt-4 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">Activity</p>
            <Link href="/activity" className="text-sm font-semibold text-blue-600">View all</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => (
              <div key={activity.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold capitalize">{activity.type}</p>
                  <StatusPill status={activity.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{formatCrypto(activity.amount, asset.symbol)} · {formatDateTime(activity.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </WalletLayout>
  );
}
