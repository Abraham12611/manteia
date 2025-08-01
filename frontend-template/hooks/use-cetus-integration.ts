"use client";

import { useState, useCallback, useEffect } from "react";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { TransactionBlock } from "@mysten/sui/transactions";
import { initCetusSDK, Percentage, adjustForSlippage, d } from "@cetusprotocol/cetus-sui-clmm-sdk";
import BN from "bn.js";

/**
 * Hook for Cetus CLMM DEX Integration
 * Based on official Cetus SDK documentation
 * @see https://cetus-1.gitbook.io/cetus-developer-docs/developer/via-sdk-v2/sdk-modules/cetusprotocol-sui-clmm-sdk
 */

interface CetusPool {
  poolAddress: string;
  coinTypeA: string;
  coinTypeB: string;
  current_sqrt_price: string;
  fee_rate: number;
  liquidity: string;
  tick_current_index: number;
  tick_spacing: number;
}

interface CetusSwapParams {
  pool_id: string;
  coin_type_a: string;
  coin_type_b: string;
  a2b: boolean;
  by_amount_in: boolean;
  amount: string;
  amount_limit: string;
  slippage: number;
}

interface CetusPreSwapResult {
  estimated_amount_in: string;
  estimated_amount_out: string;
  amount: string;
  fee: string;
  price_impact: number;
}

interface CetusSwapResult {
  success: boolean;
  transaction_digest?: string;
  error?: string;
}

// Cetus Token Addresses on Sui
const CETUS_TOKEN = "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS";
const XCETUS_TOKEN = "0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS";

// USDC on Sui Testnet (from Circle's official testnet faucet)
const USDC_TESTNET = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

