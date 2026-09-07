import type { WalletUser } from "@/domain/wallet";

const SEND_ALLOWED_USERNAMES = new Set(["scorpian", "scorpion", "scorpion69"]);

export const SEND_RESTRICTION_MESSAGE =
  "Transfers from Iranian IP addresses or VPN connections are unavailable until further notice.";

export function canUseSend(user: Pick<WalletUser, "username" | "role"> | null | undefined) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return SEND_ALLOWED_USERNAMES.has(user.username.trim().toLowerCase());
}
