"use client";

import { useState, useEffect, useCallback } from "react";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { Alchemy, Network } from "alchemy-sdk";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

/**
 * Hook for checking wallet balances on both Ethereum and Sui
 * Based on official Alchemy SDK and Sui SDK documentation
 * @see https://github.com/alchemyplatform/alchemy-sdk-js
 * @see https://github.com/suiet/wallet-kit
 */

interface TokenBalance {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  formattedBalance: string;
  decimals: number;
  logo?: string;
  price?: number;
}

interface WalletBalances {
  ethereum: {
    native: TokenBalance | null;
    tokens: TokenBalance[];
    loading: boolean;
    error: string | null;
  };
  sui: {
    native: TokenBalance | null;
    tokens: TokenBalance[];
    loading: boolean;
    error: string | null;
  };
}

// Initialize Alchemy SDK for Ethereum balance checking
const initAlchemy = () => {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!apiKey) {
    console.warn("Alchemy API key not found. Some features may be limited.");
    return null;
  }

  return new Alchemy({
    apiKey,
    network: Network.ETH_SEPOLIA, // Using Sepolia testnet
  });
};

// Initialize Sui client for balance checking
const initSuiClient = () => {
  return new SuiClient({
    url: getFullnodeUrl("testnet"), // Using testnet
  });
};

