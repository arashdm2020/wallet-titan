"use client";

import type { ReactNode } from "react";
import { PwaRegister } from "@/components/PwaRegister";
import { ToastProvider } from "@/components/ToastProvider";
import { WalletStoreProvider } from "@/state/walletStore";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WalletStoreProvider>
        <PwaRegister />
        {children}
      </WalletStoreProvider>
    </ToastProvider>
  );
}
