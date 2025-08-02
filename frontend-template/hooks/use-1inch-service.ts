"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { SUPPORTED_NETWORKS, Token, SwapQuote, SwapResponse, formatTokenAmount, parseTokenAmount } from '@/lib/networks';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://84.32.100.59:3001";
const BASE_URL = `${API_BASE_URL}/api/1inch`;

interface UseOneInchServiceReturn {
  // Token operations
  getTokens: (chainId: number) => Promise<Record<string, Token>>;
  getTokenBalance: (chainId: number, tokenAddress: string, walletAddress: string) => Promise<string>;

  // Quote operations
  getQuote: (params: {
    chainId: number;
    src: string;
    dst: string;
    amount: string;
  }) => Promise<SwapQuote>;

  // Swap operations
  buildSwap: (params: {
    chainId: number;
    src: string;
    dst: string;
    amount: string;
    from: string;
    slippage: number;
  }) => Promise<SwapResponse>;

  // Cache management
  clearCache: () => void;

  // Loading states
  isLoadingTokens: boolean;
  isLoadingQuote: boolean;
  isLoadingSwap: boolean;
}

export function useOneInchService(): UseOneInchServiceReturn {
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isLoadingSwap, setIsLoadingSwap] = useState(false);

  // Cache for tokens per chain
  const tokensCache = useRef<Map<number, Record<string, Token>>>(new Map());

  // Pending requests to prevent duplicate API calls
  const pendingRequests = useRef<Map<number, Promise<Record<string, Token>>>>(new Map());

      // Helper function to make API calls with retry logic
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}, retryCount = 0, maxRetries = 2) => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (response.status === 429 && retryCount < maxRetries) {
        // Rate limited - wait and retry
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        console.warn(`Rate limited. Retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return apiCall(endpoint, options, retryCount + 1, maxRetries);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Backend API error ${response.status}: ${errorData.message || errorData.error}`);
      }

      return response.json();
    } catch (error: any) {
      if (retryCount < maxRetries && (error.name === 'TypeError' || error.code === 'NETWORK_ERROR')) {
        // Network error - retry
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`Network error. Retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return apiCall(endpoint, options, retryCount + 1, maxRetries);
      }

      throw error;
    }
  }, []);

        // Get tokens for a specific chain
  const getTokens = useCallback(async (chainId: number): Promise<Record<string, Token>> => {
    // Check cache first
    if (tokensCache.current.has(chainId)) {
      return tokensCache.current.get(chainId)!;
    }

    // Check if request is already pending
    if (pendingRequests.current.has(chainId)) {
      return pendingRequests.current.get(chainId)!;
    }

    setIsLoadingTokens(true);

    // Create pending request
    const requestPromise = (async () => {
      try {
        const data = await apiCall(`/tokens/${chainId}`);
        const tokens = data.tokens || {};

        // Cache the result
        tokensCache.current.set(chainId, tokens);

        return tokens;
      } finally {
        // Remove from pending requests
        pendingRequests.current.delete(chainId);
        setIsLoadingTokens(false);
      }
    })();

    // Store pending request
    pendingRequests.current.set(chainId, requestPromise);

    return requestPromise;
  }, [apiCall]);

  // Get token balance using web3 provider
  const getTokenBalance = useCallback(async (
    chainId: number,
    tokenAddress: string,
    walletAddress: string
  ): Promise<string> => {
    try {
      // For native tokens (ETH, MATIC, etc.), use provider.getBalance
      if (tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        // This would require a web3 provider - for now return placeholder
        return "0";
      }

      // For ERC20 tokens, we'd need to call the contract
      // For now, return placeholder
      return "0";
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return "0";
    }
  }, []);

    // Get swap quote
  const getQuote = useCallback(async (params: {
    chainId: number;
    src: string;
    dst: string;
    amount: string;
  }): Promise<SwapQuote> => {
    setIsLoadingQuote(true);
    try {
      const data = await apiCall('/quote', {
        method: 'POST',
        body: JSON.stringify({
          chainId: params.chainId,
          src: params.src,
          dst: params.dst,
          amount: params.amount
        })
      });
      return data.quote;
    } finally {
      setIsLoadingQuote(false);
    }
  }, [apiCall]);

    // Build swap transaction
  const buildSwap = useCallback(async (params: {
    chainId: number;
    src: string;
    dst: string;
    amount: string;
    from: string;
    slippage: number;
  }): Promise<SwapResponse> => {
    setIsLoadingSwap(true);
    try {
      const data = await apiCall('/swap', {
        method: 'POST',
        body: JSON.stringify({
          chainId: params.chainId,
          src: params.src,
          dst: params.dst,
          amount: params.amount,
          from: params.from,
          slippage: params.slippage
        })
      });
      return data.swap;
    } finally {
      setIsLoadingSwap(false);
    }
  }, [apiCall]);

  // Clear all caches
  const clearCache = useCallback(() => {
    tokensCache.current.clear();
  }, []);

  return {
    getTokens,
    getTokenBalance,
    getQuote,
    buildSwap,
    clearCache,
    isLoadingTokens,
    isLoadingQuote,
    isLoadingSwap
  };
}