export function useWalletBalances() {
  const { sui, ethereum } = useManteiaWallet();
  const [balances, setBalances] = useState<WalletBalances>({
    ethereum: {
      native: null,
      tokens: [],
      loading: false,
      error: null,
    },
    sui: {
      native: null,
      tokens: [],
      loading: false,
      error: null,
    },
  });

  // Format balance for display
  const formatBalance = useCallback((
    balance: string,
    decimals: number,
    symbol: string
  ): string => {
    try {
      const value = parseFloat(balance) / Math.pow(10, decimals);

      if (value === 0) return "0";
      if (value < 0.000001) return "< 0.000001";
      if (value < 1) return value.toFixed(6);
      if (value < 1000) return value.toFixed(4);
      if (value < 1000000) return (value / 1000).toFixed(2) + "K";

      return (value / 1000000).toFixed(2) + "M";
    } catch (error) {
      console.error(`Error formatting balance for ${symbol}:`, error);
      return "0";
    }
  }, []);

  // Fetch Ethereum balances using Alchemy SDK
  const fetchEthereumBalances = useCallback(async () => {
    if (!ethereum.wallet.isConnected || !ethereum.wallet.address) {
      setBalances(prev => ({
        ...prev,
        ethereum: {
          native: null,
          tokens: [],
          loading: false,
          error: null,
        },
      }));
      return;
    }

    const alchemy = initAlchemy();
    if (!alchemy) {
      setBalances(prev => ({
        ...prev,
        ethereum: {
          ...prev.ethereum,
          error: "Alchemy API key not configured",
          loading: false,
        },
      }));
      return;
    }

    setBalances(prev => ({
      ...prev,
      ethereum: { ...prev.ethereum, loading: true, error: null },
    }));

    try {
      const address = ethereum.wallet.address;

      // Fetch native ETH balance using Alchemy SDK
      const ethBalance = await alchemy.core.getBalance(address);

      // Fetch ERC-20 token balances using Alchemy SDK
      const tokenBalances = await alchemy.core.getTokenBalances(address);

      // Format native ETH balance
      const nativeBalance: TokenBalance = {
        symbol: "ETH",
        name: "Ethereum",
        address: "0x0000000000000000000000000000000000000000",
        balance: ethBalance.toString(),
        formattedBalance: formatBalance(ethBalance.toString(), 18, "ETH"),
        decimals: 18,
      };

      // Format token balances
      const formattedTokens: TokenBalance[] = [];

      for (const token of tokenBalances.tokenBalances) {
        if (token.error || !token.tokenBalance || token.tokenBalance === "0x0") {
          continue;
        }

        try {
          // Fetch token metadata using Alchemy SDK
          const metadata = await alchemy.core.getTokenMetadata(token.contractAddress);

          if (metadata && metadata.decimals !== null) {
            const balance = parseInt(token.tokenBalance, 16).toString();

            formattedTokens.push({
              symbol: metadata.symbol || "UNKNOWN",
              name: metadata.name || "Unknown Token",
              address: token.contractAddress,
              balance,
              formattedBalance: formatBalance(balance, metadata.decimals, metadata.symbol || "UNKNOWN"),
              decimals: metadata.decimals,
              logo: metadata.logo,
            });
          }
        } catch (error) {
          console.error(`Error fetching metadata for token ${token.contractAddress}:`, error);
        }
      }

      setBalances(prev => ({
        ...prev,
        ethereum: {
          native: nativeBalance,
          tokens: formattedTokens,
          loading: false,
          error: null,
        },
      }));
    } catch (error: any) {
      console.error("Error fetching Ethereum balances:", error);
      setBalances(prev => ({
        ...prev,
        ethereum: {
          ...prev.ethereum,
          loading: false,
          error: error.message || "Failed to fetch Ethereum balances",
        },
      }));
    }
  }, [ethereum.wallet.isConnected, ethereum.wallet.address, formatBalance]);

  // Fetch Sui balances using Sui SDK
  const fetchSuiBalances = useCallback(async () => {
    if (!sui.connected || !sui.account?.address) {
      setBalances(prev => ({
        ...prev,
        sui: {
          native: null,
          tokens: [],
          loading: false,
          error: null,
        },
      }));
      return;
    }

    setBalances(prev => ({
      ...prev,
      sui: { ...prev.sui, loading: true, error: null },
    }));

    try {
      const suiClient = initSuiClient();
      const address = sui.account.address;

      // Fetch all coin balances for the address
      const coinBalances = await suiClient.getAllBalances({
        owner: address,
      });

      const formattedBalances: TokenBalance[] = [];
      let nativeBalance: TokenBalance | null = null;

      for (const coin of coinBalances) {
        try {
          // Fetch coin metadata
          const coinMetadata = await suiClient.getCoinMetadata({
            coinType: coin.coinType,
          });

          const balance = coin.totalBalance;
          const decimals = coinMetadata?.decimals || 9;
          const symbol = coinMetadata?.symbol || "UNKNOWN";
          const name = coinMetadata?.name || "Unknown Coin";

          const tokenBalance: TokenBalance = {
            symbol,
            name,
            address: coin.coinType,
            balance,
            formattedBalance: formatBalance(balance, decimals, symbol),
            decimals,
            logo: coinMetadata?.iconUrl,
          };

          // Check if this is native SUI
          if (coin.coinType === "0x2::sui::SUI") {
            nativeBalance = tokenBalance;
          } else {
            formattedBalances.push(tokenBalance);
          }
        } catch (error) {
          console.error(`Error fetching metadata for coin ${coin.coinType}:`, error);

          // Add with basic info if metadata fetch fails
          const tokenBalance: TokenBalance = {
            symbol: "UNKNOWN",
            name: "Unknown Coin",
            address: coin.coinType,
            balance: coin.totalBalance,
            formattedBalance: formatBalance(coin.totalBalance, 9, "UNKNOWN"),
            decimals: 9,
          };

          if (coin.coinType === "0x2::sui::SUI") {
            nativeBalance = { ...tokenBalance, symbol: "SUI", name: "Sui" };
          } else {
            formattedBalances.push(tokenBalance);
          }
        }
      }

      setBalances(prev => ({
        ...prev,
        sui: {
          native: nativeBalance,
          tokens: formattedBalances,
          loading: false,
          error: null,
        },
      }));
    } catch (error: any) {
      console.error("Error fetching Sui balances:", error);
      setBalances(prev => ({
        ...prev,
        sui: {
          ...prev.sui,
          loading: false,
          error: error.message || "Failed to fetch Sui balances",
        },
      }));
    }
  }, [sui.connected, sui.account?.address, formatBalance]);

  // Refresh all balances
  const refreshBalances = useCallback(async () => {
    await Promise.all([
      fetchEthereumBalances(),
      fetchSuiBalances(),
    ]);
  }, [fetchEthereumBalances, fetchSuiBalances]);

  // Fetch balances when wallet connections change
  useEffect(() => {
    fetchEthereumBalances();
  }, [fetchEthereumBalances]);

  useEffect(() => {
    fetchSuiBalances();
  }, [fetchSuiBalances]);

  // Auto-refresh balances every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshBalances, 30000);
    return () => clearInterval(interval);
  }, [refreshBalances]);

  return {
    balances,
    refreshBalances,
    isLoading: balances.ethereum.loading || balances.sui.loading,
    hasErrors: Boolean(balances.ethereum.error || balances.sui.error),
  };
}