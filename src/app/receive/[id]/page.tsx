"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AssetIcon } from "@/components/AssetIcon";
import { AuthRequired } from "@/components/AuthRequired";
import { QrCode } from "@/components/QrCode";
import { WalletAddressDisplay } from "@/components/WalletAddressDisplay";
import { WalletLayout } from "@/components/WalletLayout";
import { useWalletStore } from "@/state/walletStore";

export default function ReceivePage() {
  const params = useParams<{ id: string }>();
  const { session, getAsset, loading } = useWalletStore();
  const asset = getAsset(params.id);

  if (!session && !loading) return <WalletLayout><AuthRequired /></WalletLayout>;
  if (!asset && loading) return <WalletLayout><div className="p-6">Loading receive flow</div></WalletLayout>;
  if (!asset) return <WalletLayout><div className="p-6">Asset not found</div></WalletLayout>;

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

          <div className="mt-8">
            <WalletAddressDisplay address={asset.displayAddress} network={asset.network} label="Receiving address" showFull />
          </div>
        </div>
      </section>
    </WalletLayout>
  );
}
