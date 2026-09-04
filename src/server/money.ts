export const assetDecimals: Record<string, number> = {
  BTC: 8,
  ETH: 8,
  TRX: 6,
  USDT: 6,
};

export function decimalsFor(symbol: string) {
  return assetDecimals[symbol.toUpperCase()] ?? 6;
}

export function parseAmountToAtoms(amount: string | number, symbol: string): bigint {
  const decimals = decimalsFor(symbol);
  const raw = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error("Amount must be a positive decimal");
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > decimals) throw new Error(`Amount has more than ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction.padEnd(decimals, "0") || "0"));
}

export function atomsToNumber(atoms: string | bigint, symbol: string): number {
  const decimals = decimalsFor(symbol);
  return Number(atoms) / 10 ** decimals;
}

export function atomsToDecimalString(atoms: string | bigint, symbol: string): string {
  const decimals = decimalsFor(symbol);
  const value = typeof atoms === "bigint" ? atoms : BigInt(atoms);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = String(absolute % base).padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function settledAtoms(totalAtoms: bigint, startedAt: string, availableAt: string, now = new Date()) {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(availableAt).getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return totalAtoms;
  if (nowMs >= endMs) return totalAtoms;
  if (nowMs <= startMs) return 0n;
  const elapsed = BigInt(nowMs - startMs);
  const duration = BigInt(endMs - startMs);
  return (totalAtoms * elapsed) / duration;
}
