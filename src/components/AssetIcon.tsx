import Image from "next/image";
import type { WalletAsset } from "@/domain/wallet";

const colorBySymbol: Record<string, string> = {
  TRX: "bg-red-600",
  BTC: "bg-amber-400",
  ETH: "bg-indigo-500",
  USDT: "bg-emerald-500",
};

export function AssetIcon({ asset, size = "h-11 w-11" }: { asset?: Pick<WalletAsset, "symbol" | "iconPath">; size?: string }) {
  if (asset?.iconPath) {
    const imageSize = size.includes("14") ? 56 : 44;
    return <Image src={asset.iconPath} alt="" width={imageSize} height={imageSize} className={`${size} rounded-full object-contain`} />;
  }

  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-full ${colorBySymbol[asset?.symbol || ""] || "bg-blue-600"} text-sm font-black text-white`}>
      {asset?.symbol?.slice(0, 1) || "$"}
    </div>
  );
}
