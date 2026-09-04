"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { AuthRequired } from "@/components/AuthRequired";
import { InstallAppPanel } from "@/components/InstallAppPanel";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/ToastProvider";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";

export default function SettingsPage() {
  const { wallet, logout, session, loading, updateDisplayName } = useWalletStore();
  const { theme, toggleTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const displayName = String(form.get("displayName") || "");
    setBusy(true);
    try {
      await updateDisplayName(displayName);
      toast({ tone: "success", title: "Profile updated", description: "Your display name was saved." });
    } catch (error) {
      toast({ tone: "error", title: "Profile update failed", description: error instanceof Error ? error.message : "Unable to save profile" });
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    toast({ tone: "info", title: "Signed out" });
  };

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Settings</h1>
            <p className="mt-1 text-sm text-slate-500">Personalize your Titan Wallet experience</p>
          </div>
          <Image src="/brand/titan-wallet.png" alt="" width={48} height={48} className="h-12 w-12 rounded-2xl object-cover shadow-sm" priority />
        </div>

        <form key={wallet?.name || "profile"} onSubmit={saveProfile} className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="font-bold">Profile</p>
          <label className="mt-4 block text-sm font-semibold text-slate-600">
            Display name
            <input
              name="displayName"
              defaultValue={wallet?.name || ""}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500 focus:bg-white"
            />
          </label>
          <button disabled={busy} className="mt-4 h-12 w-full rounded-2xl bg-blue-600 font-bold text-white disabled:bg-slate-300">
            {busy ? "Saving" : "Save Profile"}
          </button>
        </form>

        <div className="mt-4 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="font-bold">Security</p>
          <div className="mt-3 space-y-2 text-sm text-slate-500">
            <p>Username: {session?.username}</p>
            <p>Environment: Sandbox</p>
            <p>No seed phrases or private keys are used.</p>
          </div>
          {session?.role === "ADMIN" ? (
            <Link href="/admin" className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-900">
              Open Admin
            </Link>
          ) : null}
          <button onClick={signOut} className="mt-3 h-12 w-full rounded-2xl bg-slate-900 font-bold text-white">
            Logout
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div>
            <p className="font-bold">Appearance</p>
            <p className="mt-1 text-sm text-slate-500">Use a darker interface in low light.</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            className={`relative h-8 w-14 rounded-full p-1 transition-colors ${theme === "dark" ? "bg-blue-600" : "bg-slate-200"}`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>

        <InstallAppPanel />
      </section>
    </WalletLayout>
  );
}
