import Link from "next/link";
import type { ReactNode } from "react";

export function ActionButton({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 text-sm font-semibold text-slate-700">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-lg text-white shadow-lg shadow-blue-600/20">{children}</span>
      {label}
    </Link>
  );
}
