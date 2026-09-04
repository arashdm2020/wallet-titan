import type { MarketPriceResult } from "@/domain/wallet";

export interface MarketPriceProvider {
  getPrices(symbols: string[], options?: { force?: boolean }): Promise<MarketPriceResult>;
}
