export const formatUsd = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatCrypto = (value: number, symbol: string) =>
  `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 2 : 6,
  }).format(value)} ${symbol}`;

export const formatPercent = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

export const shortAddress = (address?: string) => {
  if (!address) return "No address configured";
  if (address.length <= 18) return address;
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
};

export const formatDateTime = (iso?: string) => {
  if (!iso) return "Not scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid timestamp";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};
