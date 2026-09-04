# Wallet Simulator Architecture

This project is a web/PWA simulator. It does not depend on Android Studio, Android SDK, Gradle, Java/Kotlin, React Native native modules, Xcode, or CocoaPods.

## Runtime Architecture

```text
Next.js Web App
  -> Wallet UI
  -> React Context wallet store
  -> API routes
  -> Wallet services
  -> SQLite

Portfolio UI
  -> PortfolioService
  -> MarketPriceProvider
  -> CoinGeckoProvider
```

## Accounting

SQLite stores users, server sessions, wallets, asset definitions, wallet balances, transfers, settlement settings, and ledger entries.

Self-created wallets start with:

```text
BTC  = 0
ETH  = 0
TRX  = 0
USDT = 0
```

The primary ADMIN wallet is seeded with configurable simulator balances. Those balances are controlled through `/admin` and are not copied into newly created user wallets.

## Scheduled Transfers

Scheduled transfers debit the sender immediately inside the same SQLite transaction that creates the transfer. The recipient sees an incoming transfer immediately, but the processing amount is locked and is not spendable.

Progress is timestamp-derived:

```text
progress = clamp(now - processingStartedAt, 0, duration) / duration
```

The final settlement is idempotent. Repeated refreshes, restarts, or settlement calls cannot credit the recipient twice.

## Market Prices

Crypto prices are read-only market data requested through `src/app/api/market-prices/route.ts`, which calls CoinGecko. The client-side provider caches quotes and last-known-good values for display resilience. Portfolio USD values are calculated from:

```text
asset balance * live USD price
```

## PWA

The app includes:

- `public/manifest.webmanifest`
- `public/sw.js`
- PNG app icons at 192x192 and 512x512
- maskable icons
- Apple touch icon
- Settings install flow for Android/Desktop
- concise iOS Add to Home Screen instructions

Full mobile installability is best verified on HTTPS. Localhost is acceptable for service-worker testing; plain LAN HTTP can be limited by mobile browser security rules.
