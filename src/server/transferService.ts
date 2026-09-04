import { getDb, id, seedDatabase, transaction } from "@/server/db";
import { validateRecipientAddress } from "@/domain/address";
import { parseAmountToAtoms } from "@/server/money";

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
      .prepare("SELECT amount_atoms FROM wallet_balances WHERE wallet_id = ? AND asset_id = ?")
      .get(input.senderWalletId, input.assetId) as { amount_atoms: string } | undefined;
    if (!senderAsset) throw new Error("Sender wallet does not support this asset");

    const recipient = resolveRecipient(input.recipient, input.assetId, asset);
    if (!recipient) throw new Error("Recipient not found");
    if (recipient.wallet_id === input.senderWalletId) throw new Error("Sender and recipient must differ");

    const settings = getDb().prepare("SELECT * FROM settlement_settings WHERE id = 1").get() as {
      immediate_enabled: number;
      scheduled_enabled: number;
      default_settlement_mode: "immediate" | "scheduled";
      default_duration_minutes: number;
      default_duration_seconds: number | null;
      max_duration_minutes: number;
      max_duration_seconds: number | null;
      processing_reason: string;
    };
    const mode = settings.default_settlement_mode;
    if (mode === "immediate" && !settings.immediate_enabled) throw new Error("Immediate transfers are disabled");
    if (mode === "scheduled" && !settings.scheduled_enabled) throw new Error("Scheduled transfers are disabled");
    const configuredDurationSeconds = settings.default_duration_seconds ?? settings.default_duration_minutes * 60;
    const maxDurationSeconds = settings.max_duration_seconds ?? settings.max_duration_minutes * 60;
    const durationSeconds = mode === "scheduled" ? Math.min(configuredDurationSeconds, maxDurationSeconds) : 0;
    if (durationSeconds < 0) throw new Error("Invalid duration");

    if (BigInt(senderAsset.amount_atoms) < amountAtoms) throw new Error("Insufficient spendable balance");

    const now = new Date();
    const createdAt = now.toISOString();
    const transferId = id("transfer");
    const availableAt = mode === "scheduled" ? new Date(now.getTime() + durationSeconds * 1000).toISOString() : null;
    const status = mode === "scheduled" ? "processing" : "completed";
    const reference = `TRF-${asset.symbol}-${transferId.slice(-8).toUpperCase()}`;

    getDb()
      .prepare("UPDATE wallet_balances SET amount_atoms = CAST(CAST(amount_atoms AS INTEGER) - CAST(? AS INTEGER) AS TEXT) WHERE wallet_id = ? AND asset_id = ? AND CAST(amount_atoms AS INTEGER) >= CAST(? AS INTEGER)")
      .run(amountAtoms.toString(), input.senderWalletId, input.assetId, amountAtoms.toString());
    const changed = getDb().prepare("SELECT changes() AS changed").get() as { changed: number };
    if (changed.changed !== 1) throw new Error("Insufficient spendable balance");

    getDb()
      .prepare(
        `INSERT INTO transfers
         (id, sender_wallet_id, recipient_wallet_id, asset_id, amount_atoms, settlement_mode, status, simulation,
          transfer_reference, created_at, processing_started_at, available_at, completed_at, duration_minutes, duration_seconds, processing_reason, network_block_at_creation)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        transferId,
        input.senderWalletId,
        recipient.wallet_id,
        input.assetId,
        amountAtoms.toString(),
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

    if (mode === "immediate") {
      getDb()
        .prepare("UPDATE wallet_balances SET amount_atoms = CAST(CAST(amount_atoms AS INTEGER) + CAST(? AS INTEGER) AS TEXT) WHERE wallet_id = ? AND asset_id = ?")
        .run(amountAtoms.toString(), recipient.wallet_id, input.assetId);
      getDb()
        .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'credit', ?, ?)")
        .run(id("ledger"), recipient.wallet_id, input.assetId, transferId, amountAtoms.toString(), createdAt);
    } else {
      getDb()
        .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'hold', ?, ?)")
        .run(id("ledger"), recipient.wallet_id, input.assetId, transferId, amountAtoms.toString(), createdAt);
    }

    return { id: transferId, transferReference: reference, status, settlementMode: mode };
  });
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
    return byAddress || null;
  }

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(recipient)) throw new Error(addressValidation.error);
  return (getDb()
    .prepare(
      `SELECT wallets.id AS wallet_id
       FROM users
       JOIN wallets ON wallets.user_id = users.id
       JOIN wallet_balances ON wallet_balances.wallet_id = wallets.id AND wallet_balances.asset_id = ?
       WHERE lower(users.username) = lower(?) AND users.enabled = 1
       LIMIT 1`,
    )
    .get(assetId, recipient) as { wallet_id: string } | undefined) || null;
}
