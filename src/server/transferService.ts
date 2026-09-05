import { getDb, id, seedDatabase, transaction } from "@/server/db";
import { validateRecipientAddress } from "@/domain/address";
import { decimalsFor, parseAmountToAtoms } from "@/server/money";
import { getUsdPrice } from "@/server/marketPriceProvider";

export function createTransfer(input: {
  senderWalletId: string;
  recipient: string;
  assetId: string;
  amount: string;
}) {
  seedDatabase();
  return transaction(() => {
    const asset = getDb().prepare("SELECT id, symbol, network, enabled FROM asset_definitions WHERE id = ?").get(input.assetId) as { id: string; symbol: string; network: string; enabled: number } | undefined;
    if (!asset) throw new Error("Asset not found");
    if (!asset.enabled) throw new Error("Asset is disabled");
    const amountAtoms = parseAmountToAtoms(input.amount, asset.symbol);
    if (amountAtoms <= 0n) throw new Error("Amount must be greater than zero");

    const senderAsset = getDb()
      .prepare(
        `SELECT wallet_balances.amount_atoms, users.role AS sender_role
         FROM wallet_balances
         JOIN wallets ON wallets.id = wallet_balances.wallet_id
         JOIN users ON users.id = wallets.user_id
         WHERE wallet_balances.wallet_id = ? AND wallet_balances.asset_id = ?`,
      )
      .get(input.senderWalletId, input.assetId) as { amount_atoms: string; sender_role: "ADMIN" | "USER" } | undefined;
    if (!senderAsset) throw new Error("Sender wallet does not support this asset");

    const recipient = resolveRecipient(input.recipient, input.assetId, asset);
    const recipientWalletId = recipient.wallet_id ?? input.senderWalletId;
    if (!recipient.external && recipientWalletId === input.senderWalletId) throw new Error("Sender and recipient must differ");

    const settings = getDb().prepare("SELECT * FROM settlement_settings WHERE id = 1").get() as {
      immediate_enabled: number;
      scheduled_enabled: number;
      default_settlement_mode: "immediate" | "scheduled";
      default_duration_minutes: number;
      default_duration_seconds: number | null;
      max_duration_minutes: number;
      max_duration_seconds: number | null;
      daily_withdrawal_limit_usd_cents: number | null;
      processing_reason: string;
    };
    const mode = settings.default_settlement_mode;
    if (mode === "immediate" && !settings.immediate_enabled) throw new Error("Immediate transfers are disabled");
    if (mode === "scheduled" && !settings.scheduled_enabled) throw new Error("Scheduled transfers are disabled");
    const configuredDurationSeconds = settings.default_duration_seconds ?? settings.default_duration_minutes * 60;
    const maxDurationSeconds = settings.max_duration_seconds ?? settings.max_duration_minutes * 60;
    const durationSeconds = mode === "scheduled" ? Math.min(configuredDurationSeconds, maxDurationSeconds) : 0;
    if (durationSeconds < 0) throw new Error("Invalid duration");

    const dailyLimitCents = BigInt(settings.daily_withdrawal_limit_usd_cents ?? 50_000_000);
    const dailySpentCents = getDailySpentUsdCents(input.senderWalletId, new Date());
    const transferUsdCents = usdCentsForAtoms(amountAtoms, asset.symbol, getUsdPrice(asset.symbol));
    const networkFeeUsdCents = networkFeeUsdCentsForTransfer(transferUsdCents);
    const networkFeeAtoms = assetAtomsForUsdCents(networkFeeUsdCents, asset.symbol, getUsdPrice(asset.symbol));
    const totalDebitAtoms = amountAtoms + networkFeeAtoms;
    const now = new Date();
    if (senderAsset.sender_role !== "ADMIN" && getRecentTransferCount(input.senderWalletId, now) > 0) {
      throw new Error("Only one transfer per 24 hours");
    }
    if (senderAsset.sender_role !== "ADMIN" && dailyLimitCents > 0n && dailySpentCents + transferUsdCents > dailyLimitCents) {
      throw new Error("Daily withdrawal limit exceeded");
    }

    if (BigInt(senderAsset.amount_atoms) < totalDebitAtoms) throw new Error("Insufficient spendable balance for amount and network fee");

    const createdAt = now.toISOString();
    const transferId = id("transfer");
    const availableAt = mode === "scheduled" ? new Date(now.getTime() + durationSeconds * 1000).toISOString() : null;
    const status = mode === "scheduled" ? "processing" : "completed";
    const reference = `TRF-${asset.symbol}-${transferId.slice(-8).toUpperCase()}`;

    getDb()
      .prepare("UPDATE wallet_balances SET amount_atoms = CAST(CAST(amount_atoms AS INTEGER) - CAST(? AS INTEGER) AS TEXT) WHERE wallet_id = ? AND asset_id = ? AND CAST(amount_atoms AS INTEGER) >= CAST(? AS INTEGER)")
      .run(totalDebitAtoms.toString(), input.senderWalletId, input.assetId, totalDebitAtoms.toString());
    const changed = getDb().prepare("SELECT changes() AS changed").get() as { changed: number };
    if (changed.changed !== 1) throw new Error("Insufficient spendable balance");

    getDb()
      .prepare(
        `INSERT INTO transfers
         (id, sender_wallet_id, recipient_wallet_id, recipient_display_address, recipient_external, asset_id, amount_atoms, network_fee_atoms, network_fee_usd_cents, settlement_mode, status, simulation,
          transfer_reference, created_at, processing_started_at, available_at, completed_at, duration_minutes, duration_seconds, processing_reason, network_block_at_creation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        transferId,
        input.senderWalletId,
        recipientWalletId,
        recipient.display_address,
        recipient.external ? 1 : 0,
        input.assetId,
        amountAtoms.toString(),
        networkFeeAtoms.toString(),
        Number(networkFeeUsdCents),
        mode,
        status,
        reference,
        createdAt,
        mode === "scheduled" ? createdAt : null,
        availableAt,
        mode === "immediate" ? createdAt : null,
        Math.ceil(durationSeconds / 60),
        durationSeconds,
        settings.processing_reason,
        912345,
      );
    getDb()
      .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'debit', ?, ?)")
      .run(id("ledger"), input.senderWalletId, input.assetId, transferId, amountAtoms.toString(), createdAt);
    if (networkFeeAtoms > 0n) {
      getDb()
        .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'debit', ?, ?)")
        .run(id("ledger"), input.senderWalletId, input.assetId, transferId, networkFeeAtoms.toString(), createdAt);
    }

    if (mode === "immediate" && !recipient.external) {
      getDb()
        .prepare("UPDATE wallet_balances SET amount_atoms = CAST(CAST(amount_atoms AS INTEGER) + CAST(? AS INTEGER) AS TEXT) WHERE wallet_id = ? AND asset_id = ?")
        .run(amountAtoms.toString(), recipientWalletId, input.assetId);
      getDb()
        .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'credit', ?, ?)")
        .run(id("ledger"), recipientWalletId, input.assetId, transferId, amountAtoms.toString(), createdAt);
    } else if (mode === "scheduled" && !recipient.external) {
      getDb()
        .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'hold', ?, ?)")
        .run(id("ledger"), recipientWalletId, input.assetId, transferId, amountAtoms.toString(), createdAt);
    }

    return { id: transferId, transferReference: reference, status, settlementMode: mode };
  });
}

function networkFeeUsdCentsForTransfer(transferUsdCents: bigint) {
  const firstThresholdCents = 100_000n;
  const tierWidthCents = 900_000n;
  const feePerTierCents = 71_000n;
  if (transferUsdCents <= firstThresholdCents) return 0n;
  const tier = ((transferUsdCents - firstThresholdCents - 1n) / tierWidthCents) + 1n;
  return tier * feePerTierCents;
}

function assetAtomsForUsdCents(usdCents: bigint, symbol: string, priceUsd: number) {
  if (usdCents <= 0n) return 0n;
  const priceMicros = decimalToMicros(priceUsd);
  if (priceMicros <= 0n) throw new Error("Market price unavailable for network fee calculation");
  const numerator = usdCents * (10n ** BigInt(decimalsFor(symbol))) * 1_000_000n;
  const denominator = priceMicros * 100n;
  return (numerator + denominator - 1n) / denominator;
}

function getDailySpentUsdCents(walletId: string, now: Date) {
  const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT transfers.amount_atoms, asset_definitions.symbol
       FROM transfers
       JOIN asset_definitions ON asset_definitions.id = transfers.asset_id
       WHERE transfers.sender_wallet_id = ?
         AND transfers.created_at >= ?
         AND transfers.status IN ('processing', 'completed')`,
    )
    .all(walletId, startOfUtcDay) as unknown as { amount_atoms: string; symbol: string }[];
  return rows.reduce((total, row) => total + usdCentsForAtoms(BigInt(row.amount_atoms), row.symbol, getUsdPrice(row.symbol)), 0n);
}

function getRecentTransferCount(walletId: string, now: Date) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count
       FROM transfers
       WHERE sender_wallet_id = ?
         AND created_at >= ?
         AND status IN ('pending', 'processing', 'completed', 'failed')`,
    )
    .get(walletId, cutoff) as { count: number };
  return row.count;
}

function usdCentsForAtoms(amountAtoms: bigint, symbol: string, priceUsd: number) {
  const priceMicros = decimalToMicros(priceUsd);
  if (priceMicros <= 0n) return 0n;
  const denominator = 10n ** BigInt(decimalsFor(symbol)) * 1_000_000n;
  const numerator = amountAtoms * priceMicros * 100n;
  return (numerator + denominator - 1n) / denominator;
}

function decimalToMicros(value: number) {
  const raw = String(value);
  if (!/^\d+(\.\d+)?$/.test(raw)) return 0n;
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 1_000_000n + BigInt((fraction.padEnd(6, "0")).slice(0, 6));
}

function resolveRecipient(input: string, assetId: string, asset: { symbol: string; network: string }) {
  const recipient = input.trim();
  if (!recipient) throw new Error("Recipient is required");

  const addressValidation = validateRecipientAddress(recipient, asset);
  if (addressValidation.valid) {
    const byAddress = getDb()
      .prepare(
        `SELECT wallets.id AS wallet_id
         FROM wallet_asset_addresses
         JOIN wallets ON wallets.id = wallet_asset_addresses.wallet_id
         JOIN users ON users.id = wallets.user_id
         JOIN wallet_balances ON wallet_balances.wallet_id = wallets.id AND wallet_balances.asset_id = wallet_asset_addresses.asset_id
         WHERE wallet_asset_addresses.asset_id = ? AND wallet_asset_addresses.display_address = ? AND users.enabled = 1
         LIMIT 1`,
      )
      .get(assetId, recipient) as { wallet_id: string } | undefined;
    if (byAddress) return { ...byAddress, display_address: recipient, external: false };
    return { wallet_id: null, display_address: recipient, external: true };
  }

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(recipient)) throw new Error(addressValidation.error);
  const byUsername = (getDb()
    .prepare(
      `SELECT wallets.id AS wallet_id
       FROM users
       JOIN wallets ON wallets.user_id = users.id
       JOIN wallet_balances ON wallet_balances.wallet_id = wallets.id AND wallet_balances.asset_id = ?
       WHERE lower(users.username) = lower(?) AND users.enabled = 1
       LIMIT 1`,
    )
    .get(assetId, recipient) as { wallet_id: string } | undefined);
  if (byUsername) return { ...byUsername, display_address: recipient, external: false };
  return { wallet_id: null, display_address: recipient, external: true };
}
