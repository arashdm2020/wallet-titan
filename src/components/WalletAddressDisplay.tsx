"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface WalletAddressDisplayProps {
  address: string;
  network?: string;
  label?: string;
  showFull?: boolean;
  onEdit?: () => void;
}

export function WalletAddressDisplay({ address, network = "", label = "Wallet address", showFull = false, onEdit }: WalletAddressDisplayProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = address;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copiedWithFallback = document.execCommand("copy");
        textArea.remove();
        if (!copiedWithFallback) throw new Error("Copy command failed");
      }
      setCopied(true);
      toast({ tone: "success", title: "Address copied", description: "The wallet address is ready to paste." });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ tone: "error", title: "Copy failed", description: "Copy the address manually." });
    }
  };

  return (
    <div className="rounded-2xl bg-slate-50 p-4" data-testid="wallet-address-display">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900" title={address}>
            {showFull ? address : shortenAddress(address, network)}
          </p>
        </div>
        <button type="button" onClick={copyAddress} className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm ring-1 ring-slate-200">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {onEdit ? (
        <button type="button" onClick={onEdit} className="mt-3 text-xs font-bold text-slate-500">
          Edit address
        </button>
      ) : null}
    </div>
  );
}

function shortenAddress(address: string, network: string) {
  if (address.length <= 14) return address;
  const normalizedNetwork = network.toUpperCase();
  const isBitcoin = normalizedNetwork.includes("BITCOIN") || address.toLowerCase().startsWith("bc1");
  const isEthereum = normalizedNetwork.includes("ETHEREUM") || address.startsWith("0x");
  const leadingCharacters = isBitcoin ? 4 : 6;
  const trailingCharacters = isBitcoin ? 4 : isEthereum ? 6 : 4;
  return `${address.slice(0, leadingCharacters)}...${address.slice(-trailingCharacters)}`;
}
