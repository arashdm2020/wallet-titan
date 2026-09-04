"use client";

import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallAppPanel() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);

  useEffect(() => {
    const detectStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      Boolean(("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone));

    const userAgent = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const safari = /^((?!CriOS|FxiOS|EdgiOS|OPiOS).)*Safari/i.test(userAgent);
    const detectTimer = window.setTimeout(() => {
      setInstalled(detectStandalone());
      setIsIosSafari(ios && safari);
    }, 0);

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      if (!detectStandalone()) setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosSheet(false);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.clearTimeout(detectTimer);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const installAvailable = useMemo(() => !installed && (installPrompt || isIosSafari), [installPrompt, installed, isIosSafari]);
  if (!installAvailable) return null;

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    setShowIosSheet(true);
  };

  return (
    <div className="mt-4 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold">Install App</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">Add this wallet to your home screen for a standalone app-style experience.</p>
        </div>
        <button onClick={install} className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">
          Install
        </button>
      </div>

      {showIosSheet ? (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-950/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="w-full rounded-t-[28px] bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
            <h2 className="text-xl font-black">Install App</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>1. Tap the Share button in Safari.</li>
              <li>2. Choose Add to Home Screen.</li>
              <li>3. Tap Add.</li>
            </ol>
            <button onClick={() => setShowIosSheet(false)} className="mt-5 h-12 w-full rounded-2xl bg-slate-900 font-bold text-white">
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
