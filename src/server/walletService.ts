import { hashPassword, verifyPassword } from "@/server/auth";
import { generateWalletAddress } from "@/domain/address";
import { getDb, id, seedDatabase, transaction, type Role } from "@/server/db";
import { atomsToDecimalString, atomsToNumber, parseAmountToAtoms, settledAtoms } from "@/server/money";
import type { AuthSession } from "@/server/session";
import type { SQLInputValue } from "node:sqlite";

export interface DbUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  walletId: string;
  walletType: "ADMIN" | "USER";
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: Role;
  enabled: number;
  wallet_id: string;
  wallet_type: "ADMIN" | "USER";
}

interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  network: string;
  display_address: string;
  enabled: number;
  withdrawal_enabled: number;
  withdrawal_available_at: string | null;
  icon_path: string | null;
  amount_atoms: string | null;
}

interface TransferRow {
  id: string;
  sender_wallet_id: string;
  recipient_wallet_id: string;
  recipient_external: number;
  asset_id: string;
  amount_atoms: string;
  settlement_mode: "immediate" | "scheduled";
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  simulation: number;
  transfer_reference: string;
  created_at: string;
  processing_started_at: string | null;
  available_at: string | null;
  completed_at: string | null;
  duration_minutes: number;
  duration_seconds: number | null;
  processing_reason: string;
  network_block_at_creation: number;
  symbol: string;
  name: string;
  network: string;
  sender_username: string;
  recipient_username: string;
  sender_display_address: string;
  recipient_display_address: string | null;
}

export function authenticate(username: string, password: string) {
  seedDatabase();
  const row = getDb()
    .prepare(
      `SELECT users.*, wallets.id AS wallet_id, wallets.wallet_type
       FROM users JOIN wallets ON wallets.user_id = users.id
       WHERE lower(username) = lower(?) LIMIT 1`,
    )
    .get(username.trim()) as UserRow | undefined;
  if (!row || !row.enabled || !verifyPassword(password, row.password_hash)) return null;
  return mapUser(row);
}

export function createUserWallet(input: { username: string; password: string; displayName?: string; role?: Role }) {
  seedDatabase();
  const username = input.username.trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) throw new Error("Username must be 3-32 letters, numbers, dots, underscores, or dashes");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");

  return transaction(() => {
    const userId = id("user");
    const walletId = id("wallet");
    const now = new Date().toISOString();
    const role = input.role || "USER";
    getDb()
      .prepare("INSERT INTO users (id, username, display_name, password_hash, role, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
      .run(userId, username, input.displayName?.trim() || username, hashPassword(input.password), role, now);
    getDb().prepare("INSERT INTO wallets (id, user_id, wallet_type, created_at) VALUES (?, ?, ?, ?)").run(walletId, userId, role, now);

    const assets = getDb().prepare("SELECT id FROM asset_definitions").all() as { id: string }[];
    const insertBalance = getDb().prepare("INSERT INTO wallet_balances (wallet_id, asset_id, amount_atoms) VALUES (?, ?, '0')");
    const insertAddress = getDb().prepare("INSERT INTO wallet_asset_addresses (wallet_id, asset_id, display_address, created_at) VALUES (?, ?, ?, ?)");
    const assetDefinitions = getDb().prepare("SELECT id, symbol, network FROM asset_definitions").all() as unknown as { id: string; symbol: string; network: string }[];
    for (const asset of assets) insertBalance.run(walletId, asset.id);
    for (const asset of assetDefinitions) insertAddress.run(walletId, asset.id, generateWalletAddress(asset.symbol, asset.network, walletId, username), now);

    return { id: userId, username, displayName: input.displayName?.trim() || username, role, enabled: true, walletId, walletType: role };
  });
}

