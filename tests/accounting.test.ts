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

function session(user: ReturnType<typeof services.authenticate> | ReturnType<typeof services.createUserWallet>) {
  if (!user) throw new Error("Missing user");
  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    walletId: user.walletId,
    walletType: user.walletType,
  };
}

function asset(symbol: string) {
  const found = services.getAdminSnapshot().assets.find((item) => item.symbol === symbol);
  if (!found) throw new Error(`${symbol} asset missing`);
  return found;
}

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
  const userSnapshot = services.getWalletSnapshot(session(user));
  assert.deepEqual(userSnapshot.assets.map((item) => [item.symbol, item.balance]), [["TRX", 0], ["BTC", 0], ["ETH", 0], ["USDT", 0]]);

  const adminSnapshot = services.getWalletSnapshot(session(admin));
  assert.equal(adminSnapshot.assets.find((item) => item.symbol === "BTC")?.balance, 10);
});

test("immediate transfer debits sender, credits recipient, and completes atomically", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "bob", password: "password123" });
  const btc = asset("BTC");
  services.updateSettlementSettings({ defaultMode: "immediate", defaultDurationSeconds: 28_800, maxDurationSeconds: 43_200, processingReason: "Fast internal settlement", immediateEnabled: true, scheduledEnabled: true });

  const transfer = transfers.createTransfer({ senderWalletId: admin.walletId, recipient: user.username, assetId: btc.id, amount: "1" });
  assert.equal(transfer.status, "completed");

  const adminBtc = services.getWalletSnapshot(session(admin)).assets.find((item) => item.symbol === "BTC")!;
  const userBtc = services.getWalletSnapshot(session(user)).assets.find((item) => item.symbol === "BTC")!;
  assert.equal(adminBtc.balance, 9);
  assert.equal(adminBtc.pendingOutgoing, 0);
  assert.equal(userBtc.balance, 1);
  assert.equal(userBtc.processingIncoming, 0);
});

test("scheduled transfer shows pending outgoing and locked progressive incoming until final release", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "carol", password: "password123" });
  const btc = asset("BTC");
  services.setWalletBalance(admin.walletId, btc.id, "10");
  services.setWalletBalance(user.walletId, btc.id, "1");
  services.updateSettlementSettings({ defaultMode: "scheduled", defaultDurationSeconds: 28_800, maxDurationSeconds: 43_200, processingReason: "Full ledger verification from block 0", immediateEnabled: true, scheduledEnabled: true });

  const transfer = transfers.createTransfer({ senderWalletId: admin.walletId, recipient: user.username, assetId: btc.id, amount: "2" });

  const start = new Date("2026-01-01T00:00:00.000Z");
  const fourHours = new Date("2026-01-01T04:00:00.000Z");
  const sevenFiftyNine = new Date("2026-01-01T07:59:00.000Z");
  const end = new Date("2026-01-01T08:00:00.000Z");
  dbModule.getDb()
    .prepare("UPDATE transfers SET created_at = ?, processing_started_at = ?, available_at = ?, duration_seconds = ? WHERE id = ?")
    .run(start.toISOString(), start.toISOString(), end.toISOString(), 28_800, transfer.id);

  const adminAtStart = services.getWalletSnapshot(session(admin), start).assets.find((item) => item.symbol === "BTC")!;
  const userAtStart = services.getWalletSnapshot(session(user), start).assets.find((item) => item.symbol === "BTC")!;
  assert.equal(adminAtStart.balance, 8);
  assert.equal(adminAtStart.pendingOutgoing, 2);
  assert.equal(userAtStart.balance, 1);
  assert.equal(userAtStart.pendingIncomingTotal, 2);
  assert.equal(userAtStart.processingIncoming, 0);

  const userAtFourHours = services.getWalletSnapshot(session(user), fourHours).assets.find((item) => item.symbol === "BTC")!;
  const adminAtFourHours = services.getWalletSnapshot(session(admin), fourHours).assets.find((item) => item.symbol === "BTC")!;
  assert.equal(adminAtFourHours.balance, 8);
  assert.equal(adminAtFourHours.pendingOutgoing, 2);
  assert.equal(userAtFourHours.balance, 1);
  assert.equal(userAtFourHours.processingIncoming, 1);
  assert.equal(userAtFourHours.incomingRemaining, 1);
  assert.throws(() => transfers.createTransfer({ senderWalletId: user.walletId, recipient: admin.username, assetId: btc.id, amount: "1.1" }), /Insufficient spendable balance/);

  const userAtSevenFiftyNine = services.getWalletSnapshot(session(user), sevenFiftyNine).assets.find((item) => item.symbol === "BTC")!;
  assert.equal(userAtSevenFiftyNine.balance, 1);
  assert.ok((userAtSevenFiftyNine.processingIncoming || 0) > 1.99);

  services.finalizeDueTransfers(end);
  services.finalizeDueTransfers(new Date(end.getTime() + 60_000));
  const adminCompleted = services.getWalletSnapshot(session(admin), end).assets.find((item) => item.symbol === "BTC")!;
  const userCompleted = services.getWalletSnapshot(session(user), end).assets.find((item) => item.symbol === "BTC")!;
  const completedTransfer = services.getTransferByIdScoped(transfer.id, session(user), end)!;
  assert.equal(adminCompleted.balance, 8);
  assert.equal(adminCompleted.pendingOutgoing, 0);
  assert.equal(userCompleted.balance, 3);
  assert.equal(userCompleted.processingIncoming, 0);
  assert.equal(completedTransfer.status, "completed");

  const creditRows = dbModule.getDb().prepare("SELECT COUNT(*) AS count FROM ledger_entries WHERE transfer_id = ? AND type = 'credit'").get(transfer.id) as { count: number };
  assert.equal(creditRows.count, 1);
});

