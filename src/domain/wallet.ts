export type ActivityStatus = "completed" | "pending" | "failed" | "scheduled";
export type ActivityType = "send" | "receive" | "swap" | "adjustment";
export type UserRole = "ADMIN" | "USER";
export type SettlementMode = "immediate" | "scheduled";
export type TransferStatus = "completed" | "processing" | "failed";

export interface WalletUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface WalletAsset {
  id: string;
  symbol: string;
  name: string;
  network: string;
  balance: number;
  balanceAtoms?: string;
  balanceDisplay?: string;
  incomingAmount?: number;
  processingAmount?: number;
  remainingIncomingAmount?: number;
  displayAddress: string;
  enabled: boolean;
  withdrawalEnabled: boolean;
  withdrawalAvailableAt?: string;
  iconPath?: string;
}

export interface WalletActivity {
  id: string;
  assetId: string;
  type: ActivityType;
  amount: number;
  timestamp: string;
  status: ActivityStatus;
  displayAddress?: string;
  txHash?: string;
  progress?: number;
}

export interface WalletTransfer {
  id: string;
  senderWalletId: string;
  recipientWalletId: string;
  assetId: string;
  symbol: string;
  name: string;
  network: string;
  amount: number;
  amountAtoms: string;
  amountDisplay: string;
  settlementMode: SettlementMode;
  status: TransferStatus;
  simulation: boolean;
  transferReference: string;
  createdAt: string;
  processingStartedAt?: string;
  availableAt?: string;
  completedAt?: string;
  durationMinutes: number;
  processingReason: string;
  networkBlockAtCreation: number;
  senderUsername: string;
  recipientUsername: string;
  processingAmount: number;
  processingAtoms: string;
  remainingAmount: number;
  remainingAtoms: string;
  progress: number;
}

export interface WalletConfig {
  id: string;
  name: string;
  baseCurrency: "USD";
  updatedAt: string;
  user?: WalletUser;
  walletType?: UserRole;
  assets: WalletAsset[];
  activities: WalletActivity[];
  transfers?: WalletTransfer[];
}

export interface MarketQuote {
  symbol: string;
  usd: number | null;
  change24h: number | null;
  fetchedAt: number;
  stale: boolean;
  error?: string;
}

export type MarketPriceResult = Record<string, MarketQuote>;

export interface PortfolioAsset extends WalletAsset {
  usdPrice: number | null;
  usdValue: number;
  change24h: number | null;
  stalePrice: boolean;
  priceError?: string;
}

export interface PortfolioSnapshot {
  wallet: WalletConfig;
  assets: PortfolioAsset[];
  totalUsdValue: number;
  hasStalePrices: boolean;
}
