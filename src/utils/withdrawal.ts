import type { WalletAsset } from "@/domain/wallet";

export interface WithdrawalState {
  enabled: boolean;
  available: boolean;
  label: string;
  countdown: string | null;
  remainingMs: number;
}

export const getWithdrawalState = (asset: WalletAsset | undefined, nowMs = Date.now()): WithdrawalState => {
  if (!asset?.withdrawalEnabled) {
    return {
      enabled: false,
      available: false,
      label: "Withdrawal disabled",
      countdown: null,
      remainingMs: 0,
    };
  }

  if (!asset.withdrawalAvailableAt) {
    return {
      enabled: true,
      available: true,
      label: "Withdrawal available",
      countdown: null,
      remainingMs: 0,
    };
  }

  const targetMs = new Date(asset.withdrawalAvailableAt).getTime();
  const remainingMs = targetMs - nowMs;

  if (Number.isNaN(targetMs) || remainingMs <= 0) {
    return {
      enabled: true,
      available: true,
      label: "Withdrawal available",
      countdown: null,
      remainingMs: 0,
    };
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return {
    enabled: true,
    available: false,
    label: "Withdrawal scheduled",
    countdown: parts.join(" "),
    remainingMs,
  };
};
