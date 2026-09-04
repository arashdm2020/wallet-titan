# Wallet Simulator

Mobile-first cryptocurrency wallet simulator built with Next.js, TypeScript, Tailwind CSS, SQLite, and PWA support.

This is not a real cryptocurrency wallet. It does not request seed phrases, mnemonics, private keys, imported wallets, signatures, or blockchain transaction broadcasts.

## Run Locally

Use the portable Node runtime:

```powershell
$env:Path="D:\Dev\node-v22.23.2-win-x64;$env:Path"
Set-Location -LiteralPath 'D:\wallet-mian\web-wallet'
npm install
npm run dev -- --hostname 0.0.0.0
```

Open:

- Desktop: `http://localhost:3000`
- Android phone on the same network: `http://192.168.1.3:3000`

## Accounts

Initial administrator username:

- Username: `admin`

For production, set `WALLET_ADMIN_PASSWORD` before the first startup so the initial administrator is not created with a development-only password. In local development and tests, the fallback password is `admin123`.

Self-created wallets start with zero balances for BTC, ETH, TRX, and USDT.

## Admin

Open `/admin` after signing in as an administrator. The admin panel can create users, enable or disable users, reset passwords, edit simulator balances, edit assets, configure settlement settings, and create simulated transfers.

## Persistence

SQLite is the source of truth for users, sessions, balances, transfers, and settlement state. Local production database path:

```text
/opt/wallet/data/wallet.db
```

Do not place the database in `public/`.

## PWA

The app includes a web app manifest, service worker, 192x192 and 512x512 icons, maskable icons, Apple touch icon, standalone display mode, and install UI in Settings.

## Checks

```powershell
npx tsc --noEmit --incremental false
npm run lint
npm test
npm run build
npx tsx tests/e2e-smoke.ts
npx tsx tests/pwa-check.ts
```
