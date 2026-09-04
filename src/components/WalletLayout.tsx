"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { PhoneShell } from "@/components/PhoneShell";
import { useWalletStore } from "@/state/walletStore";

export function WalletLayout({ children }: { children: ReactNode }) {
  const { session, loading } = useWalletStore();
  const showNav = Boolean(session) || loading;
  return (
    <PhoneShell>
      <div className="min-h-dvh pb-24 md:min-h-[860px]">{children}</div>
      {showNav ? <BottomNav /> : null}
    </PhoneShell>
  );
}
