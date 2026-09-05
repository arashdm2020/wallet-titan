import type { MarketPriceResult } from "@/domain/wallet";

const fallbackUsd: Record<string, number> = {
  TRX: 0.31,
  BTC: 81000,
  ETH: 2500,
  USDT: 1,
};

const lastKnownGood: Record<string, number> = { ...fallbackUsd };

export function rememberMarketPrices(result: MarketPriceResult) {
  for (const [symbol, quote] of Object.entries(result)) {
    if (typeof quote.usd === "number" && Number.isFinite(quote.usd) && quote.usd > 0) {
      lastKnownGood[symbol.toUpperCase()] = quote.usd;
    }
  }
}

export function getUsdPrice(symbol: string) {
  return lastKnownGood[symbol.toUpperCase()] ?? 0;
}
