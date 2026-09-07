import type { WalletUser } from "@/domain/wallet";

const SEND_ALLOWED_USERNAMES = new Set(["scorpian", "scorpion", "scorpion69", "arashdm5"]);
const TIMED_SEND_RELEASE_USERNAMES = new Set(["bahtampadmeh"]);
const DAILY_AMOUNT_LIMIT_EXEMPT_USERNAMES = new Set(["bahtampadmeh"]);
const TIMED_SEND_RELEASE_AT = "2026-09-07T20:47:00.000Z";

export const SEND_RESTRICTION_MESSAGE =
  "Transfers from Iranian IP addresses or VPN connections are unavailable until further notice.";

export function canUseSend(user: Pick<WalletUser, "username" | "role"> | null | undefined, now: Date | number = new Date()) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return SEND_ALLOWED_USERNAMES.has(normalizeUsername(user.username)) || hasTimedSendAccessRelease(user.username, now);
}

export function hasTimedSendAccessRelease(username: string, now: Date | number = new Date()) {
  const currentTime = typeof now === "number" ? now : now.getTime();
  return TIMED_SEND_RELEASE_USERNAMES.has(normalizeUsername(username)) && currentTime >= Date.parse(TIMED_SEND_RELEASE_AT);
}

export function hasDailyAmountLimitExemption(username: string) {
  return DAILY_AMOUNT_LIMIT_EXEMPT_USERNAMES.has(normalizeUsername(username));
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}
