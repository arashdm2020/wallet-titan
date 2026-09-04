import type { NextRequest } from "next/server";
import { getDb, id, seedDatabase, type Role } from "@/server/db";
import { hashSessionToken, newSessionToken } from "@/server/auth";

export const sessionCookieName = "wallet_session";
const sessionDays = 7;

export interface AuthSession {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  walletId: string;
  walletType: "ADMIN" | "USER";
  token?: string;
}

interface SessionRow {
  user_id: string;
  username: string;
  display_name: string;
  role: Role;
  wallet_id: string;
  wallet_type: "ADMIN" | "USER";
  expires_at: string;
  revoked_at: string | null;
  enabled: number;
}

export function createSession(userId: string) {
  seedDatabase();
  const token = newSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDays * 24 * 60 * 60 * 1000);
  getDb()
    .prepare("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(id("session"), userId, hashSessionToken(token), now.toISOString(), expiresAt.toISOString());
  return { token, expiresAt };
}

export function getSessionFromRequest(request: NextRequest): AuthSession | null {
  seedDatabase();
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT users.id AS user_id, users.username, users.display_name, users.role, users.enabled,
              wallets.id AS wallet_id, wallets.wallet_type, sessions.expires_at, sessions.revoked_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       JOIN wallets ON wallets.user_id = users.id
       WHERE sessions.token_hash = ?
       LIMIT 1`,
    )
    .get(hashSessionToken(token)) as SessionRow | undefined;

  if (!row || !row.enabled || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null;
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    walletId: row.wallet_id,
    walletType: row.wallet_type,
    token,
  };
}

export function requireSession(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export function requireAdmin(request: NextRequest) {
  const session = requireSession(request);
  if (session.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}

export function revokeSession(token: string | undefined) {
  if (!token) return;
  seedDatabase();
  getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), hashSessionToken(token));
}