test("overspend, negative balances, invalid addresses, and decimal precision are enforced", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "dave", password: "password123" });
  const trx = asset("TRX");
  services.updateSettlementSettings({ defaultMode: "immediate", defaultDurationSeconds: 28_800, maxDurationSeconds: 43_200, processingReason: "Fast internal settlement", immediateEnabled: true, scheduledEnabled: true });

  assert.throws(() => transfers.createTransfer({ senderWalletId: user.walletId, recipient: admin.username, assetId: trx.id, amount: "1" }), /Insufficient spendable balance/);
  assert.throws(() => transfers.createTransfer({ senderWalletId: admin.walletId, recipient: user.username, assetId: trx.id, amount: "0.0000001" }), /more than 6 decimal/);
  assert.throws(() => transfers.createTransfer({ senderWalletId: admin.walletId, recipient: "bad address", assetId: trx.id, amount: "1" }), /Enter a TRON address|Recipient not found/);
});

test("two sends cannot spend the same available balance", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "erin", password: "password123" });
  const btc = asset("BTC");
  services.setWalletBalance(admin.walletId, btc.id, "1");
  services.updateSettlementSettings({ defaultMode: "scheduled", defaultDurationSeconds: 28_800, maxDurationSeconds: 43_200, processingReason: "Full ledger verification from block 0", immediateEnabled: true, scheduledEnabled: true });

  const first = transfers.createTransfer({ senderWalletId: admin.walletId, recipient: user.username, assetId: btc.id, amount: "0.8" });
  assert.equal(first.status, "processing");
  assert.throws(() => transfers.createTransfer({ senderWalletId: admin.walletId, recipient: user.username, assetId: btc.id, amount: "0.8" }), /Insufficient spendable balance/);
  assert.equal(services.getWalletSnapshot(session(admin)).assets.find((item) => item.symbol === "BTC")!.balance, 0.2);
});

test("changing default duration does not alter historical scheduled transfer timestamps", () => {
  const admin = services.authenticate("admin", "admin123")!;
  const user = services.createUserWallet({ username: "frank", password: "password123" });
  const usdt = asset("USDT");
  services.updateSettlementSettings({ defaultMode: "scheduled", defaultDurationSeconds: 28_800, maxDurationSeconds: 43_200, processingReason: "Full ledger verification from block 0", immediateEnabled: true, scheduledEnabled: true });
  const transfer = transfers.createTransfer({ senderWalletId: admin.walletId, recipient: user.username, assetId: usdt.id, amount: "4800" });
  const before = services.getTransferByIdScoped(transfer.id, session(admin))!;
  services.updateSettlementSettings({ defaultMode: "scheduled", defaultDurationSeconds: 3_600, maxDurationSeconds: 43_200, processingReason: "Changed default", immediateEnabled: true, scheduledEnabled: true });
  const after = services.getTransferByIdScoped(transfer.id, session(admin))!;
  assert.equal(after.availableAt, before.availableAt);
  assert.equal(after.durationSeconds, 28_800);
});
