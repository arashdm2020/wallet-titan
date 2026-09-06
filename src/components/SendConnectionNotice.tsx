"use client";

import { useEffect, useRef } from "react";

export function SendConnectionNotice({ onAcknowledge, onCancel }: { onAcknowledge: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="connection-notice-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-[398px] overflow-y-auto rounded-lg bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/50">
      <div lang="en" dir="ltr">
        <h2 id="connection-notice-title" className="text-lg font-bold">Connection notice for users in Iran</h2>
        <p className="mt-3 text-sm leading-7">Connection stability from Iran cannot be guaranteed, even when using a VPN. Titan is not responsible for transaction interruptions or delays caused by an unstable connection.</p>
      </div>
      <div className="mt-5 flex gap-3">
        <button type="button" autoFocus onClick={onCancel} className="h-12 flex-1 rounded-lg border border-slate-200 font-semibold">Cancel</button>
        <button type="button" onClick={() => { dialog.current?.close(); onAcknowledge(); }} className="h-12 flex-1 rounded-lg bg-blue-600 font-semibold text-white">I understand</button>
      </div>
    </dialog>
  );
}
