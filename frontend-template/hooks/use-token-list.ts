"use client";

import { useState, useEffect, useCallback } from "react";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

/**
 * Hook for fetching token lists
 * Based on 1inch Limit Order Protocol documentation
 */

export function useTokenList(chainId: number) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common tokens for different networks
  const getCommonTokens = useCallback((chainId: number): Token[] => {
    const commonTokens: { [key: number]: Token[] } = {
      1: [ // Ethereum Mainnet
        {
          address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          chainId: 1
        },
        {
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          chainId: 1
        },
        {
          address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: 18,
          chainId: 1
        },
        {
          address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
          symbol: "WBTC",
          name: "Wrapped Bitcoin",
          decimals: 8,
          chainId: 1
        }
      ],
      42161: [ // Arbitrum One
        {
          address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          chainId: 42161
        },
        {
          address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          chainId: 42161
        },
        {
          address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: 18,
          chainId: 42161
        },
        {
          address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
          symbol: "ARB",
          name: "Arbitrum",
          decimals: 18,
          chainId: 42161
        }
      ],
      10: [ // Optimism
        {
          address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          chainId: 10
        },
        {
          address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          chainId: 10
        },
        {
          address: "0x4200000000000000000000000000000000000006",
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: 18,
          chainId: 10
        }
      ],
      137: [ // Polygon
        {
          address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          chainId: 137
        },
        {
          address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
          symbol: "USDT",
          name: "Tether USD",
          decimals: 6,
          chainId: 137
        },
        {
          address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
          symbol: "WMATIC",
          name: "Wrapped MATIC",
          decimals: 18,
          chainId: 137
        }
      ],
      8453: [ // Base
        {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          chainId: 8453
        },
        {
          address: "0x4200000000000000000000000000000000000006",
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: 18,
          chainId: 8453
        }
      ]
    };

    return commonTokens[chainId] || [];
  }, []);

  // Fetch tokens for a specific chain
  const fetchTokens = useCallback(async (chainId: number) => {
    try {
      setIsLoading(true);
      setError(null);

      // For now, use common tokens. In production, you would fetch from 1inch API
      const commonTokens = getCommonTokens(chainId);
      setTokens(commonTokens);

      // TODO: Implement actual 1inch token list API call
      // const response = await axios.get(`https://api.1inch.dev/token/v1.2/${chainId}`);
      // if (response.data.success) {
      //   setTokens(response.data.tokens);
      // }

    } catch (err: any) {
      setError(err.message || "Failed to fetch tokens");
      console.error("Error fetching tokens:", err);

      // Fallback to common tokens
      const commonTokens = getCommonTokens(chainId);
      setTokens(commonTokens);
    } finally {
      setIsLoading(false);
    }
  }, [getCommonTokens]);

  // Search tokens by symbol or name
  const searchTokens = useCallback((query: string) => {
    if (!query) return tokens;

    const lowercaseQuery = query.toLowerCase();
    return tokens.filter(token =>
      token.symbol.toLowerCase().includes(lowercaseQuery) ||
      token.name.toLowerCase().includes(lowercaseQuery)
    );
  }, [tokens]);

  // Get token by address
  const getTokenByAddress = useCallback((address: string) => {
    return tokens.find(token => token.address.toLowerCase() === address.toLowerCase());
  }, [tokens]);

  // Get token by symbol
  const getTokenBySymbol = useCallback((symbol: string) => {
    return tokens.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
  }, [tokens]);

  // Fetch tokens when chainId changes
  useEffect(() => {
    if (chainId) {
      fetchTokens(chainId);
    }
  }, [chainId, fetchTokens]);

  return {
    // State
    tokens,
    isLoading,
    error,

    // Actions
    fetchTokens,
    searchTokens,
    getTokenByAddress,
    getTokenBySymbol
  };
}