"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AssetIcon } from "@/components/AssetIcon";
import { AuthRequired } from "@/components/AuthRequired";
import { LoadingButtonContent, PageLoader } from "@/components/LoadingUI";
import { useToast } from "@/components/ToastProvider";
import { WalletAddressDisplay } from "@/components/WalletAddressDisplay";
import { WalletLayout } from "@/components/WalletLayout";
import { validateRecipientAddress } from "@/domain/address";
import { useWalletStore } from "@/state/walletStore";
import { formatCrypto, formatUsd } from "@/utils/formatters";
import { estimateNetworkFeeUsd } from "@/utils/networkFee";

export default function SendPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, getPortfolioAsset, loading, createTransfer } = useWalletStore();
  const asset = getPortfolioAsset(params.id);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [editingRecipient, setEditingRecipient] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const recipientValidation = useMemo(() => (asset ? validateRecipientAddress(recipient, asset) : { valid: false, error: "" }), [asset, recipient]);
  const numericAmount = Number(amount);
  const networkFeeUsd = estimateNetworkFeeUsd(numericAmount, asset?.usdPrice);
  const networkFeeAmount = asset?.usdPrice && networkFeeUsd > 0 ? networkFeeUsd / asset.usdPrice : 0;
  const availableBalance = asset?.availableBalance ?? asset?.balance ?? 0;
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount + networkFeeAmount <= availableBalance;

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;
  if (!asset && loading) return <WalletLayout><PageLoader label="Loading send flow" /></WalletLayout>;
  if (!asset) return <WalletLayout><div className="p-6">Asset not found</div></WalletLayout>;

  const canConfirm = Boolean(session) && recipientValidation.valid && amountValid;

  const confirm = async () => {
    setBusy(true);
    try {
      const transfer = await createTransfer({ assetId: asset.id, recipient, amount });
      toast({ tone: "success", title: "Transfer accepted", description: "Receipt is ready." });
      router.push(`/transfer/${transfer.id}`);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Transfer failed";
      toast({ tone: "error", title: "Transfer failed", description });
    } finally {
      setBusy(false);
    }
  };

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href={`/asset/${asset.id}`} className="text-sm font-semibold text-blue-600">Back</Link>
        <div className="mt-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <AssetIcon asset={asset} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black">Send {asset.symbol}</h1>
              <p className="text-sm text-slate-500">Available {formatCrypto(asset.availableBalance ?? asset.balance, asset.symbol)}</p>
            </div>
          </div>

          <label className="mt-6 block text-sm font-semibold text-slate-600" htmlFor="address">Recipient wallet</label>
          {recipient && recipientValidation.valid && !editingRecipient ? (
            <div className="mt-2">
              <WalletAddressDisplay address={recipient} network={asset.network} label="Recipient address" onEdit={() => setEditingRecipient(true)} />
            </div>
          ) : (
            <input
              id="address"
              type="text"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              onBlur={() => { if (recipientValidation.valid) setEditingRecipient(false); }}
              autoComplete="off"
              placeholder="Enter wallet address"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-blue-500 focus:bg-white"
            />
          )}
          {recipient && !recipientValidation.valid ? <p className="mt-2 text-xs font-semibold text-rose-500">{recipientValidation.error}</p> : null}

          <label className="mt-4 block text-sm font-semibold text-slate-600" htmlFor="amount">Amount</label>
          <div className="mt-2 flex gap-2">
            <input
              id="amount"
              value={amount}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder={`0.00 ${asset.symbol}`}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base outline-none focus:border-blue-500 focus:bg-white"
            />
            <button type="button" data-testid="max-send" onClick={() => setAmount(String(asset.availableBalance ?? asset.balance))} className="w-20 rounded-2xl bg-slate-900 text-sm font-bold text-white">MAX</button>
          </div>
          {amount && !amountValid ? <p className="mt-2 text-xs font-semibold text-rose-500">Enter an amount that covers the transfer and network fee.</p> : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Available</p>
              <p className="mt-1 font-bold">{formatCrypto(asset.availableBalance ?? asset.balance, asset.symbol)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Estimated network fee</p>
              <p className="mt-1 font-bold">{networkFeeUsd > 0 ? `${formatCrypto(networkFeeAmount, asset.symbol)} · ${formatUsd(networkFeeUsd)}` : "No fee"}</p>
            </div>
          </div>

          <button
            disabled={!canConfirm}
            onClick={confirm}
            data-testid="confirm-transfer"
            className="mt-4 h-[52px] w-full rounded-2xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/20 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
      <LoadingButtonContent loading={busy} loadingLabel="Confirming...">Confirm Transfer</LoadingButtonContent>
          </button>
        </div>

      </section>
    </WalletLayout>
  );
}