export function finalizeDueTransfers(now = new Date()) {
  seedDatabase();
  return transaction(() => {
    const due = getDb()
      .prepare("SELECT id, recipient_wallet_id, recipient_external, asset_id, amount_atoms FROM transfers WHERE settlement_mode = 'scheduled' AND status = 'processing' AND available_at <= ?")
      .all(now.toISOString()) as Pick<TransferRow, "id" | "recipient_wallet_id" | "recipient_external" | "asset_id" | "amount_atoms">[];
    for (const transferRow of due) {
      getDb()
        .prepare("UPDATE transfers SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'processing'")
        .run(now.toISOString(), transferRow.id);
      const changed = getDb().prepare("SELECT changes() AS changed").get() as { changed: number };
      if (changed.changed !== 1) continue;
      if (transferRow.recipient_external) continue;
      getDb()
        .prepare("UPDATE wallet_balances SET amount_atoms = CAST(CAST(amount_atoms AS INTEGER) + CAST(? AS INTEGER) AS TEXT) WHERE wallet_id = ? AND asset_id = ?")
        .run(transferRow.amount_atoms, transferRow.recipient_wallet_id, transferRow.asset_id);
      getDb()
        .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'credit', ?, ?)")
        .run(id("ledger"), transferRow.recipient_wallet_id, transferRow.asset_id, transferRow.id, transferRow.amount_atoms, now.toISOString());
      getDb()
        .prepare("INSERT INTO ledger_entries (id, wallet_id, asset_id, transfer_id, type, amount_atoms, created_at) VALUES (?, ?, ?, ?, 'release', ?, ?)")
        .run(id("ledger"), transferRow.recipient_wallet_id, transferRow.asset_id, transferRow.id, transferRow.amount_atoms, now.toISOString());
    }
    return due.length;
  });
}

export function getWalletSnapshot(session: AuthSession, now = new Date()) {
  finalizeDueTransfers(now);
  const assets = getDb()
    .prepare(
      `SELECT asset_definitions.id, asset_definitions.symbol, asset_definitions.name, asset_definitions.network,
              COALESCE(wallet_asset_addresses.display_address, asset_definitions.display_address) AS display_address,
              asset_definitions.enabled, asset_definitions.withdrawal_enabled, asset_definitions.withdrawal_available_at,
              asset_definitions.icon_path, wallet_balances.amount_atoms
       FROM asset_definitions
       JOIN wallet_balances ON wallet_balances.asset_id = asset_definitions.id AND wallet_balances.wallet_id = ?
       LEFT JOIN wallet_asset_addresses ON wallet_asset_addresses.asset_id = asset_definitions.id AND wallet_asset_addresses.wallet_id = wallet_balances.wallet_id
       ORDER BY CASE symbol WHEN 'TRX' THEN 1 WHEN 'BTC' THEN 2 WHEN 'ETH' THEN 3 WHEN 'USDT' THEN 4 ELSE 5 END`,
    )
    .all(session.walletId) as unknown as AssetRow[];
  const transfers = getTransfersForWallet(session.walletId, now);

  return {
    user: { id: session.userId, username: session.username, displayName: session.displayName, role: session.role },
    wallet: { id: session.walletId, baseCurrency: "USD" as const, walletType: session.walletType },
    assets: assets.map((asset) => {
      const incoming = transfers
        .filter((transferItem) => !transferItem.recipientExternal && transferItem.recipientWalletId === session.walletId && transferItem.assetId === asset.id && transferItem.status === "processing")
        .reduce(
          (total, transferItem) => ({
            totalAtoms: total.totalAtoms + BigInt(transferItem.amountAtoms),
            processingAtoms: total.processingAtoms + BigInt(transferItem.processingAtoms),
          }),
          { totalAtoms: 0n, processingAtoms: 0n },
        );
      const pendingOutgoingAtoms = transfers
        .filter((transferItem) => transferItem.senderWalletId === session.walletId && transferItem.assetId === asset.id && transferItem.status === "processing")
        .reduce((total, transferItem) => total + BigInt(transferItem.amountAtoms), 0n);
      const availableAtoms = asset.amount_atoms || "0";
      const processingIncomingAtoms = incoming.processingAtoms;
      const pendingIncomingAtoms = incoming.totalAtoms;
      const incomingRemainingAtoms = incoming.totalAtoms - incoming.processingAtoms;
      return {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        network: asset.network,
        displayAddress: asset.display_address,
        enabled: Boolean(asset.enabled),
        withdrawalEnabled: Boolean(asset.withdrawal_enabled),
        withdrawalAvailableAt: asset.withdrawal_available_at || undefined,
        iconPath: asset.icon_path || undefined,
        balance: atomsToNumber(availableAtoms, asset.symbol),
        balanceAtoms: availableAtoms,
        balanceDisplay: atomsToDecimalString(availableAtoms, asset.symbol),
        availableBalance: atomsToNumber(availableAtoms, asset.symbol),
        availableBalanceAtoms: availableAtoms,
        pendingOutgoing: atomsToNumber(pendingOutgoingAtoms, asset.symbol),
        pendingOutgoingAtoms: pendingOutgoingAtoms.toString(),
        incomingAmount: atomsToNumber(pendingIncomingAtoms, asset.symbol),
        processingAmount: atomsToNumber(processingIncomingAtoms, asset.symbol),
        processingIncoming: atomsToNumber(processingIncomingAtoms, asset.symbol),
        processingIncomingAtoms: processingIncomingAtoms.toString(),
        pendingIncomingTotal: atomsToNumber(pendingIncomingAtoms, asset.symbol),
        pendingIncomingAtoms: pendingIncomingAtoms.toString(),
        remainingIncomingAmount: atomsToNumber(incomingRemainingAtoms, asset.symbol),
        incomingRemaining: atomsToNumber(incomingRemainingAtoms, asset.symbol),
        incomingRemainingAtoms: incomingRemainingAtoms.toString(),
      };
    }),
    transfers,
    activities: transfers.map((transferItem) => transferToActivity(transferItem, session.walletId)),
  };
}

