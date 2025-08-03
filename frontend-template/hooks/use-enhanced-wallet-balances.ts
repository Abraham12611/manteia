"use client";

import { useState, useEffect, useCallback } from 'react';
import { Alchemy, Network, TokenBalanceType } from 'alchemy-sdk';
import { useManteiaWallet } from '@/providers/manteia-wallet-provider';

// 1inch Balance API interface based on official documentation
interface OneInchBalanceRequest {
  addresses: string[];
  chainId: number;
}

interface OneInchTokenBalance {
  tokenAddress: string;
  balance: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logo?: string;
}

interface OneInchBalanceResponse {
  success: boolean;
  data?: {
    [address: string]: OneInchTokenBalance[];
  };
  error?: string;
}

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
  logo?: string;
  source: '1inch' | 'alchemy' | 'native';
}

interface ChainBalance {
  loading: boolean;
  error: string | null;
  native: TokenBalance | null;
  tokens: TokenBalance[];
  lastUpdated: number;
}

interface EnhancedWalletBalances {
  ethereum: ChainBalance;
  sui: ChainBalance;
}

interface UseEnhancedWalletBalancesReturn {
  balances: EnhancedWalletBalances;
  refreshBalances: () => Promise<void>;
  isLoading: boolean;
  hasErrors: boolean;
}

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const ONEINCH_API_KEY = process.env.NEXT_PUBLIC_1INCH_API_KEY;

// 1inch Balance API endpoints
const ONEINCH_BASE_URL = 'https://api.1inch.dev';
const BALANCE_ENDPOINTS = {
  ethereum: `${ONEINCH_BASE_URL}/balance/v1.2/1/balances`,
  polygon: `${ONEINCH_BASE_URL}/balance/v1.2/137/balances`,
  arbitrum: `${ONEINCH_BASE_URL}/balance/v1.2/42161/balances`,
};

