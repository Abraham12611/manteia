"use client";

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS, Token, formatTokenAmount } from '@/lib/networks';
import { useManteiaWallet } from '@/providers/manteia-wallet-provider';
import { useOneInchService } from '@/hooks/use-1inch-service';

interface TokenBalance {
  token: Token;
  balance: string;
  formattedBalance: string;
  usdValue?: string;
}

interface NetworkBalance {
  network: typeof SUPPORTED_NETWORKS[keyof typeof SUPPORTED_NETWORKS];
  nativeBalance: TokenBalance | null;
  tokenBalances: TokenBalance[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

interface UseMultiNetworkBalancesReturn {
  balances: Record<string, NetworkBalance>; // networkKey -> NetworkBalance
  isLoading: boolean;
  error: string | null;
  refreshBalances: (networkKey?: string) => Promise<void>;
  refreshAllBalances: () => Promise<void>;
  getNetworkBalance: (networkKey: string) => NetworkBalance | null;
  getTotalPortfolioValue: () => string;
}

export function useMultiNetworkBalances(): UseMultiNetworkBalancesReturn {
  const { ethereum } = useManteiaWallet();
  const oneInchService = useOneInchService();

  const [balances, setBalances] = useState<Record<string, NetworkBalance>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ERC20 ABI for balance checking
  const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
  ];

  // Get provider for specific network
  const getProvider = useCallback((networkKey: string) => {
    const network = SUPPORTED_NETWORKS[networkKey];
    if (!network) return null;

    return new ethers.JsonRpcProvider(network.rpcUrl);
  }, []);

  // Get native token balance
  const getNativeBalance = useCallback(async (
    networkKey: string,
    walletAddress: string
  ): Promise<TokenBalance | null> => {
    try {
      const network = SUPPORTED_NETWORKS[networkKey];
      if (!network) return null;

      const provider = getProvider(networkKey);
      if (!provider) return null;

      const balance = await provider.getBalance(walletAddress);
      const balanceStr = balance.toString();
      const formattedBalance = formatTokenAmount(balanceStr, network.nativeToken.decimals);

      return {
        token: {
          address: network.nativeToken.address,
          symbol: network.nativeToken.symbol,
          name: network.nativeToken.name,
          decimals: network.nativeToken.decimals,
          logoURI: network.logoUrl
        },
        balance: balanceStr,
        formattedBalance
      };
    } catch (error) {
      console.error(`Failed to get native balance for ${networkKey}:`, error);
      return null;
    }
  }, [getProvider]);

    // Get ERC20 token balances
  const getTokenBalances = useCallback(async (
    networkKey: string,
    walletAddress: string,
    tokens: Token[]
  ): Promise<TokenBalance[]> => {
    try {
      const provider = getProvider(networkKey);
      if (!provider) return [];

      const balances: TokenBalance[] = [];

      // Check balances for each token (limit to popular ones to avoid too many RPC calls)
      const tokensToCheck = tokens.slice(0, 3); // Top 3 tokens only

      for (const token of tokensToCheck) {
        try {
          // Skip native token (already handled)
          if (token.address.toLowerCase() === SUPPORTED_NETWORKS[networkKey].nativeToken.address.toLowerCase()) {
            continue;
          }

          // Ensure address is properly checksummed
          const checksummedAddress = ethers.getAddress(token.address);
          const checksummedWalletAddress = ethers.getAddress(walletAddress);

          const contract = new ethers.Contract(checksummedAddress, ERC20_ABI, provider);
          const balance = await contract.balanceOf(checksummedWalletAddress);
          const balanceStr = balance.toString();

          // Only include tokens with non-zero balance
          if (balanceStr !== '0') {
            const formattedBalance = formatTokenAmount(balanceStr, token.decimals);
            balances.push({
              token: {
                ...token,
                address: checksummedAddress // Use checksummed address
              },
              balance: balanceStr,
              formattedBalance
            });
          }
        } catch (error) {
          // Skip tokens that fail (might be invalid contracts or addresses)
          console.warn(`Failed to get balance for token ${token.symbol} on ${networkKey}:`, error);
        }
      }

      return balances;
    } catch (error) {
      console.error(`Failed to get token balances for ${networkKey}:`, error);
      return [];
    }
  }, [getProvider]);

  // Refresh balances for a specific network
  const refreshBalances = useCallback(async (networkKey?: string) => {
    if (!ethereum.wallet.isConnected || !ethereum.wallet.address) {
      return;
    }

    const networksToUpdate = networkKey ? [networkKey] : Object.keys(SUPPORTED_NETWORKS);

    setError(null);

    for (const netKey of networksToUpdate) {
      // Set loading state for this network
      setBalances(prev => ({
        ...prev,
        [netKey]: {
          network: SUPPORTED_NETWORKS[netKey],
          nativeBalance: null,
          tokenBalances: [],
          isLoading: true,
          error: null,
          lastUpdated: 0,
          ...prev[netKey]
        }
      }));

      try {
        const network = SUPPORTED_NETWORKS[netKey];

        // Get available tokens for this network (only check a few popular ones to reduce API calls)
        const allTokens = await oneInchService.getTokens(network.chainId);
        const popularTokens = Object.values(allTokens).filter(token =>
          ['USDC', 'USDT', 'WBTC'].includes(token.symbol) // Reduced to top 3 most common
        ).slice(0, 3);

        // Get native balance
        const nativeBalance = await getNativeBalance(netKey, ethereum.wallet.address);

        // Get token balances
        const tokenBalances = await getTokenBalances(netKey, ethereum.wallet.address, popularTokens);

        // Update state
        setBalances(prev => ({
          ...prev,
          [netKey]: {
            network,
            nativeBalance,
            tokenBalances: tokenBalances || [],
            isLoading: false,
            error: null,
            lastUpdated: Date.now()
          }
        }));

      } catch (err: any) {
        setBalances(prev => ({
          ...prev,
          [netKey]: {
            network: SUPPORTED_NETWORKS[netKey],
            nativeBalance: null,
            tokenBalances: [],
            isLoading: false,
            error: err.message || `Failed to fetch balances for ${netKey}`,
            lastUpdated: Date.now()
          }
        }));
      }
    }
  }, [ethereum.wallet.isConnected, ethereum.wallet.address, oneInchService, getNativeBalance, getTokenBalances]);

  // Refresh all balances
  const refreshAllBalances = useCallback(async () => {
    setIsLoading(true);
    await refreshBalances();
    setIsLoading(false);
  }, [refreshBalances]);

  // Get balance for specific network
  const getNetworkBalance = useCallback((networkKey: string): NetworkBalance | null => {
    return balances[networkKey] || null;
  }, [balances]);

  // Calculate total portfolio value (placeholder)
  const getTotalPortfolioValue = useCallback((): string => {
    // In a real implementation, this would calculate USD values
    // For now, just return a placeholder
    return "0.00";
  }, []);

  // Auto-refresh when wallet connects
  useEffect(() => {
    if (ethereum.wallet.isConnected && ethereum.wallet.address) {
      refreshAllBalances();
    } else {
      setBalances({});
    }
  }, [ethereum.wallet.isConnected, ethereum.wallet.address]);

  // Check if any network is loading
  const isAnyNetworkLoading = Object.values(balances).some(balance => balance.isLoading);

  return {
    balances,
    isLoading: isAnyNetworkLoading || isLoading,
    error,
    refreshBalances,
    refreshAllBalances,
    getNetworkBalance,
    getTotalPortfolioValue
  };
}