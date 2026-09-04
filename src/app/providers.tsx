"use client";

import type { ReactNode } from "react";
import { PwaRegister } from "@/components/PwaRegister";
import { PwaInstallGate } from "@/components/PwaInstallGate";
import { ToastProvider } from "@/components/ToastProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WalletStoreProvider } from "@/state/walletStore";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <WalletStoreProvider>
          <PwaRegister />
          <PwaInstallGate />
          {children}
        </WalletStoreProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
