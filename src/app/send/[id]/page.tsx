"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AssetIcon } from "@/components/AssetIcon";
import { AuthRequired } from "@/components/AuthRequired";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";
import { formatCrypto, formatDateTime } from "@/utils/formatters";
import { getWithdrawalState } from "@/utils/withdrawal";

export default function SendPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, getPortfolioAsset, now, loading, createTransfer } = useWalletStore();
  const asset = getPortfolioAsset(params.id);
  const [amount, setAmount] = useState("");
  const [recipientUsername, setRecipientUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const withdrawal = useMemo(() => getWithdrawalState(asset, now), [asset, now]);

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;
  if (!asset && loading) return <WalletLayout><div className="p-6">Loading send flow</div></WalletLayout>;
  if (!asset) return <WalletLayout><div className="p-6">Asset not found</div></WalletLayout>;

  const canConfirm = withdrawal.available && Number(amount) > 0 && Number(amount) <= asset.balance && recipientUsername.trim().length > 0;

  const confirm = async () => {
    setBusy(true);
    setMessage("");
    try {
      const transfer = await createTransfer({ assetId: asset.id, recipientUsername, amount });
      router.push(`/transfer/${transfer.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link href={`/asset/${asset.id}`} className="text-sm font-semibold text-blue-600">Back</Link>
        <div className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <AssetIcon asset={asset} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black">Send {asset.symbol}</h1>
              <p className="text-sm text-slate-500">Balance {formatCrypto(asset.balance, asset.symbol)}</p>
            </div>
          </div>

          <label className="mt-8 block text-sm font-semibold text-slate-600" htmlFor="address">Recipient username</label>
          <input
            id="address"
            value={recipientUsername}
            onChange={(event) => setRecipientUsername(event.target.value)}
            placeholder="Existing simulator user"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-blue-500 focus:bg-white"
          />

          <label className="mt-5 block text-sm font-semibold text-slate-600" htmlFor="amount">Amount</label>
          <div className="mt-2 flex gap-2">
            <input
              id="amount"
              value={amount}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder={`0.00 ${asset.symbol}`}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-blue-500 focus:bg-white"
            />
            <button type="button" data-testid="max-send" onClick={() => setAmount(String(asset.balance))} className="w-20 rounded-2xl bg-slate-900 text-sm font-bold text-white">MAX</button>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">MAX uses spendable balance only. Processing incoming funds are locked.</p>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="font-bold">{withdrawal.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {withdrawal.available ? "Completing this flow creates only a simulated result." : `Withdrawal available ${formatDateTime(asset.withdrawalAvailableAt)}`}
            </p>
            {withdrawal.countdown ? <p data-testid="withdrawal-countdown" className="mt-1 text-sm font-bold text-blue-600">Available in {withdrawal.countdown}</p> : null}
          </div>

          <button
            disabled={!canConfirm}
            onClick={confirm}
            data-testid="confirm-simulated-send"
            className="mt-6 h-14 w-full rounded-2xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/20 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {busy ? "Creating Transfer" : "Confirm Simulated Transfer"}
          </button>
        </div>

        {message ? <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">{message}</div> : null}

        <p className="mt-5 text-sm leading-6 text-slate-500">
          This screen never signs transactions, connects to wallet credentials, or submits RPC requests.
        </p>
      </section>
    </WalletLayout>
  );
}
