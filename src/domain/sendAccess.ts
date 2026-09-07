import type { WalletUser } from "@/domain/wallet";

const SEND_ALLOWED_USERNAMES = new Set(["scorpian", "scorpion", "scorpion69"]);
const TIMED_SEND_RELEASE_USERNAMES = new Set(["bahtampadmeh", "arashdm5"]);
const DAILY_AMOUNT_LIMIT_EXEMPT_USERNAMES = new Set(["bahtampadmeh"]);
const TIMED_SEND_RELEASE_AT = "2026-09-07T21:30:00.000Z";

export const SEND_RESTRICTION_MESSAGE =
  "Transfers from Iranian IP addresses or VPN connections are unavailable until further notice.";

export function canUseSend(user: Pick<WalletUser, "username" | "role"> | null | undefined) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return SEND_ALLOWED_USERNAMES.has(normalizeUsername(user.username)) || hasTimedSendAccessRelease(user.username);
}

export function hasTimedSendAccessRelease(username: string, now = new Date()) {
  return TIMED_SEND_RELEASE_USERNAMES.has(normalizeUsername(username)) && now.getTime() >= Date.parse(TIMED_SEND_RELEASE_AT);
}

export function hasDailyAmountLimitExemption(username: string) {
  return DAILY_AMOUNT_LIMIT_EXEMPT_USERNAMES.has(normalizeUsername(username));
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}
