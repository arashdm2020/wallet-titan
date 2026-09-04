"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MarketPriceResult, PortfolioSnapshot, WalletActivity, WalletAsset, WalletConfig, WalletTransfer, WalletUser } from "@/domain/wallet";
import { marketPriceProvider } from "@/services/coinGeckoProvider";
import { portfolioService } from "@/services/portfolioService";

interface WalletStoreValue {
  session: WalletUser | null;
  wallet: WalletConfig | null;
  portfolio: PortfolioSnapshot | null;
  prices: MarketPriceResult;
  activities: WalletActivity[];
  transfers: WalletTransfer[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  now: number;
  refresh: (options?: { forcePrices?: boolean }) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  createWallet: (input: { username: string; password: string; confirmPassword: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  createTransfer: (input: { assetId: string; recipientUsername: string; amount: string; settlementMode?: "immediate" | "scheduled"; durationMinutes?: number }) => Promise<{ id: string }>;
  getAsset: (id: string) => WalletAsset | undefined;
  getPortfolioAsset: (id: string) => PortfolioSnapshot["assets"][number] | undefined;
  getActivities: (assetId?: string) => WalletActivity[];
}

const WalletStoreContext = createContext<WalletStoreValue | null>(null);

export function WalletStoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<WalletUser | null>(null);
  const [wallet, setWallet] = useState<WalletConfig | null>(null);
  const [prices, setPrices] = useState<MarketPriceResult>({});
  const [activities, setActivities] = useState<WalletActivity[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const requestJson = useCallback(async <T,>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data as T;
  }, []);

  const load = useCallback(async (options: { forcePrices?: boolean } = {}) => {
    setError(null);
    const sessionData = await requestJson<{ session: WalletUser | null }>("/api/session");
    setSession(sessionData.session);
    if (!sessionData.session) {
      setWallet(null);
      setActivities([]);
      setTransfers([]);
      setPrices({});
      return;
    }

    const snapshot = await requestJson<{
      user: WalletUser;
      wallet: { id: string; baseCurrency: "USD"; walletType: "ADMIN" | "USER" };
      assets: WalletAsset[];
      activities: WalletActivity[];
      transfers: WalletTransfer[];
    }>("/api/wallet");

    const enabledSymbols = snapshot.assets.filter((asset) => asset.enabled).map((asset) => asset.symbol);
    const nextPrices = await marketPriceProvider.getPrices(enabledSymbols, { force: options.forcePrices });
    const nextWallet: WalletConfig = {
      id: snapshot.wallet.id,
      name: snapshot.user.displayName,
      baseCurrency: "USD",
      updatedAt: new Date().toISOString(),
      user: snapshot.user,
      walletType: snapshot.wallet.walletType,
      assets: snapshot.assets,
      activities: snapshot.activities,
      transfers: snapshot.transfers,
    };
    setSession(snapshot.user);
    setWallet(nextWallet);
    setPrices(nextPrices);
    setTransfers(snapshot.transfers);
    setActivities(snapshot.activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }, [requestJson]);

  const refresh = useCallback(
    async (options: { forcePrices?: boolean } = {}) => {
      setRefreshing(true);
      try {
        await load(options);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to refresh wallet data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load],
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => refresh({ forcePrices: true }), 0);
    const priceTimer = window.setInterval(() => refresh(), 60_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(priceTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);

  const portfolio = useMemo(() => (wallet ? portfolioService.buildPortfolio(wallet, prices) : null), [wallet, prices]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      await requestJson("/api/auth/sign-in", { method: "POST", body: JSON.stringify({ username, password }) });
      await refresh({ forcePrices: true });
    },
    [refresh, requestJson],
  );

  const createWallet = useCallback(
    async (input: { username: string; password: string; confirmPassword: string; displayName?: string }) => {
      await requestJson("/api/auth/create-wallet", { method: "POST", body: JSON.stringify(input) });
      await refresh({ forcePrices: true });
    },
    [refresh, requestJson],
  );

  const logout = useCallback(async () => {
    await requestJson("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    setSession(null);
    setWallet(null);
    setActivities([]);
    setTransfers([]);
  }, [requestJson]);

  const createTransfer = useCallback(
    async (input: { assetId: string; recipientUsername: string; amount: string; settlementMode?: "immediate" | "scheduled"; durationMinutes?: number }) => {
      const result = await requestJson<{ transfer: { id: string } }>("/api/transfers", { method: "POST", body: JSON.stringify(input) });
      await refresh();
      return result.transfer;
    },
    [refresh, requestJson],
  );

  const getAsset = useCallback((id: string) => wallet?.assets.find((asset) => asset.id === id), [wallet]);
  const getPortfolioAsset = useCallback((id: string) => portfolio?.assets.find((asset) => asset.id === id), [portfolio]);
  const getActivities = useCallback((assetId?: string) => (assetId ? activities.filter((activity) => activity.assetId === assetId) : activities), [activities]);

  const value = useMemo(
    () => ({ session, wallet, portfolio, prices, activities, transfers, loading, refreshing, error, now, refresh, signIn, createWallet, logout, createTransfer, getAsset, getPortfolioAsset, getActivities }),
    [session, wallet, portfolio, prices, activities, transfers, loading, refreshing, error, now, refresh, signIn, createWallet, logout, createTransfer, getAsset, getPortfolioAsset, getActivities],
  );

  return <WalletStoreContext.Provider value={value}>{children}</WalletStoreContext.Provider>;
}

export function useWalletStore() {
  const context = useContext(WalletStoreContext);
  if (!context) throw new Error("useWalletStore must be used inside WalletStoreProvider");
  return context;
}
