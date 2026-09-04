"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AssetIcon } from "@/components/AssetIcon";
import { AuthRequired } from "@/components/AuthRequired";
import { QrCode } from "@/components/QrCode";
import { useToast } from "@/components/ToastProvider";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";

export default function ReceivePage() {
  const params = useParams<{ id: string }>();
  const { session, getAsset, loading } = useWalletStore();
  const asset = getAsset(params.id);
  const toast = useToast();

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;
  if (!asset && loading) return <WalletLayout><div className="p-6">Loading receive flow</div></WalletLayout>;
  if (!asset) return <WalletLayout><div className="p-6">Asset not found</div></WalletLayout>;

  const copyAddress = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(asset.displayAddress);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = asset.displayAddress;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy command failed");
      }
      toast({ tone: "success", title: "Address copied", description: "The receiving address is ready to paste." });
    } catch {
      toast({ tone: "error", title: "Copy failed", description: "Copy the address manually from the field." });
    }
  };

  return (
    <WalletLayout>
      <section className="screen-enter px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link href={`/asset/${asset.id}`} className="text-sm font-semibold text-blue-600">Back</Link>
        <div className="mt-5 rounded-[28px] bg-white p-5 text-center shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3 text-left">
            <AssetIcon asset={asset} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black">Receive {asset.symbol}</h1>
              <p className="text-sm text-slate-500">{asset.network}</p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <QrCode value={asset.displayAddress} />
          </div>

          <p className="mt-8 text-sm font-semibold text-slate-500">Receiving address</p>
          <p className="mt-2 break-all rounded-2xl bg-slate-50 p-4 text-left text-sm font-semibold text-slate-900">{asset.displayAddress}</p>
          <button type="button" onClick={copyAddress} className="mt-3 h-12 w-full rounded-2xl bg-blue-600 font-bold text-white">
            Copy Address
          </button>
        </div>
      </section>
    </WalletLayout>
  );
}
