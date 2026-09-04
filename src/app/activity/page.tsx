"use client";

import Link from "next/link";
import { AssetIcon } from "@/components/AssetIcon";
import { AuthRequired } from "@/components/AuthRequired";
import { StatusPill } from "@/components/StatusPill";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";
import { formatCrypto, formatDateTime } from "@/utils/formatters";

export default function ActivityPage() {
  const { session, loading, activities, getAsset } = useWalletStore();

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-black">Activity</h1>
        <p className="mt-1 text-sm text-slate-500">Recent transfers</p>

        <div className="mt-6 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => {
              const asset = getAsset(activity.assetId);
              return (
                <Link key={activity.id} href={`/transfer/${activity.id}`} className="block py-4">
                  <div className="flex items-center gap-3">
                    <AssetIcon asset={asset} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold capitalize">{activity.type} {asset?.symbol}</p>
                      <p className="truncate text-sm text-slate-500">{formatDateTime(activity.timestamp)}</p>
                    </div>
                    <StatusPill status={activity.status} />
                  </div>
                  <p className="mt-3 font-semibold">{formatCrypto(activity.amount, asset?.symbol || "")}</p>
                  {activity.status === "processing" && activity.type === "send" ? (
                    <p className="mt-1 text-xs font-semibold text-amber-600">Pending completion ({formatCrypto(activity.pendingAmount || Math.abs(activity.amount), asset?.symbol || "")})</p>
                  ) : null}
                  {activity.status === "processing" && activity.type === "receive" ? (
                    <p className="mt-1 text-xs font-semibold text-blue-600">
                      Processed {formatCrypto(activity.processingAmount || 0, asset?.symbol || "")} · Remaining {formatCrypto(activity.remainingAmount || 0, asset?.symbol || "")}
                    </p>
                  ) : null}
                  <p className="mt-1 truncate text-xs text-slate-400">Transfer reference {activity.txHash || "not available"}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </WalletLayout>
  );
}
