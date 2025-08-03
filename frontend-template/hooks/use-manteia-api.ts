"use client";

import { useState, useCallback } from "react";

/**
 * Hook for Manteia Backend API Integration
 * Connects to the backend server running on localhost:3001
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

interface SwapQuoteRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  fromChain: string;
  toChain: string;
  slippage?: number;
}

interface SwapQuoteResponse {
  quote: {
    fromAmount: string;
    toAmount: string;
    estimatedGas: string;
    priceImpact: string;
    route: any[];
  };
  order: {
    orderId: string;
    expiresAt: number;
  };
}

interface HealthResponse {
  status: string;
  timestamp: number;
  services: {
    sui: boolean;
    ethereum: boolean;
    oneInch: boolean;
  };
}

export function useManteiaApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic API call function
  const apiCall = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }, []);

  // Health check
  const checkHealth = useCallback(async (): Promise<ApiResponse<HealthResponse>> => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiCall<HealthResponse>("/health");

      return { data, error: null, loading: false };
    } catch (err: any) {
      const error = err.message || "Health check failed";
      setError(error);
      return { data: null, error, loading: false };
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Get swap quote
  const getSwapQuote = useCallback(async (
    request: SwapQuoteRequest
  ): Promise<ApiResponse<SwapQuoteResponse>> => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiCall<SwapQuoteResponse>("/swap/quote", {
        method: "POST",
        body: JSON.stringify(request),
      });

      return { data, error: null, loading: false };
    } catch (err: any) {
      const error = err.message || "Failed to get swap quote";
      setError(error);
      return { data: null, error, loading: false };
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Execute swap
  const executeSwap = useCallback(async (
    orderId: string,
    signedTx: string
  ): Promise<ApiResponse<{ txHash: string; status: string }>> => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiCall<{ txHash: string; status: string }>("/swap/execute", {
        method: "POST",
        body: JSON.stringify({ orderId, signedTx }),
      });

      return { data, error: null, loading: false };
    } catch (err: any) {
      const error = err.message || "Failed to execute swap";
      setError(error);
      return { data: null, error, loading: false };
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Get swap status
  const getSwapStatus = useCallback(async (
    orderId: string
  ): Promise<ApiResponse<{ status: string; txHash?: string; error?: string }>> => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiCall<{ status: string; txHash?: string; error?: string }>(
        `/swap/status/${orderId}`
      );

      return { data, error: null, loading: false };
    } catch (err: any) {
      const error = err.message || "Failed to get swap status";
      setError(error);
      return { data: null, error, loading: false };
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Register as resolver
  const registerResolver = useCallback(async (
    address: string,
    network: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiCall<{ success: boolean; message: string }>("/resolver/register", {
        method: "POST",
        body: JSON.stringify({ address, network }),
      });

      return { data, error: null, loading: false };
    } catch (err: any) {
      const error = err.message || "Failed to register resolver";
      setError(error);
      return { data: null, error, loading: false };
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  return {
    loading,
    error,
    checkHealth,
    getSwapQuote,
    executeSwap,
    getSwapStatus,
    registerResolver,
  };
}