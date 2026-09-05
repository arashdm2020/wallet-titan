export type ActivityStatus = "completed" | "pending" | "processing" | "failed" | "cancelled";
export type ActivityType = "send" | "receive" | "swap" | "adjustment";
export type UserRole = "ADMIN" | "USER";
export type SettlementMode = "immediate" | "scheduled";
export type TransferStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface WalletUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  canSend: boolean;
}

export interface WalletAsset {
  id: string;
  symbol: string;
  name: string;
  network: string;
  balance: number;
  balanceAtoms?: string;
  balanceDisplay?: string;
  availableBalance?: number;
  availableBalanceAtoms?: string;
  pendingOutgoing?: number;
  pendingOutgoingAtoms?: string;
  incomingAmount?: number;
  processingAmount?: number;
  processingIncoming?: number;
  processingIncomingAtoms?: string;
  pendingIncomingTotal?: number;
  pendingIncomingAtoms?: string;
  remainingIncomingAmount?: number;
  incomingRemaining?: number;
  incomingRemainingAtoms?: string;
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
  pendingAmount?: number;
  processingAmount?: number;
  remainingAmount?: number;
  availableAt?: string;
  settlementMode?: SettlementMode;
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
  durationSeconds: number;
  processingReason: string;
  networkBlockAtCreation: number;
  senderUsername: string;
  recipientUsername: string;
  recipientExternal?: boolean;
  senderDisplayAddress: string;
  recipientDisplayAddress: string;
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
