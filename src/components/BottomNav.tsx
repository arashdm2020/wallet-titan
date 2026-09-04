"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Wallet", icon: "⌂" },
  { href: "/activity", label: "Activity", icon: "↕" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-slate-200 bg-white/95 px-6 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="grid grid-cols-3">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold ${active ? "text-blue-600" : "text-slate-500"}`}>
              <span className={`grid h-[37px] w-[37px] place-items-center rounded-full text-[21px] ${active ? "bg-blue-50" : ""}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