export function getTransfersForWallet(walletId: string, now = new Date()) {
  const rows = getTransferRows("WHERE transfers.sender_wallet_id = ? OR transfers.recipient_wallet_id = ?", [walletId, walletId]);
  return rows.map((row) => mapTransfer(row, now));
}

export function getTransferByIdScoped(transferId: string, session: AuthSession, now = new Date()) {
  finalizeDueTransfers(now);
  const rows = getTransferRows("WHERE transfers.id = ?", [transferId]);
  const row = rows[0];
  if (!row) return null;
  if (session.role !== "ADMIN" && row.sender_wallet_id !== session.walletId && row.recipient_wallet_id !== session.walletId) return null;
  return mapTransfer(row, now);
}

export function getAdminSnapshot(now = new Date()) {
  finalizeDueTransfers(now);
  const users = getDb()
    .prepare(
      `SELECT users.*, wallets.id AS wallet_id, wallets.wallet_type
       FROM users JOIN wallets ON wallets.user_id = users.id
       ORDER BY users.role, users.username`,
    )
    .all() as unknown as UserRow[];
  const balances = getDb()
    .prepare(
      `SELECT wallet_balances.wallet_id, asset_definitions.id AS asset_id, asset_definitions.symbol, wallet_balances.amount_atoms
       FROM wallet_balances JOIN asset_definitions ON asset_definitions.id = wallet_balances.asset_id`,
    )
    .all() as unknown as { wallet_id: string; asset_id: string; symbol: string; amount_atoms: string }[];
  const assets = getDb().prepare("SELECT * FROM asset_definitions ORDER BY symbol").all() as unknown as AssetRow[];
  const settings = getDb().prepare("SELECT * FROM settlement_settings WHERE id = 1").get();
  const transfers = getTransferRows("", []).map((row) => mapTransfer(row, now));
  return {
    users: users.map(mapUser),
    balances: balances.map((balance) => ({ walletId: balance.wallet_id, assetId: balance.asset_id, symbol: balance.symbol, amount: atomsToNumber(balance.amount_atoms, balance.symbol), amountDisplay: atomsToDecimalString(balance.amount_atoms, balance.symbol) })),
    assets: assets.map((asset) => ({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      network: asset.network,
      displayAddress: asset.display_address,
      enabled: Boolean(asset.enabled),
      withdrawalEnabled: Boolean(asset.withdrawal_enabled),
      withdrawalAvailableAt: asset.withdrawal_available_at || undefined,
      iconPath: asset.icon_path || undefined,
    })),
    settings,
    transfers,
  };
}

