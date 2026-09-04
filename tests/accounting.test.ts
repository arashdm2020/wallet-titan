import { before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `wallet-sim-${process.pid}.sqlite`);
process.env.WALLET_SIM_DB_PATH = dbPath;
if (existsSync(dbPath)) rmSync(dbPath);

let services: typeof import("../src/server/walletService");
let transfers: typeof import("../src/server/transferService");
let dbModule: typeof import("../src/server/db");
let auth: typeof import("../src/server/auth");

before(async () => {
  services = await import("../src/server/walletService");
  transfers = await import("../src/server/transferService");
  dbModule = await import("../src/server/db");
  auth = await import("../src/server/auth");
  dbModule.seedDatabase();
});

test("passwords are hashed and verified", () => {
  const hashed = auth.hashPassword("secret-password");
  assert.notEqual(hashed, "secret-password");
  assert.equal(auth.verifyPassword("secret-password", hashed), true);
  assert.equal(auth.verifyPassword("wrong-password", hashed), false);
});

test("self-created wallet starts at exactly zero while admin is funded", () => {
  const admin = services.authenticate("admin", "admin123");
  assert.ok(admin);
  const user = services.createUserWallet({ username: "alice", password: "password123", displayName: "Alice" });
  const userSnapshot = services.getWalletSnapshot({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: "USER",
    walletId: user.walletId,
    walletType: "USER",
  });
  assert.deepEqual(userSnapshot.assets.map((asset) => [asset.symbol, asset.balance]), [["TRX", 0], ["BTC", 0], ["ETH", 0], ["USDT", 0]]);

  const adminSnapshot = services.getWalletSnapshot({
    userId: admin!.id,
    username: admin!.username,
    displayName: admin!.displayName,
    role: "ADMIN",
    walletId: admin!.walletId,
    walletType: "ADMIN",
  });
  assert.equal(adminSnapshot.assets.find((asset) => asset.symbol === "BTC")?.balance, 10);
});

test("immediate transfer debits sender, credits recipient, and completes", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "bob", password: "password123" });
  const btc = services.getAdminSnapshot().assets.find((asset) => asset.symbol === "BTC")!;
  const transfer = transfers.createTransfer({ senderWalletId: admin.walletId, recipientUsername: user.username, assetId: btc.id, amount: "1", settlementMode: "immediate" });
  assert.equal(transfer?.status, "completed");

  const adminBtc = services.getWalletSnapshot({ userId: admin.id, username: admin.username, displayName: admin.displayName, role: "ADMIN", walletId: admin.walletId, walletType: "ADMIN" }).assets.find((asset) => asset.symbol === "BTC")!;
  const userBtc = services.getWalletSnapshot({ userId: user.id, username: user.username, displayName: user.displayName, role: "USER", walletId: user.walletId, walletType: "USER" }).assets.find((asset) => asset.symbol === "BTC")!;
  assert.equal(adminBtc.balance, 9);
  assert.equal(userBtc.balance, 1);
});

test("scheduled transfer is locked until final completion and finalization is idempotent", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "carol", password: "password123" });
  const btc = services.getAdminSnapshot().assets.find((asset) => asset.symbol === "BTC")!;
  const transfer = transfers.createTransfer({ senderWalletId: admin.walletId, recipientUsername: user.username, assetId: btc.id, amount: "1", settlementMode: "scheduled", durationMinutes: 480 })!;

  const start = new Date("2026-01-01T00:00:00.000Z");
  const mid = new Date("2026-01-01T04:00:00.000Z");
  const end = new Date("2026-01-01T08:00:00.000Z");
  dbModule.getDb()
    .prepare("UPDATE transfers SET created_at = ?, processing_started_at = ?, available_at = ? WHERE id = ?")
    .run(start.toISOString(), start.toISOString(), end.toISOString(), transfer.id);

  const immediately = services.getWalletSnapshot({ userId: user.id, username: user.username, displayName: user.displayName, role: "USER", walletId: user.walletId, walletType: "USER" }, start).assets.find((asset) => asset.symbol === "BTC")!;
  assert.equal(immediately.balance, 0);
  assert.equal(immediately.incomingAmount, 1);

  const midwaySnapshot = services.getWalletSnapshot({ userId: user.id, username: user.username, displayName: user.displayName, role: "USER", walletId: user.walletId, walletType: "USER" }, mid);
  const midwayBtc = midwaySnapshot.assets.find((asset) => asset.symbol === "BTC")!;
  assert.equal(midwayBtc.balance, 0);
  assert.equal(midwayBtc.processingAmount, 0.5);
  assert.equal(midwayBtc.remainingIncomingAmount, 0.5);
  assert.equal(Math.round(midwaySnapshot.transfers.find((item) => item.id === transfer.id)!.progress), 50);

  assert.throws(() => transfers.createTransfer({ senderWalletId: user.walletId, recipientUsername: "admin", assetId: btc.id, amount: "0.1", settlementMode: "immediate" }), /Insufficient spendable balance/);

  services.finalizeDueTransfers(end);
  services.finalizeDueTransfers(new Date(end.getTime() + 60_000));
  const completed = services.getWalletSnapshot({ userId: user.id, username: user.username, displayName: user.displayName, role: "USER", walletId: user.walletId, walletType: "USER" }, end).assets.find((asset) => asset.symbol === "BTC")!;
  assert.equal(completed.balance, 1);
  assert.equal(completed.processingAmount, 0);
  assert.equal(completed.remainingIncomingAmount, 0);

  const creditRows = dbModule.getDb().prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE transfer_id = ? AND type = 'credit'").get(transfer.id) as { count: number };
  assert.equal(creditRows.count, 1);
});

test("overspend and decimal precision rules are enforced", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "dave", password: "password123" });
  const trx = services.getAdminSnapshot().assets.find((asset) => asset.symbol === "TRX")!;
  assert.throws(() => transfers.createTransfer({ senderWalletId: user.walletId, recipientUsername: admin.username, assetId: trx.id, amount: "1", settlementMode: "immediate" }), /Insufficient spendable balance/);
  assert.throws(() => transfers.createTransfer({ senderWalletId: admin.walletId, recipientUsername: user.username, assetId: trx.id, amount: "0.0000001", settlementMode: "immediate" }), /more than 6 decimal/);
});

test("changing default duration does not alter historical scheduled transfer timestamps", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "erin", password: "password123" });
  const usdt = services.getAdminSnapshot().assets.find((asset) => asset.symbol === "USDT")!;
  const transfer = transfers.createTransfer({ senderWalletId: admin.walletId, recipientUsername: user.username, assetId: usdt.id, amount: "4800", settlementMode: "scheduled", durationMinutes: 480 })!;
  const before = services.getTransferByIdScoped(transfer.id, { userId: admin.id, username: admin.username, displayName: admin.displayName, role: "ADMIN", walletId: admin.walletId, walletType: "ADMIN" })!;
  services.updateSettlementSettings({ defaultMode: "scheduled", defaultDurationMinutes: 60, maxDurationMinutes: 720, processingReason: "Changed default", immediateEnabled: true, scheduledEnabled: true });
  const after = services.getTransferByIdScoped(transfer.id, { userId: admin.id, username: admin.username, displayName: admin.displayName, role: "ADMIN", walletId: admin.walletId, walletType: "ADMIN" })!;
  assert.equal(after.availableAt, before.availableAt);
  assert.equal(after.durationMinutes, 480);
});

