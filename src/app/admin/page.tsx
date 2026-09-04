"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { LoadingButtonContent, PageLoader, Spinner } from "@/components/LoadingUI";
import { useToast } from "@/components/ToastProvider";
import type { WalletTransfer } from "@/domain/wallet";
import { formatCrypto, formatDateTime } from "@/utils/formatters";

interface AdminSnapshot {
  users: { id: string; username: string; displayName: string; role: "ADMIN" | "USER"; enabled: boolean; walletId: string }[];
  balances: { walletId: string; assetId: string; symbol: string; amount: number; amountDisplay: string }[];
  assets: { id: string; symbol: string; name: string; network: string; displayAddress: string; enabled: boolean; withdrawalEnabled: boolean; withdrawalAvailableAt?: string }[];
  settings: {
    immediate_enabled: number;
    scheduled_enabled: number;
    default_settlement_mode: "immediate" | "scheduled";
    default_duration_minutes: number;
    default_duration_seconds?: number;
    max_duration_minutes: number;
    max_duration_seconds?: number;
    processing_reason: string;
  };
  transfers: WalletTransfer[];
}

export default function AdminPage() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const toast = useToast();

  const load = async () => {
    const response = await fetch("/api/admin/snapshot");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Admin access required");
      return;
    }
    setSnapshot(data);
    setError("");
  };

  const adminAction = async (body: Record<string, unknown>) => {
    setActionBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Admin action failed");
        toast({ tone: "error", title: "Admin action failed", description: data.error || "Unable to save changes" });
        return;
      }
      setSnapshot(data);
      setMessage("Saved.");
      toast({ tone: "success", title: "Saved", description: "Admin changes were applied." });
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, []);

  if (error && !snapshot) {
    return (
      <PhoneShell>
        <section className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <Link href="/" className="text-sm font-semibold text-blue-600">Wallet</Link>
          <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-900">{error}</div>
        </section>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <section className="screen-enter px-5 py-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Admin</h1>
            <p className="mt-1 text-sm text-slate-500">Development-only controls</p>
          </div>
          <Link href="/" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">Wallet</Link>
        </div>

        {message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{error}</div> : null}
        {!snapshot ? <PageLoader label="Loading admin data" /> : (
          <>
            <CreateUserForm onSubmit={adminAction} busy={actionBusy} />
            <UsersPanel snapshot={snapshot} onSubmit={adminAction} busy={actionBusy} />
            <AssetsPanel snapshot={snapshot} onSubmit={adminAction} busy={actionBusy} />
            <SettingsForm snapshot={snapshot} onSubmit={adminAction} busy={actionBusy} />
            <BalancesPanel snapshot={snapshot} onSubmit={adminAction} busy={actionBusy} />
            <TransferForm snapshot={snapshot} onSubmit={adminAction} busy={actionBusy} />
            <TransfersPanel transfers={snapshot.transfers} />
          </>
        )}
      </section>
    </PhoneShell>
  );
}