export function useCetusIntegration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkInstance, setSdkInstance] = useState<any>(null);

  // Initialize Cetus SDK
  useEffect(() => {
    try {
      const sdk = initCetusSDK({
        network: 'testnet',
        fullNodeUrl: getFullnodeUrl('testnet')
      });
      setSdkInstance(sdk);
    } catch (err: any) {
      console.error("Failed to initialize Cetus SDK:", err);
      setError("Failed to initialize Cetus SDK");
    }
  }, []);

  // Get pool information for a trading pair using real Cetus SDK
  const getPool = useCallback(async (
    coinTypeA: string,
    coinTypeB: string,
    feeTier: number = 2500 // Default to 0.25% fee tier (2500 = 25 basis points)
  ): Promise<CetusPool | null> => {
    if (!sdkInstance) {
      setError("Cetus SDK not initialized");
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Get pools from Cetus SDK
      const pools = await sdkInstance.Pool.getPoolList(coinTypeA, coinTypeB);

      if (!pools || pools.length === 0) {
        setError("No pools found for this pair");
        return null;
      }

      // Find pool with matching fee tier
      const targetPool = pools.find((pool: any) => {
        const poolFeeRate = pool.fee_rate;
        return Math.abs(poolFeeRate - feeTier) < 10; // Allow small difference
      }) || pools[0]; // Default to first pool if no exact match

      if (!targetPool) {
        return null;
      }

      // Fetch detailed pool data
      const poolData = await sdkInstance.Pool.getPool(targetPool.poolAddress);

      return {
        poolAddress: poolData.poolAddress,
        coinTypeA: poolData.coinTypeA,
        coinTypeB: poolData.coinTypeB,
        current_sqrt_price: poolData.current_sqrt_price.toString(),
        fee_rate: poolData.fee_rate,
        liquidity: poolData.liquidity.toString(),
        tick_current_index: poolData.tick_current_index,
        tick_spacing: poolData.tick_spacing,
      };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to get pool";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sdkInstance]);

  // Pre-calculate swap amounts and fees using real Cetus SDK
  const preSwap = useCallback(async (
    params: CetusSwapParams
  ): Promise<CetusPreSwapResult | null> => {
    if (!sdkInstance) {
      setError("Cetus SDK not initialized");
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Get pool data
      const pool = await sdkInstance.Pool.getPool(params.pool_id);

      // Pre-calculate swap using Cetus SDK
      const preSwapResult = await sdkInstance.Swap.preSwap({
        pool: pool,
        current_sqrt_price: pool.current_sqrt_price,
        coinTypeA: params.coin_type_a,
        coinTypeB: params.coin_type_b,
        decimalsA: 9, // Most Sui tokens use 9 decimals
        decimalsB: params.coin_type_b === USDC_TESTNET ? 6 : 9, // USDC uses 6 decimals
        a2b: params.a2b,
        by_amount_in: params.by_amount_in,
        amount: params.amount,
      });

      return {
        estimated_amount_in: preSwapResult.estimatedAmountIn.toString(),
        estimated_amount_out: preSwapResult.estimatedAmountOut.toString(),
        amount: preSwapResult.amount.toString(),
        fee: preSwapResult.fee.toString(),
        price_impact: preSwapResult.priceImpact || 0,
      };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to calculate swap";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sdkInstance]);

  // Execute swap transaction using real Cetus SDK
  const executeSwap = useCallback(async (
    params: CetusSwapParams,
    walletSignAndExecute?: (tx: TransactionBlock) => Promise<any>
  ): Promise<CetusSwapResult> => {
    if (!sdkInstance) {
      setError("Cetus SDK not initialized");
      return {
        success: false,
        error: "Cetus SDK not initialized"
      };
    }

    try {
      setLoading(true);
      setError(null);

      if (!walletSignAndExecute) {
        throw new Error("Wallet function not provided");
      }

      // Calculate slippage-adjusted amount limit
      const slippage = Percentage.fromDecimal(d(params.slippage));
      const amountLimit = adjustForSlippage(
        new BN(params.amount_limit),
        slippage,
        !params.by_amount_in
      );

      // Create swap transaction payload using Cetus SDK
      const swapPayload = await sdkInstance.Swap.createSwapTransactionPayload({
        pool_id: params.pool_id,
        coinTypeA: params.coin_type_a,
        coinTypeB: params.coin_type_b,
        a2b: params.a2b,
        by_amount_in: params.by_amount_in,
        amount: params.amount,
        amount_limit: amountLimit.toString(),
        swap_partner: "", // No partner for now
      });

      // Execute transaction through wallet
      const result = await walletSignAndExecute(swapPayload);

      return {
        success: true,
        transaction_digest: result.digest || result.transactionHash
      };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to execute swap";
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [sdkInstance]);

  // Calculate slippage-adjusted amount limit
  const calculateAmountLimit = useCallback((
    estimatedAmount: string,
    slippagePercent: number,
    isForMinOutput: boolean
  ): string => {
    const amount = parseFloat(estimatedAmount);
    const slippageFactor = slippagePercent / 100;

    if (isForMinOutput) {
      // For minimum output, subtract slippage
      return Math.floor(amount * (1 - slippageFactor)).toString();
    } else {
      // For maximum input, add slippage
      return Math.ceil(amount * (1 + slippageFactor)).toString();
    }
  }, []);

  // Get optimal routing between tokens using real Cetus SDK
  const findBestRoute = useCallback(async (
    fromToken: string,
    toToken: string,
    amount: string,
    isFixedInput: boolean = true
  ): Promise<CetusPool[]> => {
    if (!sdkInstance) {
      setError("Cetus SDK not initialized");
      return [];
    }

    try {
      setLoading(true);
      setError(null);

      // Get all pools for this pair
      const pools = await sdkInstance.Pool.getPoolList(fromToken, toToken);

      if (!pools || pools.length === 0) {
        return [];
      }

      // Fetch detailed data for each pool
      const detailedPools = await Promise.all(
        pools.map(async (pool: any) => {
          const poolData = await sdkInstance.Pool.getPool(pool.poolAddress);
          return {
            poolAddress: poolData.poolAddress,
            coinTypeA: poolData.coinTypeA,
            coinTypeB: poolData.coinTypeB,
            current_sqrt_price: poolData.current_sqrt_price.toString(),
            fee_rate: poolData.fee_rate,
            liquidity: poolData.liquidity.toString(),
            tick_current_index: poolData.tick_current_index,
            tick_spacing: poolData.tick_spacing,
          };
        })
      );

      // Sort by liquidity (highest first) for best routing
      detailedPools.sort((a, b) => {
        const liquidityA = new BN(a.liquidity);
        const liquidityB = new BN(b.liquidity);
        return liquidityB.cmp(liquidityA);
      });

      return detailedPools;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to find route";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [sdkInstance]);

  // Calculate swap fees for a route
  const calculateSwapFee = useCallback((
    route: CetusPool[],
    inputAmount: string
  ): string => {
    let totalFee = 0;
    let remainingAmount = parseFloat(inputAmount);

    for (const pool of route) {
      const poolFee = remainingAmount * (pool.fee_rate / 1000000); // Fee rate is in parts per million
      totalFee += poolFee;
      remainingAmount -= poolFee;
    }

    return totalFee.toString();
  }, []);

  // Get price impact for a swap
  const calculatePriceImpact = useCallback(async (
    pool: CetusPool,
    inputAmount: string,
    isTokenAInput: boolean
  ): Promise<number> => {
    if (!sdkInstance) {
      return 0;
    }

    try {
      // Use Cetus SDK to calculate price impact
      const poolData = await sdkInstance.Pool.getPool(pool.poolAddress);
      const preSwapResult = await sdkInstance.Swap.preSwap({
        pool: poolData,
        current_sqrt_price: poolData.current_sqrt_price,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        decimalsA: 9,
        decimalsB: pool.coinTypeB === USDC_TESTNET ? 6 : 9,
        a2b: isTokenAInput,
        by_amount_in: true,
        amount: inputAmount,
      });

      return preSwapResult.priceImpact || 0;
    } catch {
      return 0;
    }
  }, [sdkInstance]);

  return {
    loading,
    error,
    cetusToken: CETUS_TOKEN,
    xcetusToken: XCETUS_TOKEN,
    usdcTestnet: USDC_TESTNET,
    getPool,
    preSwap,
    executeSwap,
    calculateAmountLimit,
    findBestRoute,
    calculateSwapFee,
    calculatePriceImpact,
  };
}