export function setWalletBalance(walletId: string, assetId: string, amount: string) {
  const asset = getDb().prepare("SELECT symbol FROM asset_definitions WHERE id = ?").get(assetId) as { symbol: string } | undefined;
  if (!asset) throw new Error("Asset not found");
  const atoms = parseAmountToAtoms(amount, asset.symbol);
  getDb().prepare("UPDATE wallet_balances SET amount_atoms = ? WHERE wallet_id = ? AND asset_id = ?").run(atoms.toString(), walletId, assetId);
}

export function updateSettlementSettings(input: { defaultMode: string; defaultDurationMinutes?: number; defaultDurationSeconds?: number; maxDurationMinutes?: number; maxDurationSeconds?: number; dailyWithdrawalLimitUsdCents?: number; processingReason: string; immediateEnabled: boolean; scheduledEnabled: boolean }) {
  if (!["immediate", "scheduled"].includes(input.defaultMode)) throw new Error("Invalid settlement mode");
  const defaultDurationSeconds = Math.trunc(input.defaultDurationSeconds ?? (input.defaultDurationMinutes ?? 480) * 60);
  const maxDurationSeconds = Math.trunc(input.maxDurationSeconds ?? (input.maxDurationMinutes ?? 720) * 60);
  if (defaultDurationSeconds < 60 || maxDurationSeconds < defaultDurationSeconds) throw new Error("Invalid duration settings");
  const currentSettings = getDb().prepare("SELECT daily_withdrawal_limit_usd_cents FROM settlement_settings WHERE id = 1").get() as { daily_withdrawal_limit_usd_cents: number | null } | undefined;
  const dailyWithdrawalLimitUsdCents = Math.trunc(input.dailyWithdrawalLimitUsdCents ?? currentSettings?.daily_withdrawal_limit_usd_cents ?? 50_000_000);
  if (dailyWithdrawalLimitUsdCents <= 0) throw new Error("Daily withdrawal limit must be greater than zero");
  const defaultDurationMinutes = Math.ceil(defaultDurationSeconds / 60);
  const maxDurationMinutes = Math.ceil(maxDurationSeconds / 60);
  getDb()
    .prepare(
      `UPDATE settlement_settings
       SET immediate_enabled = ?, scheduled_enabled = ?, default_settlement_mode = ?, default_duration_minutes = ?, default_duration_seconds = ?, max_duration_minutes = ?, max_duration_seconds = ?, daily_withdrawal_limit_usd_cents = ?, processing_reason = ?
       WHERE id = 1`,
    )
    .run(input.immediateEnabled ? 1 : 0, input.scheduledEnabled ? 1 : 0, input.defaultMode, defaultDurationMinutes, defaultDurationSeconds, maxDurationMinutes, maxDurationSeconds, dailyWithdrawalLimitUsdCents, input.processingReason);
}

export function setUserEnabled(userId: string, enabled: boolean) {
  const row = getDb().prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: Role } | undefined;
  if (!row) throw new Error("User not found");
  if (row.role === "ADMIN" && !enabled) throw new Error("Primary admin cannot be disabled");
  getDb().prepare("UPDATE users SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, userId);
}

export function resetUserPassword(userId: string, password: string) {
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), userId);
}

