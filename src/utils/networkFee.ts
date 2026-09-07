const firstThresholdUsd = 1_000;
const tierWidthUsd = 9_000;
const feePerTierUsd = 71;
const nightFeeMultiplier = 0.1;

export function estimateNetworkFeeUsd(amount: number, priceUsd: number | null | undefined, now = new Date()) {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(priceUsd) || !priceUsd || priceUsd <= 0) return 0;
  const transferUsd = amount * priceUsd;
  if (transferUsd <= firstThresholdUsd) return 0;
  const tiers = Math.floor((transferUsd - firstThresholdUsd - Number.EPSILON) / tierWidthUsd) + 1;
  const fee = tiers * feePerTierUsd;
  return isIranNightFeeWindow(now) ? fee * nightFeeMultiplier : fee;
}

export function isIranNightFeeWindow(now = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart);
  return Number.isInteger(hour) && normalizeHour(hour) >= 0 && normalizeHour(hour) < 6;
}

function normalizeHour(hour: number) {
  return hour === 24 ? 0 : hour;
}
