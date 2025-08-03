"use client";

import { useState, useCallback } from "react";

/**
 * Hook for 1inch API Integration
 * Based on official 1inch documentation and APIs
 * Includes Fusion+, Aggregation, and Limit Order Protocol
 * @see https://portal.1inch.dev/documentation
 */

interface OneInchQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  protocols: any[];
  estimatedGas: string;
}

interface OneInchSwap extends OneInchQuote {
  tx: {
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  };
}

interface CrossChainQuote {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  estimatedExecutionTime: number;
  bridgeFee: string;
  gasFee: string;
  priceImpact: number;
}

interface FusionOrder {
  orderHash: string;
  status: "pending" | "filled" | "expired" | "cancelled";
  fromAmount: string;
  toAmount: string;
  executionTime?: number;
  resolverAddress?: string;
}

interface LimitOrder {
  orderHash: string;
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makerAmount: string;
  takerAmount: string;
  expires: number;
  status: "active" | "filled" | "cancelled" | "expired";
}

export function useOneInchIntegration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get quote for token swap on single chain
  const getQuote = useCallback(async (
    chainId: number,
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<OneInchQuote | null> => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would call 1inch API
      // const response = await fetch(
      //   `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${fromToken}&dst=${toToken}&amount=${amount}&includeProtocols=true`,
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ONEINCH_API_KEY}`
      //     }
      //   }
      // );
      // const data = await response.json();

      // Mock response for development
      const mockQuote: OneInchQuote = {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: (parseFloat(amount) * 0.95).toString(), // Mock 5% spread
        protocols: [
          { name: "UNISWAP_V3", part: 50 },
          { name: "SUSHI", part: 30 },
          { name: "CURVE", part: 20 }
        ],
        estimatedGas: "150000"
      };

      return mockQuote;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to get quote";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get cross-chain quote using real 1inch Fusion+ API
  const getCrossChainQuote = useCallback(async (
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<CrossChainQuote | null> => {
    try {
      setLoading(true);
      setError(null);

      const apiKey = process.env.NEXT_PUBLIC_ONEINCH_API_KEY;
      if (!apiKey) {
        throw new Error("1inch API key not configured");
      }

      // Map chain names to chain IDs
      const chainIdMap: Record<string, number> = {
        ethereum: 1,
        sepolia: 11155111,
        sui: 0, // Custom chain ID for Sui
      };

      const fromChainId = chainIdMap[fromChain.toLowerCase()];
      const toChainId = chainIdMap[toChain.toLowerCase()];

      if (fromChainId === undefined || toChainId === undefined) {
        throw new Error("Unsupported chain");
      }

      // For Sui integration, we'll handle it differently since it's not natively supported
      if (fromChain.toLowerCase() === 'sui' || toChain.toLowerCase() === 'sui') {
        // Mock response for Sui cross-chain swaps until native support
        const mockQuote: CrossChainQuote = {
          fromChain,
          toChain,
          fromToken,
          toToken,
          fromAmount: amount,
          toAmount: (parseFloat(amount) * 0.92).toString(),
          estimatedExecutionTime: 300,
          bridgeFee: "0.005",
          gasFee: "0.01",
          priceImpact: 1.5
        };

        return mockQuote;
      }

      // Real 1inch Fusion+ API call for EVM-to-EVM
      const response = await fetch(
        `https://api.1inch.dev/fusion-plus/quoter/v1.0/quote/receive-calls`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            srcChainId: fromChainId,
            dstChainId: toChainId,
            srcTokenAddress: fromToken,
            dstTokenAddress: toToken,
            amount: amount,
          })
        }
      );

      if (!response.ok) {
        throw new Error(`1inch Fusion+ API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: data.dstTokenAmount || (parseFloat(amount) * 0.92).toString(),
        estimatedExecutionTime: data.estimatedTime || 300,
        bridgeFee: data.bridgeFee || "0.005",
        gasFee: data.gasFee || "0.01",
        priceImpact: data.priceImpact || 1.5
      };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to get cross-chain quote";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create Fusion+ order for cross-chain swap
  const createFusionOrder = useCallback(async (
    fromChain: string,
    toChain: string,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    toAmount: string,
    secretHash: string,
    expiryTime: number
  ): Promise<FusionOrder | null> => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would use 1inch Fusion SDK
      // const fusionSDK = new FusionSDK({
      //   apiKey: process.env.NEXT_PUBLIC_ONEINCH_API_KEY,
      //   chains: [fromChain, toChain]
      // });
      // const order = await fusionSDK.createOrder({
      //   fromChain,
      //   toChain,
      //   fromToken,
      //   toToken,
      //   fromAmount,
      //   toAmount,
      //   secretHash,
      //   expiryTime
      // });

      // Mock Fusion order creation
      const mockOrder: FusionOrder = {
        orderHash: `0x${Math.random().toString(16).slice(2, 66)}`,
        status: "pending",
        fromAmount,
        toAmount
      };

      return mockOrder;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create Fusion order";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get Fusion order status
  const getFusionOrderStatus = useCallback(async (
    orderHash: string
  ): Promise<FusionOrder | null> => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would call 1inch API
      // const response = await fetch(
      //   `https://api.1inch.dev/fusion/v1.0/orders/${orderHash}`,
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ONEINCH_API_KEY}`
      //     }
      //   }
      // );
      // const data = await response.json();

      // Mock order status
      const mockOrder: FusionOrder = {
        orderHash,
        status: "filled",
        fromAmount: "1000000000000000000", // 1 ETH
        toAmount: "900000000", // 900 SUI
        executionTime: Date.now() - 300000, // 5 minutes ago
        resolverAddress: "0x742d35Cc6634C0532925a3b8D4C7C4E5ebc7"
      };

      return mockOrder;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to get order status";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Submit secret to complete cross-chain swap
  const submitSecret = useCallback(async (
    orderHash: string,
    secret: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would call 1inch API
      // const response = await fetch(
      //   `https://api.1inch.dev/fusion/v1.0/orders/${orderHash}/secret`,
      //   {
      //     method: 'POST',
      //     headers: {
      //       'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ONEINCH_API_KEY}`,
      //       'Content-Type': 'application/json'
      //     },
      //     body: JSON.stringify({ secret })
      //   }
      // );

      // Mock secret submission
      return true;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to submit secret";
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create limit order using LOP
  const createLimitOrder = useCallback(async (
    makerAsset: string,
    takerAsset: string,
    makerAmount: string,
    takerAmount: string,
    expires: number,
    signature: string
  ): Promise<LimitOrder | null> => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would use 1inch LOP SDK
      // const lopSDK = new LimitOrderProtocolSDK({
      //   contractAddress: '0x...', // LOP contract address
      //   provider: provider
      // });
      // const order = await lopSDK.createLimitOrder({
      //   makerAsset,
      //   takerAsset,
      //   makerAmount,
      //   takerAmount,
      //   expires,
      //   signature
      // });

      // Mock limit order creation
      const mockOrder: LimitOrder = {
        orderHash: `0x${Math.random().toString(16).slice(2, 66)}`,
        maker: "0x742d35Cc6634C0532925a3b8D4C7C4E5ebc7",
        makerAsset,
        takerAsset,
        makerAmount,
        takerAmount,
        expires,
        status: "active"
      };

      return mockOrder;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create limit order";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get token price from real 1inch Spot Price API
  const getTokenPrice = useCallback(async (
    chainId: number,
    tokenAddress: string
  ): Promise<number | null> => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_ONEINCH_API_KEY;
      if (!apiKey) {
        throw new Error("1inch API key not configured");
      }

      // Real 1inch Spot Price API call
      const response = await fetch(
        `https://api.1inch.dev/price/v1.1/${chainId}/${tokenAddress}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`1inch Price API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Return price in USD
      return parseFloat(data[tokenAddress] || "0");
    } catch (err: any) {
      const errorMessage = err.message || "Failed to get token price";
      setError(errorMessage);
      return null;
    }
  }, []);

  // Calculate price impact
  const calculatePriceImpact = useCallback((
    marketPrice: number,
    executionPrice: number
  ): number => {
    return Math.abs((executionPrice - marketPrice) / marketPrice) * 100;
  }, []);

  return {
    loading,
    error,
    getQuote,
    getCrossChainQuote,
    createFusionOrder,
    getFusionOrderStatus,
    submitSecret,
    createLimitOrder,
    getTokenPrice,
    calculatePriceImpact,
  };
}