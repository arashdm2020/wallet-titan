import Link from "next/link";
import type { ReactNode } from "react";

export function ActionButton({ href, label, children, disabled = false }: { href: string; label: string; children: ReactNode; disabled?: boolean }) {
  const iconClassName = disabled
    ? "bg-slate-200 text-slate-400 shadow-none"
    : "bg-blue-600 text-white shadow-lg shadow-blue-600/20";
  const content = (
    <>
      <span className={`grid h-12 w-12 place-items-center rounded-full text-lg ${iconClassName}`}>{children}</span>
      {label}
    </>
  );

  if (disabled) {
    return <button type="button" disabled className="flex flex-col items-center gap-1 text-sm font-semibold text-slate-400 disabled:cursor-not-allowed">{content}</button>;
  }

  return (
    <Link href={href} className="flex flex-col items-center gap-1 text-sm font-semibold text-slate-700">
      {content}
    </Link>
  );
}