function UsersPanel({ snapshot, onSubmit, busy }: { snapshot: AdminSnapshot; onSubmit: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  return (
    <div className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">Users</h2>
      <div className="mt-3 divide-y divide-slate-100">
        {snapshot.users.map((user) => (
          <div key={user.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-sm text-slate-500">{user.username} · {user.role} · {user.enabled ? "enabled" : "disabled"}</p>
              </div>
              <button
                disabled={busy || user.role === "ADMIN"}
                onClick={() => onSubmit({ action: "setUserEnabled", userId: user.id, enabled: !user.enabled })}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
              >
                {user.enabled ? "Disable" : "Enable"}
              </button>
            </div>
            <form className="mt-2 grid grid-cols-[1fr_92px] gap-2" onSubmit={(event) => { event.preventDefault(); onSubmit({ action: "resetPassword", userId: user.id, password: passwords[user.id] || "" }); }}>
              <input type="password" placeholder="New password" value={passwords[user.id] || ""} onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              <button disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 text-xs font-bold text-white disabled:opacity-60">
                {busy ? <Spinner size="sm" /> : null}
                <span>Reset</span>
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetsPanel({ snapshot, onSubmit, busy }: { snapshot: AdminSnapshot; onSubmit: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const emptyAsset = { id: "", symbol: "", name: "", network: "", displayAddress: "", enabled: true, withdrawalEnabled: false, withdrawalAvailableAt: "" };
  const [draft, setDraft] = useState(emptyAsset);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ action: "saveAsset", ...draft });
        setDraft(emptyAsset);
      }}
      className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100"
    >
      <h2 className="font-bold">{draft.id ? "Edit asset" : "Add asset"}</h2>
      <div className="mt-3 divide-y divide-slate-100">
        {snapshot.assets.map((asset) => (
          <div key={asset.id} className="flex items-center gap-2 py-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDraft({ ...asset, withdrawalAvailableAt: asset.withdrawalAvailableAt || "" })}>
              <p className="font-semibold">{asset.name} ({asset.symbol})</p>
              <p className="truncate text-sm text-slate-500">{asset.network} · {asset.enabled ? "enabled" : "disabled"}</p>
            </button>
            <button type="button" disabled={busy} onClick={() => onSubmit({ action: "deleteAsset", assetId: asset.id })} className="text-sm font-bold text-rose-600 disabled:opacity-50">Remove</button>
          </div>
        ))}
      </div>
      <Field label="Symbol" value={draft.symbol} onChange={(value) => setDraft({ ...draft, symbol: value })} />
      <Field label="Display name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <Field label="Network" value={draft.network} onChange={(value) => setDraft({ ...draft, network: value })} />
      <Field label="Display address" value={draft.displayAddress} onChange={(value) => setDraft({ ...draft, displayAddress: value })} />
      <Field label="Withdrawal available at" value={draft.withdrawalAvailableAt || ""} onChange={(value) => setDraft({ ...draft, withdrawalAvailableAt: value })} />
      <Toggle label="Enabled" checked={draft.enabled} onChange={(value) => setDraft({ ...draft, enabled: value })} />
      <Toggle label="Withdrawal enabled" checked={draft.withdrawalEnabled} onChange={(value) => setDraft({ ...draft, withdrawalEnabled: value })} />
      <button disabled={busy} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-bold text-white disabled:opacity-60">
        <LoadingButtonContent loading={busy} loadingLabel="Saving...">Save asset</LoadingButtonContent>
      </button>
      {draft.id ? <button type="button" onClick={() => setDraft(emptyAsset)} className="mt-2 w-full py-2 text-sm font-bold text-blue-600">Clear asset form</button> : null}
    </form>
  );
}

function CreateUserForm({ onSubmit, busy }: { onSubmit: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("password123");
  const [displayName, setDisplayName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({ action: "createUser", username, password, displayName });
    setUsername("");
    setDisplayName("");
  };
  return (
    <form onSubmit={submit} className="mt-6 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">Create user wallet</h2>
      <Field label="Username" value={username} onChange={setUsername} />
      <Field label="Display name" value={displayName} onChange={setDisplayName} />
      <Field label="Temporary password" value={password} onChange={setPassword} type="password" />
      <button disabled={busy} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 font-bold text-white disabled:opacity-60">
        <LoadingButtonContent loading={busy} loadingLabel="Creating...">Create zero-balance wallet</LoadingButtonContent>
      </button>
    </form>
  );
}

function SettingsForm({ snapshot, onSubmit, busy }: { snapshot: AdminSnapshot; onSubmit: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [defaultMode, setDefaultMode] = useState(snapshot.settings.default_settlement_mode);
  const defaultSeconds = snapshot.settings.default_duration_seconds ?? snapshot.settings.default_duration_minutes * 60;
  const maxSeconds = snapshot.settings.max_duration_seconds ?? snapshot.settings.max_duration_minutes * 60;
  const [durationHours, setDurationHours] = useState(String(Math.floor(defaultSeconds / 3600)));
  const [durationMinutes, setDurationMinutes] = useState(String(Math.floor((defaultSeconds % 3600) / 60)));
  const [maxDurationHours, setMaxDurationHours] = useState(String(Math.floor(maxSeconds / 3600)));
  const [maxDurationMinutes, setMaxDurationMinutes] = useState(String(Math.floor((maxSeconds % 3600) / 60)));
  const [reason, setReason] = useState(snapshot.settings.processing_reason);
  const [immediateEnabled, setImmediateEnabled] = useState(Boolean(snapshot.settings.immediate_enabled));
  const [scheduledEnabled, setScheduledEnabled] = useState(Boolean(snapshot.settings.scheduled_enabled));
  const defaultDurationSeconds = Math.max(0, Number(durationHours || 0) * 3600 + Number(durationMinutes || 0) * 60);
  const maxDurationSeconds = Math.max(0, Number(maxDurationHours || 0) * 3600 + Number(maxDurationMinutes || 0) * 60);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ action: "updateSettings", defaultMode, defaultDurationSeconds, maxDurationSeconds, processingReason: reason, immediateEnabled, scheduledEnabled });
      }}
      className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100"
    >
      <h2 className="font-bold">Transfer settlement</h2>
      <label className="mt-4 block text-sm font-semibold text-slate-600">Default mode</label>
      <select value={defaultMode} onChange={(event) => setDefaultMode(event.target.value as "immediate" | "scheduled")} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <option value="scheduled">Scheduled</option>
        <option value="immediate">Immediate</option>
      </select>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Hours" value={durationHours} onChange={setDurationHours} inputMode="numeric" />
        <Field label="Minutes" value={durationMinutes} onChange={setDurationMinutes} inputMode="numeric" />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">Scheduled duration: {formatDuration(defaultDurationSeconds)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Max hours" value={maxDurationHours} onChange={setMaxDurationHours} inputMode="numeric" />
        <Field label="Max minutes" value={maxDurationMinutes} onChange={setMaxDurationMinutes} inputMode="numeric" />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">Maximum duration: {formatDuration(maxDurationSeconds)}</p>
      <Field label="Processing reason" value={reason} onChange={setReason} />
      <Toggle label="Immediate enabled" checked={immediateEnabled} onChange={setImmediateEnabled} />
      <Toggle label="Scheduled enabled" checked={scheduledEnabled} onChange={setScheduledEnabled} />
      <button disabled={busy} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-bold text-white disabled:opacity-60">
        <LoadingButtonContent loading={busy} loadingLabel="Saving...">Save settings</LoadingButtonContent>
      </button>
    </form>
  );
}

