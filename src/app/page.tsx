"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { AssetIcon } from "@/components/AssetIcon";
import { useToast } from "@/components/ToastProvider";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";
import { formatCrypto, formatPercent, formatUsd } from "@/utils/formatters";

export default function Home() {
  const { session, portfolio, loading, error, signIn, createWallet } = useWalletStore();

  if (!session && !loading) {
    return (
      <WalletLayout>
        <Onboarding error={error} onSignIn={signIn} onCreateWallet={createWallet} />
      </WalletLayout>
    );
  }

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="overflow-hidden rounded-[28px] bg-blue-700 text-white shadow-xl shadow-blue-900/20">
          <div className="bg-[url('/assets/images/banner.png')] bg-cover bg-center p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">Titan Wallet / Portfolio</p>
                <h1 className="text-2xl font-bold">{portfolio?.wallet.name || "Titan Wallet"}</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Sandbox</span>
                <Image src="/brand/titan-wallet.png" alt="" width={40} height={40} className="h-10 w-10 rounded-2xl object-cover shadow-lg shadow-blue-950/20" />
              </div>
            </div>

            <div className="mt-12 pb-4">
              <p className="text-sm text-blue-100">Total portfolio value</p>
              <p data-testid="portfolio-total" className="mt-2 text-4xl font-black tracking-tight">{formatUsd(portfolio?.totalUsdValue ?? 0)}</p>
              <p className="mt-2 text-sm text-blue-100">USD value from configured balances and market prices</p>
            </div>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div> : null}

        <div className="mt-6 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold">Assets</h2>
            <span className="text-xs font-semibold text-slate-400">{loading ? "Loading" : `${portfolio?.assets.length ?? 0} enabled`}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {portfolio?.assets.map((asset) => (
              <Link key={asset.id} href={`/asset/${asset.id}`} data-testid={`asset-row-${asset.id}`} className="flex items-center gap-3 py-4">
                <AssetIcon asset={asset} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">{asset.name}</p>
                  <p className="truncate text-sm text-slate-500">Available {formatCrypto(asset.availableBalance ?? asset.balance, asset.symbol)}</p>
                  {asset.pendingOutgoing ? (
                    <p className="mt-1 text-xs font-semibold text-amber-600">
                      Pending outgoing ({formatCrypto(asset.pendingOutgoing, asset.symbol)})
                    </p>
                  ) : null}
                  {asset.pendingIncomingTotal ? (
                    <p className="mt-1 text-xs font-semibold text-blue-600">
                      Incoming processing {formatCrypto(asset.processingIncoming || asset.processingAmount || 0, asset.symbol)} · Total {formatCrypto(asset.pendingIncomingTotal, asset.symbol)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p data-testid={`asset-value-${asset.id}`} className="font-bold text-slate-950">{formatUsd(asset.usdValue)}</p>
                  <p className={`text-xs font-semibold ${asset.change24h && asset.change24h >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {asset.stalePrice ? "stale" : formatPercent(asset.change24h)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <InfoTile title="Live markets" body="USD quotes refresh automatically" />
          <InfoTile title="Private access" body="Password-protected sessions" />
          <InfoTile title="PWA ready" body="Install from mobile browser" />
        </div>

      </section>
    </WalletLayout>
  );
}

function Onboarding({
  onSignIn,
  onCreateWallet,
}: {
  error: string | null;
  onSignIn: (username: string, password: string) => Promise<void>;
  onCreateWallet: (input: { username: string; password: string; confirmPassword: string; displayName?: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign-in") {
        await onSignIn(username, password);
        toast({ tone: "success", title: "Signed in", description: "Your portfolio is ready." });
      } else {
        await onCreateWallet({ username, password, confirmPassword });
        toast({ tone: "success", title: "Wallet created", description: "Your new balances start at zero." });
      }
    } catch (nextError) {
      const description = nextError instanceof Error ? nextError.message : "Unable to continue";
      toast({ tone: "error", title: mode === "sign-in" ? "Sign in failed" : "Wallet creation failed", description });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="overflow-hidden rounded-[28px] bg-blue-700 p-5 text-white shadow-xl shadow-blue-900/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-100">Secure portfolio access</p>
            <h1 className="text-3xl font-black">Titan Wallet</h1>
          </div>
          <Image src="/brand/titan-wallet.png" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-blue-950/20" priority />
        </div>
        <p className="mt-8 text-sm leading-6 text-blue-50">Track your crypto portfolio with live USD pricing, clean mobile flows, and a sandbox transfer ledger.</p>
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        <button className={`h-11 rounded-xl text-sm font-bold ${mode === "sign-in" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("sign-in")}>Sign In</button>
        <button className={`h-11 rounded-xl text-sm font-bold ${mode === "create" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("create")}>Create New</button>
      </div>

      <form onSubmit={submit} className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
        <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} />
        {mode === "create" ? <Field label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" autoComplete="new-password" /> : null}
        <button disabled={busy} className="mt-6 h-14 w-full rounded-2xl bg-blue-600 font-bold text-white disabled:bg-slate-300" type="submit">
          {busy ? "Working" : mode === "sign-in" ? "Sign In" : "Create New Wallet"}
        </button>
      </form>

      <div className="mt-5 rounded-[24px] bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm ring-1 ring-slate-100">
        <p className="font-bold text-slate-950">Built for fast portfolio reviews</p>
        <p className="mt-1">Balances, activity, QR receive screens, and transfer receipts are optimized for Android and iOS home-screen use.</p>
      </div>
    </section>
  );
}

function InfoTile({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-black text-slate-950">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{body}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return (
    <label className="mt-4 block text-sm font-semibold text-slate-600">
      {label}
      <input
        value={value}
        type={type}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-blue-500 focus:bg-white"
      />
    </label>
  );
}
