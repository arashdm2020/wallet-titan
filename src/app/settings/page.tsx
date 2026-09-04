"use client";

import Link from "next/link";
import { AuthRequired } from "@/components/AuthRequired";
import { InstallAppPanel } from "@/components/InstallAppPanel";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";
import { formatDateTime } from "@/utils/formatters";

export default function SettingsPage() {
  const { wallet, portfolio, logout, session, loading } = useWalletStore();

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Settings</h1>
            <p className="mt-1 text-sm text-slate-500">{wallet?.name || "Wallet"}</p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="font-bold">About</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This is a cryptocurrency wallet simulator. It does not import real wallets, store private keys, sign transactions, or broadcast transactions.
          </p>
        </div>

        <InstallAppPanel />

        {session?.role === "ADMIN" ? (
          <Link href="/admin" className="mt-4 flex items-center justify-between rounded-[24px] bg-white p-5 font-bold shadow-sm ring-1 ring-slate-100">
            Development admin
            <span className="text-blue-600">Open</span>
          </Link>
        ) : null}

        <div className="mt-4 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="font-bold">Configuration</p>
          <div className="mt-3 space-y-2 text-sm text-slate-500">
            <p>Base currency: {wallet?.baseCurrency || "USD"}</p>
            <p>Enabled assets: {portfolio?.assets.length ?? 0}</p>
            <p>Last refresh: {formatDateTime(wallet?.updatedAt)}</p>
          </div>
        </div>

        <button onClick={logout} className="mt-4 h-14 w-full rounded-2xl bg-slate-900 font-bold text-white">
          Logout
        </button>
      </section>
    </WalletLayout>
  );
}
