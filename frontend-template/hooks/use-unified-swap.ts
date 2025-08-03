"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Hook for Unified Cross-Chain Swap System
 * Integrates 1inch, Cetus, and Wormhole for seamless cross-chain swaps
 */

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId?: number;
  isWrapped?: boolean;
  originalToken?: string;
}

interface ChainInfo {
  id: string;
  name: string;
  logoUrl: string;
  isEVM: boolean;
}

interface SwapStep {
  type: 'bridge' | 'swap';
  chain: string;
  description: string;
  estimatedFee: string;
  estimatedTime: string;
}

interface UnifiedQuote {
  success: boolean;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  bridgeFee?: string;
  swapFee?: string;
  totalFee: string;
  estimatedTime: string;
  route: 'direct' | 'bridge-swap' | 'swap-bridge';
  priceImpact: number;
  steps: SwapStep[];
  error?: string;
}

interface QuoteParams {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number;
}

export function useUnifiedSwap() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<UnifiedQuote | null>(null);
  const [supportedChains, setSupportedChains] = useState<ChainInfo[]>([]);
  const [tokensByChain, setTokensByChain] = useState<Record<string, TokenInfo[]>>({});
  const [popularTokensByChain, setPopularTokensByChain] = useState<Record<string, TokenInfo[]>>({});

  // Ref to track if component is mounted
  const isMountedRef = useRef(false);

  // API base URL
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://84.32.100.59:3001';

  // Initialize on mount
  useEffect(() => {
    isMountedRef.current = true;
    loadSupportedChains();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Load supported chains
   */
  const loadSupportedChains = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/unified-swap/chains`);
      const data = await response.json();

      if (data.success && isMountedRef.current) {
        setSupportedChains(data.chains);
      }
    } catch (error) {
      console.error('Failed to load supported chains:', error);
    }
  }, [API_BASE]);

  /**
   * Load tokens for a specific chain
   */
  const loadTokens = useCallback(async (chain: string) => {
    try {
      // Check if we already have tokens for this chain
      if (tokensByChain[chain]) {
        return tokensByChain[chain];
      }

      const response = await fetch(`${API_BASE}/api/unified-swap/tokens/${chain}`);
      const data = await response.json();

      if (data.success && isMountedRef.current) {
        setTokensByChain(prev => ({
          ...prev,
          [chain]: data.tokens
        }));
        return data.tokens;
      }

      return [];
    } catch (error) {
      console.error(`Failed to load tokens for ${chain}:`, error);
      return [];
    }
  }, [API_BASE, tokensByChain]);

  /**
   * Load popular tokens for a specific chain
   */
  const loadPopularTokens = useCallback(async (chain: string) => {
    try {
      // Check if we already have popular tokens for this chain
      if (popularTokensByChain[chain]) {
        return popularTokensByChain[chain];
      }

      const response = await fetch(`${API_BASE}/api/unified-swap/tokens/${chain}/popular`);
      const data = await response.json();

      if (data.success && isMountedRef.current) {
        setPopularTokensByChain(prev => ({
          ...prev,
          [chain]: data.tokens
        }));
        return data.tokens;
      }

      return [];
    } catch (error) {
      console.error(`Failed to load popular tokens for ${chain}:`, error);
      return [];
    }
  }, [API_BASE, popularTokensByChain]);

  /**
   * Search tokens by symbol or name
   */
  const searchTokens = useCallback(async (chain: string, query: string) => {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      const response = await fetch(`${API_BASE}/api/unified-swap/tokens/${chain}/search?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success) {
        return data.tokens;
      }

      return [];
    } catch (error) {
      console.error(`Failed to search tokens for ${chain}:`, error);
      return [];
    }
  }, [API_BASE]);

  /**
   * Get quote for swap
   */
  const getQuote = useCallback(async (params: QuoteParams) => {
    try {
      setIsLoading(true);
      setError(null);
      setQuote(null);

      const response = await fetch(`${API_BASE}/api/unified-swap/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromChain: params.fromChain,
          toChain: params.toChain,
          fromToken: params.fromToken,
          toToken: params.toToken,
          amount: params.amount,
          slippage: params.slippage || 0.5
        })
      });

      const data = await response.json();

      if (data.success && isMountedRef.current) {
        setQuote(data.quote);
        return data.quote;
      } else {
        const errorMessage = data.message || 'Failed to get quote';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Network error';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [API_BASE]);

  /**
   * Check if cross-chain swap is supported
   */
  const isCrossChainSupported = useCallback(async (fromChain: string, toChain: string, token: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/unified-swap/supported?fromChain=${fromChain}&toChain=${toChain}&token=${token}`);
      const data = await response.json();

      return data.success ? data.isSupported : false;
    } catch (error) {
      console.error('Failed to check cross-chain support:', error);
      return false;
    }
  }, [API_BASE]);

  /**
   * Get token by symbol
   */
  const getTokenBySymbol = useCallback((chain: string, symbol: string) => {
    const tokens = tokensByChain[chain] || [];
    return tokens.find(token => token.symbol.toLowerCase() === symbol.toLowerCase()) || null;
  }, [tokensByChain]);

  /**
   * Get token by address
   */
  const getTokenByAddress = useCallback((chain: string, address: string) => {
    const tokens = tokensByChain[chain] || [];
    return tokens.find(token => token.address.toLowerCase() === address.toLowerCase()) || null;
  }, [tokensByChain]);

  /**
   * Format token amount based on decimals
   */
  const formatTokenAmount = useCallback((amount: string, decimals: number) => {
    try {
      const bigIntAmount = BigInt(amount);
      const divisor = BigInt(10 ** decimals);
      const whole = bigIntAmount / divisor;
      const fraction = bigIntAmount % divisor;

      if (fraction === 0n) {
        return whole.toString();
      }

      const fractionStr = fraction.toString().padStart(decimals, '0');
      const trimmedFraction = fractionStr.replace(/0+$/, '');

      return `${whole}.${trimmedFraction}`;
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return amount;
    }
  }, []);

  /**
   * Parse token amount to smallest unit
   */
  const parseTokenAmount = useCallback((amount: string, decimals: number) => {
    try {
      const [whole, fraction = ''] = amount.split('.');
      const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
      return `${whole}${paddedFraction}`;
    } catch (error) {
      console.error('Error parsing token amount:', error);
      return amount;
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear quote
   */
  const clearQuote = useCallback(() => {
    setQuote(null);
  }, []);

  /**
   * Check if swap is cross-chain
   */
  const isCrossChain = useCallback((fromChain: string, toChain: string) => {
    return fromChain !== toChain;
  }, []);

  /**
   * Get estimated time for swap
   */
  const getEstimatedTime = useCallback((quote: UnifiedQuote) => {
    if (!quote) return 'Unknown';

    if (quote.route === 'direct') {
      return quote.estimatedTime;
    }

    // For cross-chain swaps, sum up the times
    const totalMinutes = quote.steps.reduce((total, step) => {
      const timeStr = step.estimatedTime;
      const minutes = parseInt(timeStr.match(/(\d+)/)?.[1] || '0');
      return total + minutes;
    }, 0);

    return `${totalMinutes} minutes`;
  }, []);

  /**
   * Get total fee for swap
   */
  const getTotalFee = useCallback((quote: UnifiedQuote) => {
    if (!quote) return '0';

    if (quote.route === 'direct') {
      return quote.totalFee;
    }

    // For cross-chain swaps, sum up the fees
    const totalFee = quote.steps.reduce((total, step) => {
      const fee = parseFloat(step.estimatedFee) || 0;
      return total + fee;
    }, 0);

    return totalFee.toString();
  }, []);

  return {
    // State
    isLoading,
    error,
    quote,
    supportedChains,
    tokensByChain,
    popularTokensByChain,

    // Actions
    loadTokens,
    loadPopularTokens,
    searchTokens,
    getQuote,
    isCrossChainSupported,
    getTokenBySymbol,
    getTokenByAddress,
    formatTokenAmount,
    parseTokenAmount,
    clearError,
    clearQuote,
    isCrossChain,
    getEstimatedTime,
    getTotalFee,

    // Computed values
    hasQuote: !!quote && quote.success,
    isCrossChainSwap: quote ? isCrossChain(quote.fromChain, quote.toChain) : false
  };
}