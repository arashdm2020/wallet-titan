"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QrCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value || "titan-wallet", {
      width: 220,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });
  }, [value]);

  return <canvas ref={canvasRef} data-testid="receive-qr" className="h-[220px] w-[220px] rounded-3xl bg-white p-2 shadow-inner" aria-label="QR code containing configured display address" />;
}
