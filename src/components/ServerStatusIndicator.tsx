"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "checking" | "connected" | "offline";

export function ServerStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (active) setStatus(response.ok ? "connected" : "offline");
      } catch {
        if (active) setStatus("offline");
      }
    };

    check();
    const interval = window.setInterval(check, 30_000);
    const handleOffline = () => setStatus("offline");
    window.addEventListener("online", check);
    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const connected = status === "connected";
  const checking = status === "checking";
  return (
    <span
      title={checking ? "Checking server connection" : connected ? "Server connection active" : "Server connection unavailable"}
      aria-label={checking ? "Checking server connection" : connected ? "Server connected" : "Server unavailable"}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold text-white backdrop-blur"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${checking ? "bg-amber-300" : connected ? "bg-emerald-300" : "bg-rose-300"}`} />
      <span>{checking ? "Checking" : connected ? "Connected" : "Offline"}</span>
    </span>
  );
}
