import type { MarketPriceResult, PortfolioSnapshot, WalletConfig } from "@/domain/wallet";

export class PortfolioService {
  buildPortfolio(wallet: WalletConfig, prices: MarketPriceResult): PortfolioSnapshot {
    const assets = wallet.assets
      .filter((asset) => asset.enabled)
      .map((asset) => {
        const quote = prices[asset.symbol];
        const usdPrice = quote?.usd ?? null;
        const usdValue = usdPrice === null ? 0 : asset.balance * usdPrice;

        return {
          ...asset,
          usdPrice,
          usdValue,
          change24h: quote?.change24h ?? null,
          stalePrice: Boolean(quote?.stale),
          priceError: quote?.error,
        };
      });

    return {
      wallet,
      assets,
      totalUsdValue: assets.reduce((sum, asset) => sum + asset.usdValue, 0),
      hasStalePrices: assets.some((asset) => asset.stalePrice),
    };
  }
}

export const portfolioService = new PortfolioService();
