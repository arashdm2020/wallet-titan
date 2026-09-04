import type { MarketPriceResult, MarketQuote } from "@/domain/wallet";
import type { MarketPriceProvider } from "@/services/marketPriceProvider";

const CACHE_MS = 60_000;
const PRICE_STORAGE_KEY = "wallet-simulator-market-prices-v1";
const fallbackUsd: Record<string, number> = {
  TRX: 0.31,
  BTC: 81000,
  ETH: 2500,
  USDT: 1,
};

const emptyQuote = (symbol: string, error?: string): MarketQuote => ({
  symbol,
  usd: fallbackUsd[symbol] ?? null,
  change24h: null,
  fetchedAt: 0,
  stale: true,
  error,
});

export class CoinGeckoProvider implements MarketPriceProvider {
  private cache: MarketPriceResult = {};

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.cache = JSON.parse(window.localStorage.getItem(PRICE_STORAGE_KEY) || "{}");
      } catch {
        this.cache = {};
      }
    }
  }

  async getPrices(symbols: string[], options: { force?: boolean } = {}) {
    const normalized = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())));
    const now = Date.now();
    const shouldFetch = normalized.some((symbol) => {
      const cached = this.cache[symbol];
      return options.force || !cached || now - cached.fetchedAt > CACHE_MS;
    });

    if (shouldFetch) {
      try {
        const response = await fetch(`/api/market-prices?symbols=${normalized.join(",")}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Price request failed with HTTP ${response.status}`);
        }
        const payload = (await response.json()) as MarketPriceResult;
        this.cache = { ...this.cache, ...payload };
        this.persist();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to refresh prices";
        normalized.forEach((symbol) => {
          this.cache[symbol] = {
            ...(this.cache[symbol] || emptyQuote(symbol)),
            stale: true,
            error: message,
          };
        });
      }
    }

    return normalized.reduce<MarketPriceResult>((result, symbol) => {
      const quote = this.cache[symbol];
      result[symbol] = quote ? { ...quote, stale: quote.stale || now - quote.fetchedAt > CACHE_MS } : emptyQuote(symbol, "Price has not loaded");
      return result;
    }, {});
  }

  private persist() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(this.cache));
    }
  }
}

export const marketPriceProvider = new CoinGeckoProvider();
