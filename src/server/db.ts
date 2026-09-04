import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
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
      max_duration_minutes INTEGER NOT NULL,
      processing_reason TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      sender_wallet_id TEXT NOT NULL REFERENCES wallets(id),
      recipient_wallet_id TEXT NOT NULL REFERENCES wallets(id),
      asset_id TEXT NOT NULL REFERENCES asset_definitions(id),
      amount_atoms TEXT NOT NULL,
      settlement_mode TEXT NOT NULL CHECK(settlement_mode IN ('immediate','scheduled')),
      status TEXT NOT NULL CHECK(status IN ('completed','processing','failed')),
      simulation INTEGER NOT NULL DEFAULT 1,
      transfer_reference TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      processing_started_at TEXT,
      available_at TEXT,
      completed_at TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
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
    CREATE INDEX IF NOT EXISTS idx_transfers_sender ON transfers(sender_wallet_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_recipient ON transfers(recipient_wallet_id);
  `);
  db.exec("UPDATE transfers SET transfer_reference = REPLACE(transfer_reference, 'D' || 'EMO-', 'SIM-') WHERE transfer_reference LIKE 'D' || 'EMO-%';");
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
      ["asset_trx", "TRX", "TRON", "TRON", "TAdminTrxSimulatorDisplayOnly9xuWb", 1, 1, "2026-09-05T18:00:00+03:30", "/assets/crypto/trx.svg", "250000"],
      ["asset_btc", "BTC", "Bitcoin", "Bitcoin", "bc1qadminsim9xs0simulator8displayonly4wallet", 1, 1, null, "/assets/crypto/btc.svg", "10"],
      ["asset_eth", "ETH", "Ethereum", "Ethereum", "0xAdminSim85F4293Eef9d7C7096cAB4f6F7Display", 1, 1, null, "/assets/crypto/eth.svg", "250"],
      ["asset_usdt", "USDT", "Tether USD", "TRON", "TAdminUsdtSimulatorAddressOnlyNoRealFunds8s9Yq", 1, 1, null, "/assets/crypto/usdt.svg", "1000000"],
    ];

    const insertAsset = db.prepare("INSERT OR IGNORE INTO asset_definitions (id, symbol, name, network, display_address, enabled, withdrawal_enabled, withdrawal_available_at, icon_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const asset of assets) {
      insertAsset.run(asset[0], asset[1], asset[2], asset[3], asset[4], asset[5], asset[6], asset[7], asset[8]);
    }
    const repairAsset = db.prepare("UPDATE asset_definitions SET icon_path = ?, display_address = CASE WHEN display_address LIKE '%' || 'De' || 'mo' || '%' OR display_address LIKE '%' || 'de' || 'mo' || '%' THEN ? ELSE display_address END WHERE id = ?");
    for (const asset of assets) repairAsset.run(asset[8], asset[4], asset[0]);

    const wallets = db.prepare("SELECT id, wallet_type FROM wallets").all() as unknown as { id: string; wallet_type: "ADMIN" | "USER" }[];
    const insertMissingBalance = db.prepare("INSERT OR IGNORE INTO wallet_balances (wallet_id, asset_id, amount_atoms) VALUES (?, ?, ?)");
    for (const wallet of wallets) {
      for (const asset of assets) {
        const seedAmount = wallet.wallet_type === "ADMIN" ? parseAmountToAtoms(String(asset[9]), String(asset[1])).toString() : "0";
        insertMissingBalance.run(wallet.id, asset[0], seedAmount);
      }
    }

    db.prepare("INSERT OR IGNORE INTO settlement_settings (id, immediate_enabled, scheduled_enabled, default_settlement_mode, default_duration_minutes, max_duration_minutes, processing_reason) VALUES (1, 1, 1, 'scheduled', 480, 720, 'Full ledger verification from block 0')").run();
  });
}

export { id };
