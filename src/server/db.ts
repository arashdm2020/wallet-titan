import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { generateWalletAddress } from "@/domain/address";
import { hashPassword } from "@/server/auth";
import { parseAmountToAtoms } from "@/server/money";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.WALLET_SIM_DB_PATH || path.join(dataDir, "wallet-simulator.sqlite");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

export type Role = "ADMIN" | "USER";

export function getDb() {
  return db;
}

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','USER')),
      enabled INTEGER NOT NULL DEFAULT 1,
      send_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      wallet_type TEXT NOT NULL CHECK(wallet_type IN ('ADMIN','USER')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS asset_definitions (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      network TEXT NOT NULL,
      display_address TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      withdrawal_enabled INTEGER NOT NULL DEFAULT 0,
      withdrawal_available_at TEXT,
      icon_path TEXT
    );
    CREATE TABLE IF NOT EXISTS wallet_balances (
      wallet_id TEXT NOT NULL REFERENCES wallets(id),
      asset_id TEXT NOT NULL REFERENCES asset_definitions(id),
      amount_atoms TEXT NOT NULL,
      PRIMARY KEY(wallet_id, asset_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS settlement_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      immediate_enabled INTEGER NOT NULL,
      scheduled_enabled INTEGER NOT NULL,
      default_settlement_mode TEXT NOT NULL,
      default_duration_minutes INTEGER NOT NULL,
      default_duration_seconds INTEGER,
      max_duration_minutes INTEGER NOT NULL,
      max_duration_seconds INTEGER,
      daily_withdrawal_limit_usd_cents INTEGER,
      processing_reason TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      sender_wallet_id TEXT NOT NULL REFERENCES wallets(id),
      recipient_wallet_id TEXT NOT NULL REFERENCES wallets(id),
      recipient_display_address TEXT,
      recipient_external INTEGER NOT NULL DEFAULT 0,
      asset_id TEXT NOT NULL REFERENCES asset_definitions(id),
      amount_atoms TEXT NOT NULL,
      network_fee_atoms TEXT NOT NULL DEFAULT '0',
      network_fee_usd_cents INTEGER NOT NULL DEFAULT 0,
      settlement_mode TEXT NOT NULL CHECK(settlement_mode IN ('immediate','scheduled')),
      status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','failed','cancelled')),
      simulation INTEGER NOT NULL DEFAULT 1,
      transfer_reference TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      processing_started_at TEXT,
      available_at TEXT,
      completed_at TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER,
      processing_reason TEXT NOT NULL,
      network_block_at_creation INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL REFERENCES wallets(id),
      asset_id TEXT NOT NULL REFERENCES asset_definitions(id),
      transfer_id TEXT REFERENCES transfers(id),
      type TEXT NOT NULL CHECK(type IN ('debit','credit','hold','release')),
      amount_atoms TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wallet_asset_addresses (
      wallet_id TEXT NOT NULL REFERENCES wallets(id),
      asset_id TEXT NOT NULL REFERENCES asset_definitions(id),
      display_address TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(wallet_id, asset_id),
      UNIQUE(asset_id, display_address)
    );
    CREATE INDEX IF NOT EXISTS idx_transfers_sender ON transfers(sender_wallet_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_recipient ON transfers(recipient_wallet_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_credit_once ON ledger_entries(transfer_id, wallet_id, type) WHERE type = 'credit';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_release_once ON ledger_entries(transfer_id, wallet_id, type) WHERE type = 'release';
  `);
  addColumnIfMissing("settlement_settings", "default_duration_seconds", "INTEGER");
  addColumnIfMissing("settlement_settings", "max_duration_seconds", "INTEGER");
  addColumnIfMissing("settlement_settings", "daily_withdrawal_limit_usd_cents", "INTEGER");
  addColumnIfMissing("users", "send_enabled", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("transfers", "duration_seconds", "INTEGER");
  addColumnIfMissing("transfers", "network_fee_atoms", "TEXT NOT NULL DEFAULT '0'");
  addColumnIfMissing("transfers", "network_fee_usd_cents", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("transfers", "recipient_display_address", "TEXT");
  addColumnIfMissing("transfers", "recipient_external", "INTEGER NOT NULL DEFAULT 0");
  db.exec(`
    UPDATE settlement_settings
    SET default_duration_seconds = COALESCE(default_duration_seconds, default_duration_minutes * 60),
        max_duration_seconds = COALESCE(max_duration_seconds, max_duration_minutes * 60),
        daily_withdrawal_limit_usd_cents = COALESCE(daily_withdrawal_limit_usd_cents, 50000000);
    UPDATE transfers
    SET duration_seconds = COALESCE(duration_seconds, duration_minutes * 60);
  `);
  db.exec("UPDATE transfers SET transfer_reference = REPLACE(transfer_reference, 'D' || 'EMO-', 'SIM-') WHERE transfer_reference LIKE 'D' || 'EMO-%';");
  db.exec("UPDATE transfers SET transfer_reference = REPLACE(transfer_reference, 'SIM-', 'TRF-') WHERE transfer_reference LIKE 'SIM-%';");
  db.exec("UPDATE users SET send_enabled = 1 WHERE role = 'ADMIN';");
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

function getInitialAdminPassword() {
  const configured = process.env.WALLET_ADMIN_PASSWORD;
  if (configured) {
    if (configured.length < 8) throw new Error("WALLET_ADMIN_PASSWORD must be at least 8 characters");
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("WALLET_ADMIN_PASSWORD is required before creating the initial production admin account");
  }
  return "admin123";
}

export function seedDatabase() {
  migrate();
  transaction(() => {
    const now = new Date().toISOString();
    const adminUserId = "user_admin";
    const adminWalletId = "wallet_admin";
    const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();
    if (!existingAdmin) {
      db.prepare("INSERT INTO users (id, username, display_name, password_hash, role, enabled, created_at) VALUES (?, ?, ?, ?, 'ADMIN', 1, ?)")
        .run(adminUserId, "admin", "Primary Admin", hashPassword(getInitialAdminPassword()), now);
      db.prepare("INSERT INTO wallets (id, user_id, wallet_type, created_at) VALUES (?, ?, 'ADMIN', ?)").run(adminWalletId, adminUserId, now);
    }

    const assets = [
      ["asset_trx", "TRX", "TRON", "TRON", "TAbC9vT4pQXx7sL2mN8rY5kZ3wH6jP", 1, 1, "2026-09-05T18:00:00+03:30", "/assets/crypto/trx.svg", "250000"],
      ["asset_btc", "BTC", "Bitcoin", "Bitcoin", "bc1q84c92f71a0b3d56e91c4872fd3a6b8c22e9a", 1, 1, null, "/assets/crypto/btc.svg", "10"],
      ["asset_eth", "ETH", "Ethereum", "Ethereum", "0x3A4f2cB89dE912345678901234567890abcdef12", 1, 1, null, "/assets/crypto/eth.svg", "250"],
      ["asset_usdt", "USDT", "Tether USD", "TRON", "TQ9qL7rM2xV5sN8pY3kZ6wH4jC1bA", 1, 1, null, "/assets/crypto/usdt.svg", "1000000"],
    ];

    const insertAsset = db.prepare("INSERT OR IGNORE INTO asset_definitions (id, symbol, name, network, display_address, enabled, withdrawal_enabled, withdrawal_available_at, icon_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const asset of assets) {
      insertAsset.run(asset[0], asset[1], asset[2], asset[3], asset[4], asset[5], asset[6], asset[7], asset[8]);
    }
    const repairAsset = db.prepare("UPDATE asset_definitions SET icon_path = ?, display_address = CASE WHEN display_address LIKE '%' || 'De' || 'mo' || '%' OR display_address LIKE '%' || 'de' || 'mo' || '%' THEN ? ELSE display_address END WHERE id = ?");
    for (const asset of assets) repairAsset.run(asset[8], asset[4], asset[0]);

    const wallets = db
      .prepare(
        `SELECT wallets.id, wallets.wallet_type, users.username
         FROM wallets JOIN users ON users.id = wallets.user_id`,
      )
      .all() as unknown as { id: string; wallet_type: "ADMIN" | "USER"; username: string }[];
    const insertMissingBalance = db.prepare("INSERT OR IGNORE INTO wallet_balances (wallet_id, asset_id, amount_atoms) VALUES (?, ?, ?)");
    const insertMissingAddress = db.prepare("INSERT OR IGNORE INTO wallet_asset_addresses (wallet_id, asset_id, display_address, created_at) VALUES (?, ?, ?, ?)");
    for (const wallet of wallets) {
      for (const asset of assets) {
        const seedAmount = wallet.wallet_type === "ADMIN" ? parseAmountToAtoms(String(asset[9]), String(asset[1])).toString() : "0";
        insertMissingBalance.run(wallet.id, asset[0], seedAmount);
        insertMissingAddress.run(wallet.id, asset[0], generateWalletAddress(String(asset[1]), String(asset[3]), wallet.id, wallet.username), now);
      }
    }

    db.prepare("INSERT OR IGNORE INTO settlement_settings (id, immediate_enabled, scheduled_enabled, default_settlement_mode, default_duration_minutes, default_duration_seconds, max_duration_minutes, max_duration_seconds, daily_withdrawal_limit_usd_cents, processing_reason) VALUES (1, 1, 1, 'scheduled', 480, 28800, 720, 43200, 50000000, 'Full ledger verification from block 0')").run();
  });
}

export { id };
