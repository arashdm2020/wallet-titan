import { getDb, id, seedDatabase, transaction } from "@/server/db";
import { parseAmountToAtoms } from "@/server/money";

export function createTransfer(input: {
  senderWalletId: string;
  recipientUsername: string;
  assetId: string;
  amount: string;
  settlementMode?: "immediate" | "scheduled";
  durationMinutes?: number;
}) {
  seedDatabase();
  return transaction(() => {
    const asset = getDb().prepare("SELECT id, symbol FROM asset_definitions WHERE id = ?").get(input.assetId) as { id: string; symbol: string } | undefined;
    if (!asset) throw new Error("Asset not found");
    const amountAtoms = parseAmountToAtoms(input.amount, asset.symbol);
    if (amountAtoms <= 0n) throw new Error("Amount must be greater than zero");

    const recipient = getDb()
      .prepare(
        `SELECT wallets.id AS wallet_id
         FROM users JOIN wallets ON wallets.user_id = users.id
         WHERE lower(users.username) = lower(?) AND users.enabled = 1`,
      )
      .get(input.recipientUsername.trim()) as { wallet_id: string } | undefined;
    if (!recipient) throw new Error("Recipient not found");
    if (recipient.wallet_id === input.senderWalletId) throw new Error("Sender and recipient must differ");

    const settings = getDb().prepare("SELECT * FROM settlement_settings WHERE id = 1").get() as {
      immediate_enabled: number;
      scheduled_enabled: number;
      default_settlement_mode: "immediate" | "scheduled";
      default_duration_minutes: number;
      max_duration_minutes: number;
      processing_reason: string;
    };
    const mode = input.settlementMode || settings.default_settlement_mode;
    if (mode === "immediate" && !settings.immediate_enabled) throw new Error("Immediate transfers are disabled");
    if (mode === "scheduled" && !settings.scheduled_enabled) throw new Error("Scheduled transfers are disabled");
    const durationMinutes = mode === "scheduled" ? Math.min(input.durationMinutes || settings.default_duration_minutes, settings.max_duration_minutes) : 0;
    if (durationMinutes < 0) throw new Error("Invalid duration");

    const balance = getDb()
      .prepare("SELECT amount_atoms FROM wallet_balances WHERE wallet_id = ? AND asset_id = ?")
      .get(input.senderWalletId, input.assetId) as { amount_atoms: string } | undefined;
    if (!balance || BigInt(balance.amount_atoms) < amountAtoms) throw new Error("Insufficient spendable balance");

    const now = new Date();
    const createdAt = now.toISOString();
    const transferId = id("transfer");
    const availableAt = mode === "scheduled" ? new Date(now.getTime() + durationMinutes * 60_000).toISOString() : null;
    const status = mode === "scheduled" ? "processing" : "completed";
    const reference = `SIM-${asset.symbol}-${transferId.slice(-8).toUpperCase()}`;

    getDb()
      .prepare("UPDATE wallet_balances SET amount_atoms = CAST(CAST(amount_atoms AS INTEGER) - CAST(? AS INTEGER) AS TEXT) WHERE wallet_id = ? AND asset_id = ? AND CAST(amount_atoms AS INTEGER) >= CAST(? AS INTEGER)")
      .run(amountAtoms.toString(), input.senderWalletId, input.assetId, amountAtoms.toString());
    const changed = getDb().prepare("SELECT changes() AS changed").get() as { changed: number };
    if (changed.changed !== 1) throw new Error("Insufficient spendable balance");

    getDb()
      .prepare(
        `INSERT INTO transfers
         (id, sender_wallet_id, recipient_wallet_id, asset_id, amount_atoms, settlement_mode, status, simulation,
          transfer_reference, created_at, processing_started_at, available_at, completed_at, duration_minutes, processing_reason, network_block_at_creation)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        durationMinutes,
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
    }

    return { id: transferId, transferReference: reference, status, settlementMode: mode };
  });
}