function BalancesPanel({ snapshot, onSubmit, busy }: { snapshot: AdminSnapshot; onSubmit: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  return (
    <div className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">Wallet balances</h2>
      <div className="mt-3 space-y-3">
        {snapshot.users.map((user) => (
          <div key={user.id} className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold">{user.displayName} <span className="text-xs text-slate-400">{user.role}</span></p>
            <div className="mt-2 space-y-2">
              {snapshot.assets.map((asset) => {
                const balance = snapshot.balances.find((item) => item.walletId === user.walletId && item.assetId === asset.id);
                return <BalanceEditor key={asset.id} walletId={user.walletId} asset={asset} amount={balance?.amountDisplay || "0"} onSubmit={onSubmit} busy={busy} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceEditor({ walletId, asset, amount, onSubmit, busy }: { walletId: string; asset: AdminSnapshot["assets"][number]; amount: string; onSubmit: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [value, setValue] = useState(amount);
  return (
    <form className="grid grid-cols-[1fr_92px] items-center gap-2" onSubmit={(event) => { event.preventDefault(); onSubmit({ action: "setBalance", walletId, assetId: asset.id, amount: value }); }}>
      <label className="min-w-0 text-sm font-semibold text-slate-600">
        {asset.symbol}
        <input value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
      </label>
      <button disabled={busy} className="mt-6 inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-slate-900 text-sm font-bold text-white disabled:opacity-60">
        {busy ? <Spinner size="sm" /> : null}
        <span>Set</span>
      </button>
    </form>
  );
}

function TransferForm({ snapshot, onSubmit, busy }: { snapshot: AdminSnapshot; onSubmit: (body: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const admin = useMemo(() => snapshot.users.find((user) => user.role === "ADMIN"), [snapshot.users]);
  const [recipient, setRecipient] = useState("");
  const [assetId, setAssetId] = useState(snapshot.assets[0]?.id || "");
  const [amount, setAmount] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ action: "createTransfer", senderWalletId: admin?.walletId, recipient, assetId, amount });
      }}
      className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100"
    >
      <h2 className="font-bold">Send from ADMIN wallet</h2>
      <Field label="Recipient username or address" value={recipient} onChange={setRecipient} />
      <label className="mt-4 block text-sm font-semibold text-slate-600">Asset</label>
      <select value={assetId} onChange={(event) => setAssetId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        {snapshot.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.symbol})</option>)}
      </select>
      <Field label="Amount" value={amount} onChange={setAmount} inputMode="decimal" />
      <p className="mt-3 text-xs font-semibold text-slate-500">Uses current settlement mode: {snapshot.settings.default_settlement_mode}</p>
      <button disabled={busy} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-bold text-white disabled:opacity-60">
        <LoadingButtonContent loading={busy} loadingLabel="Creating...">Create transfer</LoadingButtonContent>
      </button>
    </form>
  );
}

function TransfersPanel({ transfers }: { transfers: WalletTransfer[] }) {
  return (
    <div className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">Active transfers</h2>
      <div className="mt-3 divide-y divide-slate-100">
        {transfers.map((transfer) => (
          <Link key={transfer.id} href={`/transfer/${transfer.id}`} className="block py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{transfer.senderUsername} to {transfer.recipientUsername}</p>
                <p className="text-sm text-slate-500">{formatCrypto(transfer.amount, transfer.symbol)} · {transfer.settlementMode} · {transfer.status}</p>
              </div>
              <p className="text-sm font-bold text-blue-600">{transfer.progress.toFixed(1)}%</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <p>Started {formatDateTime(transfer.createdAt)}</p>
              <p>Completion {transfer.availableAt ? formatDateTime(transfer.availableAt) : formatDateTime(transfer.completedAt)}</p>
              <p>Processed {formatCrypto(transfer.processingAmount, transfer.symbol)}</p>
              <p>Remaining {formatCrypto(transfer.remainingAmount, transfer.symbol)}</p>
            </div>
          </Link>
        ))}
        {!transfers.length ? <p className="py-4 text-sm text-slate-500">No transfers yet.</p> : null}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "decimal" | "numeric" }) {
  return (
    <label className="mt-4 block text-sm font-semibold text-slate-600">
      {label}
      <input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500 focus:bg-white" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-600">
      {label}
      <input className="h-6 w-11" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}
