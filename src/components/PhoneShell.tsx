import type { ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-200 text-slate-950 md:flex md:items-center md:justify-center md:p-6">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#f7f9fc] shadow-2xl md:min-h-[860px] md:rounded-[32px] md:border md:border-white/70">
        {children}
      </div>
    </main>
  );
}