export function useEnhancedWalletBalances(): UseEnhancedWalletBalancesReturn {
  const { ethereum } = useManteiaWallet();

  const [balances, setBalances] = useState<EnhancedWalletBalances>({
    ethereum: {
      loading: false,
      error: null,
      native: null,
      tokens: [],
      lastUpdated: 0
    },
    sui: {
      loading: false,
      error: null,
      native: null,
      tokens: [],
      lastUpdated: 0
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  // Initialize Alchemy SDK
  const alchemyConfig = {
    apiKey: ALCHEMY_API_KEY,
    network: Network.ETH_SEPOLIA, // Using Sepolia testnet
  };

  const alchemy = new Alchemy(alchemyConfig);

  // 1inch Balance API call
  const fetchOneInchBalances = useCallback(async (
    walletAddress: string,
    chainId: number = 1
  ): Promise<OneInchTokenBalance[]> => {
    if (!ONEINCH_API_KEY) {
      console.warn('1inch API key not configured');
      return [];
    }

    try {
      const endpoint = chainId === 1 ? BALANCE_ENDPOINTS.ethereum :
                     chainId === 137 ? BALANCE_ENDPOINTS.polygon :
                     chainId === 42161 ? BALANCE_ENDPOINTS.arbitrum :
                     BALANCE_ENDPOINTS.ethereum;

      const response = await fetch(`${endpoint}/${walletAddress}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ONEINCH_API_KEY}`,
          'accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`1inch API error: ${response.status}`);
      }

      const data = await response.json();

      // 1inch Balance API returns token balances directly
      if (data && Array.isArray(data)) {
        return data;
      }

      return [];
    } catch (error) {
      console.error('Error fetching 1inch balances:', error);
      return [];
    }
  }, []);

  // Alchemy SDK balance fetching
  const fetchAlchemyBalances = useCallback(async (
    walletAddress: string
  ): Promise<{ native: TokenBalance | null; tokens: TokenBalance[] }> => {
    if (!ALCHEMY_API_KEY) {
      console.warn('Alchemy API key not configured');
      return { native: null, tokens: [] };
    }

    try {
      // Get native ETH balance
      const ethBalance = await alchemy.core.getBalance(walletAddress);
      const ethBalanceFormatted = parseFloat(ethBalance.toString()) / Math.pow(10, 18);

      const nativeToken: TokenBalance = {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        balance: ethBalance.toString(),
        formattedBalance: ethBalanceFormatted.toFixed(6),
        source: 'native'
      };

      // Get ERC-20 token balances
      const tokenBalances = await alchemy.core.getTokenBalances(walletAddress, {
        type: TokenBalanceType.ERC20
      });

      const tokens: TokenBalance[] = [];

      for (const tokenBalance of tokenBalances.tokenBalances) {
        if (tokenBalance.tokenBalance && tokenBalance.tokenBalance !== '0x0') {
          try {
            // Get token metadata
            const metadata = await alchemy.core.getTokenMetadata(tokenBalance.contractAddress);

            if (metadata && metadata.decimals) {
              const balance = parseInt(tokenBalance.tokenBalance, 16);
              const formattedBalance = balance / Math.pow(10, metadata.decimals);

              if (formattedBalance > 0) {
                tokens.push({
                  address: tokenBalance.contractAddress,
                  symbol: metadata.symbol || 'UNKNOWN',
                  name: metadata.name || 'Unknown Token',
                  decimals: metadata.decimals,
                  balance: balance.toString(),
                  formattedBalance: formattedBalance.toFixed(6),
                  logo: metadata.logo,
                  source: 'alchemy'
                });
              }
            }
          } catch (error) {
            console.error(`Error getting metadata for ${tokenBalance.contractAddress}:`, error);
          }
        }
      }

      return { native: nativeToken, tokens };
    } catch (error) {
      console.error('Error fetching Alchemy balances:', error);
      return { native: null, tokens: [] };
    }
  }, [alchemy]);

  // Format balance helper
  const formatBalance = useCallback((balance: string, decimals: number): string => {
    try {
      const balanceNum = parseFloat(balance) / Math.pow(10, decimals);
      return balanceNum.toFixed(6);
    } catch {
      return '0.000000';
    }
  }, []);

  // Merge balances from different sources
  const mergeBalances = useCallback((
    alchemyTokens: TokenBalance[],
    oneInchTokens: OneInchTokenBalance[]
  ): TokenBalance[] => {
    const mergedMap = new Map<string, TokenBalance>();

    // Add Alchemy tokens
    alchemyTokens.forEach(token => {
      mergedMap.set(token.address.toLowerCase(), token);
    });

    // Add/update with 1inch tokens
    oneInchTokens.forEach(oneInchToken => {
      const address = oneInchToken.tokenAddress.toLowerCase();
      const existing = mergedMap.get(address);

      if (existing) {
        // Update with 1inch data if available
        mergedMap.set(address, {
          ...existing,
          symbol: oneInchToken.symbol || existing.symbol,
          name: oneInchToken.name || existing.name,
          decimals: oneInchToken.decimals || existing.decimals,
          logo: oneInchToken.logo || existing.logo,
          source: '1inch'
        });
      } else if (oneInchToken.balance && oneInchToken.balance !== '0') {
        // Add new token from 1inch
        const decimals = oneInchToken.decimals || 18;
        const formattedBalance = formatBalance(oneInchToken.balance, decimals);

        if (parseFloat(formattedBalance) > 0) {
          mergedMap.set(address, {
            address: oneInchToken.tokenAddress,
            symbol: oneInchToken.symbol || 'UNKNOWN',
            name: oneInchToken.name || 'Unknown Token',
            decimals,
            balance: oneInchToken.balance,
            formattedBalance,
            logo: oneInchToken.logo,
            source: '1inch'
          });
        }
      }
    });

    return Array.from(mergedMap.values()).sort((a, b) =>
      parseFloat(b.formattedBalance) - parseFloat(a.formattedBalance)
    );
  }, [formatBalance]);

  // Refresh balances function
  const refreshBalances = useCallback(async () => {
    if (!ethereum.wallet.isConnected || !ethereum.wallet.address) {
      setBalances({
        ethereum: { loading: false, error: null, native: null, tokens: [], lastUpdated: 0 },
        sui: { loading: false, error: null, native: null, tokens: [], lastUpdated: 0 }
      });
      return;
    }

    setIsLoading(true);

    // Update Ethereum balances
    setBalances(prev => ({
      ...prev,
      ethereum: { ...prev.ethereum, loading: true, error: null }
    }));

    try {
      const [alchemyData, oneInchTokens] = await Promise.all([
        fetchAlchemyBalances(ethereum.wallet.address),
        fetchOneInchBalances(ethereum.wallet.address, 11155111) // Sepolia chain ID
      ]);

      const mergedTokens = mergeBalances(alchemyData.tokens, oneInchTokens);

      setBalances(prev => ({
        ...prev,
        ethereum: {
          loading: false,
          error: null,
          native: alchemyData.native,
          tokens: mergedTokens,
          lastUpdated: Date.now()
        }
      }));
    } catch (error: any) {
      setBalances(prev => ({
        ...prev,
        ethereum: {
          ...prev.ethereum,
          loading: false,
          error: error.message || 'Failed to fetch Ethereum balances'
        }
      }));
    }

    // For now, we'll keep Sui balances empty since we don't have Sui integration yet
    setBalances(prev => ({
      ...prev,
      sui: {
        loading: false,
        error: null,
        native: null,
        tokens: [],
        lastUpdated: Date.now()
      }
    }));

    setIsLoading(false);
  }, [ethereum.wallet.isConnected, ethereum.wallet.address, fetchAlchemyBalances, fetchOneInchBalances, mergeBalances]);

  // Auto-refresh when wallet connects
  useEffect(() => {
    if (ethereum.wallet.isConnected && ethereum.wallet.address) {
      refreshBalances();
    } else {
      setBalances({
        ethereum: { loading: false, error: null, native: null, tokens: [], lastUpdated: 0 },
        sui: { loading: false, error: null, native: null, tokens: [], lastUpdated: 0 }
      });
    }
  }, [ethereum.wallet.isConnected, ethereum.wallet.address, refreshBalances]);

  const hasErrors = balances.ethereum.error || balances.sui.error;

  return {
    balances,
    refreshBalances,
    isLoading,
    hasErrors: !!hasErrors
  };
}