export function updateUserDisplayName(userId: string, displayName: string) {
  seedDatabase();
  const trimmed = displayName.trim();
  if (trimmed.length < 2 || trimmed.length > 48) throw new Error("Display name must be 2-48 characters");
  getDb().prepare("UPDATE users SET display_name = ? WHERE id = ?").run(trimmed, userId);
}

export function saveAssetDefinition(input: {
  id?: string;
  symbol: string;
  name: string;
  network: string;
  displayAddress: string;
  enabled: boolean;
  withdrawalEnabled: boolean;
  withdrawalAvailableAt?: string;
}) {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required");
  const assetId = input.id || id("asset");
  transaction(() => {
    const existing = getDb().prepare("SELECT id FROM asset_definitions WHERE id = ?").get(assetId);
    if (existing) {
      getDb()
        .prepare(
          `UPDATE asset_definitions
           SET symbol = ?, name = ?, network = ?, display_address = ?, enabled = ?, withdrawal_enabled = ?, withdrawal_available_at = ?
           WHERE id = ?`,
        )
        .run(symbol, input.name.trim(), input.network.trim(), input.displayAddress.trim(), input.enabled ? 1 : 0, input.withdrawalEnabled ? 1 : 0, input.withdrawalAvailableAt || null, assetId);
    } else {
      getDb()
        .prepare(
          `INSERT INTO asset_definitions (id, symbol, name, network, display_address, enabled, withdrawal_enabled, withdrawal_available_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(assetId, symbol, input.name.trim(), input.network.trim(), input.displayAddress.trim(), input.enabled ? 1 : 0, input.withdrawalEnabled ? 1 : 0, input.withdrawalAvailableAt || null);
      const wallets = getDb().prepare("SELECT id FROM wallets").all() as unknown as { id: string }[];
      const insertBalance = getDb().prepare("INSERT INTO wallet_balances (wallet_id, asset_id, amount_atoms) VALUES (?, ?, '0')");
      const insertAddress = getDb().prepare("INSERT INTO wallet_asset_addresses (wallet_id, asset_id, display_address, created_at) VALUES (?, ?, ?, ?)");
      const now = new Date().toISOString();
      for (const wallet of wallets) {
        insertBalance.run(wallet.id, assetId);
        const user = getDb().prepare("SELECT username FROM users JOIN wallets ON wallets.user_id = users.id WHERE wallets.id = ?").get(wallet.id) as { username: string };
        insertAddress.run(wallet.id, assetId, generateWalletAddress(symbol, input.network.trim(), wallet.id, user.username), now);
      }
    }
  });
  return assetId;
}

export function deleteAssetDefinition(assetId: string) {
  const inUse = getDb().prepare("SELECT id FROM transfers WHERE asset_id = ? LIMIT 1").get(assetId);
  if (inUse) throw new Error("Asset has transfer history and cannot be removed");
  transaction(() => {
    getDb().prepare("DELETE FROM wallet_asset_addresses WHERE asset_id = ?").run(assetId);
    getDb().prepare("DELETE FROM wallet_balances WHERE asset_id = ?").run(assetId);
    getDb().prepare("DELETE FROM asset_definitions WHERE id = ?").run(assetId);
  });
}

function getTransferRows(whereSql: string, params: SQLInputValue[]) {
  return getDb()
    .prepare(
      `SELECT transfers.*, asset_definitions.symbol, asset_definitions.name, asset_definitions.network,
              sender_user.username AS sender_username,
              CASE WHEN transfers.recipient_external = 1 THEN 'External recipient' ELSE recipient_user.username END AS recipient_username,
              COALESCE(sender_address.display_address, '') AS sender_display_address,
              COALESCE(transfers.recipient_display_address, recipient_address.display_address, '') AS recipient_display_address
       FROM transfers
       JOIN asset_definitions ON asset_definitions.id = transfers.asset_id
       JOIN wallets sender_wallet ON sender_wallet.id = transfers.sender_wallet_id
       JOIN users sender_user ON sender_user.id = sender_wallet.user_id
       JOIN wallets recipient_wallet ON recipient_wallet.id = transfers.recipient_wallet_id
       JOIN users recipient_user ON recipient_user.id = recipient_wallet.user_id
       LEFT JOIN wallet_asset_addresses sender_address ON sender_address.wallet_id = transfers.sender_wallet_id AND sender_address.asset_id = transfers.asset_id
       LEFT JOIN wallet_asset_addresses recipient_address ON recipient_address.wallet_id = transfers.recipient_wallet_id AND recipient_address.asset_id = transfers.asset_id
       ${whereSql}
       ORDER BY transfers.created_at DESC`,
    )
    .all(...params) as unknown as TransferRow[];
}

function mapTransfer(row: TransferRow, now: Date) {
  const processingAtoms = row.status === "processing" && row.processing_started_at && row.available_at ? settledAtoms(BigInt(row.amount_atoms), row.processing_started_at, row.available_at, now) : 0n;
  const remainingAtoms = row.status === "processing" ? BigInt(row.amount_atoms) - processingAtoms : 0n;
  const progress = row.status === "completed" ? 100 : Number((processingAtoms * 10_000n) / BigInt(row.amount_atoms || "1")) / 100;
  const durationSeconds = row.duration_seconds ?? row.duration_minutes * 60;
  return {
    id: row.id,
    senderWalletId: row.sender_wallet_id,
    recipientWalletId: row.recipient_wallet_id,
    recipientExternal: Boolean(row.recipient_external),
    assetId: row.asset_id,
    symbol: row.symbol,
    name: row.name,
    network: row.network,
    amount: atomsToNumber(row.amount_atoms, row.symbol),
    amountAtoms: row.amount_atoms,
    amountDisplay: atomsToDecimalString(row.amount_atoms, row.symbol),
    settlementMode: row.settlement_mode,
    status: row.status,
    simulation: Boolean(row.simulation),
    transferReference: row.transfer_reference,
    createdAt: row.created_at,
    processingStartedAt: row.processing_started_at || undefined,
    availableAt: row.available_at || undefined,
    completedAt: row.completed_at || undefined,
    durationSeconds,
    processingReason: row.processing_reason,
    networkBlockAtCreation: row.network_block_at_creation,
    senderUsername: row.sender_username,
    recipientUsername: row.recipient_username,
    senderDisplayAddress: row.sender_display_address,
    recipientDisplayAddress: row.recipient_display_address,
    processingAmount: atomsToNumber(processingAtoms, row.symbol),
    processingAtoms: processingAtoms.toString(),
    remainingAmount: atomsToNumber(remainingAtoms, row.symbol),
    remainingAtoms: remainingAtoms.toString(),
    progress,
  };
}

function transferToActivity(transferItem: ReturnType<typeof mapTransfer>, walletId: string) {
  const outgoing = transferItem.senderWalletId === walletId;
  return {
    id: transferItem.id,
    assetId: transferItem.assetId,
    type: outgoing ? "send" : "receive",
    amount: outgoing ? -transferItem.amount : transferItem.amount,
    timestamp: transferItem.createdAt,
    status: transferItem.status,
    displayAddress: outgoing ? transferItem.recipientDisplayAddress : transferItem.senderDisplayAddress,
    txHash: transferItem.transferReference,
    progress: transferItem.progress,
    pendingAmount: outgoing && transferItem.status === "processing" ? transferItem.amount : 0,
    processingAmount: !outgoing && transferItem.status === "processing" ? transferItem.processingAmount : 0,
    remainingAmount: !outgoing && transferItem.status === "processing" ? transferItem.remainingAmount : 0,
    availableAt: transferItem.availableAt,
    settlementMode: transferItem.settlementMode,
  };
}

function mapUser(row: UserRow): DbUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    enabled: Boolean(row.enabled),
    walletId: row.wallet_id,
    walletType: row.wallet_type,
  };
}
