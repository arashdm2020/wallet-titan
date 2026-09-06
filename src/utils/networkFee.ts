const firstThresholdUsd = 1_000;
const tierWidthUsd = 9_000;
const feePerTierUsd = 71;

export function estimateNetworkFeeUsd(amount: number, priceUsd: number | null | undefined) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(priceUsd) || !priceUsd || priceUsd <= 0) return 0;
  const transferUsd = amount * priceUsd;
  if (transferUsd <= firstThresholdUsd) return 0;
  const tiers = Math.floor((transferUsd - firstThresholdUsd - Number.EPSILON) / tierWidthUsd) + 1;
  return tiers * feePerTierUsd;
}
