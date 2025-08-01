"use client";

import { useState, useCallback, useEffect } from "react";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { TransactionBlock } from "@mysten/sui/transactions";
import { ethers } from "ethers";

/**
 * Hook for Cross-Chain Swap Operations
 * Integrates with backend CrossChainSwapService and manages swap state
 * Based on official Wormhole and Cetus documentation patterns
 */

export interface SwapParams {
  fromChain: "ethereum" | "sui";
  toChain: "ethereum" | "sui";
  fromToken: {
    symbol: string;
    address: string;
    decimals: number;
  };
  toToken: {
    symbol: string;
    address: string;
    decimals: number;
  };
  amount: string;
  slippage: number;
  deadline?: number;
}

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  minimumReceived: string;
  steps: SwapStep[];
  estimatedGas: string;
  fees: {
    swap: string;
    bridge: string;
    total: string;
  };
  route: any[];
}

export interface SwapStep {
  type: "swap" | "bridge";
  chain?: string;
  from: string;
  to: string;
  expectedOutput: string;
  fees?: any;
}

export interface SwapExecution {
  swapId: string;
  status: SwapStatus;
  transactions: {
    ethereum?: string;
    sui?: string;
    bridge?: string;
  };
  steps: {
    ethToUsdc?: StepStatus;
    suiToUsdc?: StepStatus;
    bridge?: StepStatus;
    usdcToSui?: StepStatus;
    usdcToEth?: StepStatus;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type SwapStatus =
  | "INITIATED"
  | "ETH_TO_USDC_SWAP"
  | "SUI_TO_USDC_SWAP"
  | "BRIDGING"
  | "USDC_TO_SUI_SWAP"
  | "USDC_TO_ETH_SWAP"
  | "COMPLETED"
  | "FAILED";

export type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface UseCrossChainSwapReturn {
  // Quote Management
  getQuote: (params: SwapParams) => Promise<{ success: boolean; quote?: SwapQuote; error?: string }>;
  quote: SwapQuote | null;
  isLoadingQuote: boolean;
  quoteError: string | null;

  // Swap Execution
  executeSwap: (params: SwapParams) => Promise<{ success: boolean; swapId?: string; error?: string }>;
  currentSwap: SwapExecution | null;
  isExecutingSwap: boolean;
  swapError: string | null;

  // Swap Monitoring
  getSwapStatus: (swapId: string) => Promise<SwapExecution | null>;
  subscribeToSwapUpdates: (swapId: string, callback: (swap: SwapExecution) => void) => () => void;

  // Helper Functions
  estimateGasCosts: (params: SwapParams) => Promise<{ ethereum?: string; sui?: string }>;
  validateSwapParams: (params: SwapParams) => { isValid: boolean; errors: string[] };
  getSupportedTokens: () => { ethereum: any[]; sui: any[] };
}

export function useCrossChainSwap(): UseCrossChainSwapReturn {
  const { sui, ethereum, areBothWalletsConnected } = useManteiaWallet();

  // State management
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [currentSwap, setCurrentSwap] = useState<SwapExecution | null>(null);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Backend API base URL
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Supported tokens based on our backend services
  const SUPPORTED_TOKENS = {
    ethereum: [
      { symbol: "ETH", name: "Ethereum", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
      { symbol: "USDC", name: "USD Coin", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 }, // Sepolia USDC
    ],
    sui: [
      { symbol: "SUI", name: "Sui", address: "0x2::sui::SUI", decimals: 9 },
      { symbol: "USDC", name: "USD Coin", address: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN", decimals: 6 }, // Sui USDC
    ]
  };

  /**
   * Get quote for cross-chain swap
   */
  const getQuote = useCallback(async (params: SwapParams) => {
    try {
      setIsLoadingQuote(true);
      setQuoteError(null);

      const response = await fetch(`${API_BASE}/api/swap/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromChain: params.fromChain,
          toChain: params.toChain,
          amount: params.amount,
          fromToken: params.fromToken.symbol,
          toToken: params.toToken.symbol,
          slippage: params.slippage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setQuote(data.quote);
        return { success: true, quote: data.quote };
      } else {
        throw new Error(data.error || "Failed to get quote");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to get quote";
      setQuoteError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoadingQuote(false);
    }
  }, [API_BASE]);

  /**
   * Execute cross-chain swap
   */
  const executeSwap = useCallback(async (params: SwapParams) => {
    try {
      setIsExecutingSwap(true);
      setSwapError(null);

      // Validate parameters
      const validation = validateSwapParams(params);
      if (!validation.isValid) {
        throw new Error(`Invalid parameters: ${validation.errors.join(", ")}`);
      }

      // Check wallet connections
      const isCrossChain = params.fromChain !== params.toChain;
      if (isCrossChain && !areBothWalletsConnected) {
        throw new Error("Both wallets must be connected for cross-chain swaps");
      }

      if (!isCrossChain) {
        if (params.fromChain === "ethereum" && !ethereum.wallet.isConnected) {
          throw new Error("Ethereum wallet not connected");
        }
        if (params.fromChain === "sui" && !sui.connected) {
          throw new Error("Sui wallet not connected");
        }
      }

      // Prepare swap request
      const swapRequest = {
        fromChain: params.fromChain,
        toChain: params.toChain,
        fromToken: params.fromToken,
        toToken: params.toToken,
        amount: params.amount,
        slippage: params.slippage,
        fromAddress: params.fromChain === "ethereum" ? ethereum.wallet.address : sui.account?.address,
        toAddress: params.toChain === "ethereum" ? ethereum.wallet.address : sui.account?.address,
        deadline: params.deadline || Date.now() + (20 * 60 * 1000), // 20 minutes default
      };

      // Call backend API to initiate swap
      const response = await fetch(`${API_BASE}/api/swap/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setCurrentSwap(data.swap);

        // Start monitoring swap progress
        if (data.swapId) {
          monitorSwapProgress(data.swapId);
        }

        return { success: true, swapId: data.swapId };
      } else {
        throw new Error(data.error || "Failed to execute swap");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to execute swap";
      setSwapError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsExecutingSwap(false);
    }
  }, [ethereum.wallet, sui.account, areBothWalletsConnected, API_BASE]);

  /**
   * Monitor swap progress via polling
   */
  const monitorSwapProgress = useCallback(async (swapId: string) => {
    const pollInterval = 5000; // Poll every 5 seconds
    let attempts = 0;
    const maxAttempts = 240; // 20 minutes maximum

    const poll = async () => {
      try {
        const swap = await getSwapStatus(swapId);
        if (swap) {
          setCurrentSwap(swap);

          // Stop polling if swap is completed or failed
          if (swap.status === "COMPLETED" || swap.status === "FAILED") {
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        }
      } catch (error) {
        console.error("Error monitoring swap progress:", error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        }
      }
    };

    poll();
  }, []);

  /**
   * Get swap status
   */
  const getSwapStatus = useCallback(async (swapId: string): Promise<SwapExecution | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/swap/status/${swapId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.swap) {
        return data.swap;
      }

      return null;
    } catch (error) {
      console.error("Error getting swap status:", error);
      return null;
    }
  }, [API_BASE]);

  /**
   * Subscribe to swap updates (WebSocket would be better, using polling for now)
   */
  const subscribeToSwapUpdates = useCallback((swapId: string, callback: (swap: SwapExecution) => void) => {
    const interval = setInterval(async () => {
      const swap = await getSwapStatus(swapId);
      if (swap) {
        callback(swap);

        // Stop polling when swap is complete
        if (swap.status === "COMPLETED" || swap.status === "FAILED") {
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [getSwapStatus]);

  /**
   * Estimate gas costs for swap
   */
  const estimateGasCosts = useCallback(async (params: SwapParams) => {
    try {
      const response = await fetch(`${API_BASE}/api/swap/estimate-gas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromChain: params.fromChain,
          toChain: params.toChain,
          amount: params.amount,
          fromToken: params.fromToken.symbol,
          toToken: params.toToken.symbol,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.gasEstimates || {};
    } catch (error) {
      console.error("Error estimating gas costs:", error);
      return {};
    }
  }, [API_BASE]);

  /**
   * Validate swap parameters
   */
  const validateSwapParams = useCallback((params: SwapParams) => {
    const errors: string[] = [];

    if (!params.amount || parseFloat(params.amount) <= 0) {
      errors.push("Invalid amount");
    }

    if (!params.fromToken || !params.toToken) {
      errors.push("Tokens not selected");
    }

    if (params.fromToken.symbol === params.toToken.symbol && params.fromChain === params.toChain) {
      errors.push("Cannot swap same token on same chain");
    }

    if (params.slippage < 0.1 || params.slippage > 50) {
      errors.push("Slippage must be between 0.1% and 50%");
    }

    // Check if tokens are supported
    const fromSupported = SUPPORTED_TOKENS[params.fromChain].some(
      t => t.symbol === params.fromToken.symbol
    );
    const toSupported = SUPPORTED_TOKENS[params.toChain].some(
      t => t.symbol === params.toToken.symbol
    );

    if (!fromSupported) {
      errors.push(`${params.fromToken.symbol} not supported on ${params.fromChain}`);
    }

    if (!toSupported) {
      errors.push(`${params.toToken.symbol} not supported on ${params.toChain}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  /**
   * Get supported tokens
   */
  const getSupportedTokens = useCallback(() => {
    return SUPPORTED_TOKENS;
  }, []);

  // Clear errors when parameters change
  useEffect(() => {
    setQuoteError(null);
    setSwapError(null);
  }, []);

  return {
    // Quote Management
    getQuote,
    quote,
    isLoadingQuote,
    quoteError,

    // Swap Execution
    executeSwap,
    currentSwap,
    isExecutingSwap,
    swapError,

    // Swap Monitoring
    getSwapStatus,
    subscribeToSwapUpdates,

    // Helper Functions
    estimateGasCosts,
    validateSwapParams,
    getSupportedTokens,
  };
}