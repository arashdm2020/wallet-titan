import { NextRequest, NextResponse } from "next/server";
import type { MarketPriceResult } from "@/domain/wallet";
import { rememberMarketPrices } from "@/server/marketPriceProvider";

const coingeckoIds: Record<string, string> = {
  TRX: "tron",
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
};

const timeout = (ms: number) =>
  new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Market price request timed out")), ms);
  });

export async function GET(request: NextRequest) {
  const symbols = (request.nextUrl.searchParams.get("symbols") || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const ids = symbols.map((symbol) => coingeckoIds[symbol]).filter(Boolean);
  const now = Date.now();

  if (ids.length === 0) {
    return NextResponse.json({});
  }

  try {
    const response = await Promise.race([
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`, {
        headers: { accept: "application/json" },
        next: { revalidate: 30 },
      }),
      timeout(8_000),
    ]);

    if (!response.ok) {
      throw new Error(`CoinGecko returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const result = symbols.reduce<MarketPriceResult>((quotes, symbol) => {
      const id = coingeckoIds[symbol];
      const price = payload[id];
      quotes[symbol] = {
        symbol,
        usd: typeof price?.usd === "number" ? price.usd : null,
        change24h: typeof price?.usd_24h_change === "number" ? price.usd_24h_change : null,
        fetchedAt: now,
        stale: false,
      };
      return quotes;
    }, {});

    rememberMarketPrices(result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load market prices";
    const result = symbols.reduce<MarketPriceResult>((quotes, symbol) => {
      quotes[symbol] = {
        symbol,
        usd: null,
        change24h: null,
        fetchedAt: 0,
        stale: true,
        error: message,
      };
      return quotes;
    }, {});
    return NextResponse.json(result, { status: 502 });
  }
}
