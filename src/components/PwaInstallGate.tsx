"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || Boolean(("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone));
}

export function PwaInstallGate() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mobileBrowser, setMobileBrowser] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [showBrowserInstructions, setShowBrowserInstructions] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(userAgent)
      || (userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const ios = /iPad|iPhone|iPod/i.test(userAgent)
      || (userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const safari = /^((?!CriOS|FxiOS|EdgiOS|OPiOS).)*Safari/i.test(userAgent);
    const detectTimer = window.setTimeout(() => {
      setMobileBrowser(mobile);
      setIosSafari(ios && safari);
      setInstalled(isStandalone());
    }, 0);

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      if (!isStandalone()) setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.clearTimeout(detectTimer);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      if (choice.outcome === "dismissed") setShowBrowserInstructions(true);
      setInstallPrompt(null);
      return;
    }
    if (iosSafari) setShowIosInstructions(true);
    else setShowBrowserInstructions(true);
  };

  const mustInstall = mobileBrowser && !installed && (Boolean(installPrompt) || iosSafari || showBrowserInstructions);
  if (!mustInstall) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-200/95 px-5 py-8 backdrop-blur-sm dark:bg-slate-950/95">
      <div className="mx-auto flex min-h-full w-full max-w-[430px] items-center">
        <div className="w-full rounded-[30px] bg-white p-6 text-center shadow-2xl ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <Image src="/brand/titan-wallet.png" alt="Titan Wallet" width={76} height={76} className="mx-auto h-[76px] w-[76px] rounded-[22px] object-cover shadow-lg" priority />
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-blue-600">Titan Wallet</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Install to continue</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">Install Titan Wallet on your phone for the full app experience.</p>
          <button onClick={install} className="mt-7 h-14 w-full rounded-2xl bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/20">
            Install Titan Wallet
          </button>
          {showIosInstructions ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left dark:bg-slate-800">
              <p className="font-bold text-slate-950 dark:text-white">Add to Home Screen</p>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <li>1. Tap Share in Safari.</li>
                <li>2. Choose Add to Home Screen.</li>
                <li>3. Tap Add, then open Titan Wallet.</li>
              </ol>
              <button onClick={() => window.location.reload()} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white dark:bg-slate-700">I installed it</button>
            </div>
          ) : null}
          {showBrowserInstructions ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left dark:bg-slate-800">
              <p className="font-bold text-slate-950 dark:text-white">Install from Chrome</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Open the browser menu, choose Install app, then reopen Titan Wallet from your home screen.</p>
              <button onClick={() => window.location.reload()} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white dark:bg-slate-700">Check installation</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
