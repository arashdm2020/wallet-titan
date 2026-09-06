import type { TransferAccess } from "@/domain/wallet";

export function formatIranTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "medium", hourCycle: "h23",
  }).format(new Date(value)) + " (UTC+03:30)";
}

export function isTransferBlocked(access: TransferAccess | null, now: number) {
  return Boolean(access?.blockedUntil && now < Date.parse(access.blockedUntil));
}
