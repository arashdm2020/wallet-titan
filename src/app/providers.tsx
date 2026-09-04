"use client";

import type { ReactNode } from "react";
import { PwaRegister } from "@/components/PwaRegister";
import { WalletStoreProvider } from "@/state/walletStore";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletStoreProvider>
      <PwaRegister />
      {children}
    </WalletStoreProvider>
  );
}
