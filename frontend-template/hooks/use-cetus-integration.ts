"use client";

import { useState, useCallback } from "react";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { TransactionBlock } from "@mysten/sui/transactions";

/**
 * Hook for Cetus CLMM DEX Integration
 * Based on official Cetus SDK documentation
 * @see https://cetus-1.gitbook.io/cetus-developer-docs/developer/via-sdk-v2/sdk-modules/cetusprotocol-sui-clmm-sdk
 */

interface CetusPool {
  id: string;
  coin_type_a: string;
  coin_type_b: string;
  current_sqrt_price: string;
  fee_rate: number;
  liquidity: string;
  tick_current_index: number;
  tick_spacing: number;
  type: string;
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

// Cetus Contract Addresses (Testnet)
const CETUS_CONFIG = {
  GLOBAL_CONFIG_ID: "0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42060",
  CLOCK_ADDRESS: "0x6",
  // Add more contract addresses as needed
};

// Initialize Sui client for Cetus integration
const initSuiClient = () => {
  return new SuiClient({
    url: getFullnodeUrl("testnet"),
  });
};

export function useCetusIntegration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get pool information for a trading pair
  const getPool = useCallback(async (
    coinTypeA: string,
    coinTypeB: string,
    feeTier: number = 0.0025 // Default to 0.25% fee tier
  ): Promise<CetusPool | null> => {
    try {
      setLoading(true);
      setError(null);

      const suiClient = initSuiClient();

      // Search for pools with the specified coin types
      // This is a simplified approach - in practice, you'd use the Cetus SDK
      // or query the Cetus indexer API for more efficient pool discovery
      const poolObjects = await suiClient.getOwnedObjects({
        owner: CETUS_CONFIG.GLOBAL_CONFIG_ID,
        filter: {
          StructType: `${CETUS_CONFIG.GLOBAL_CONFIG_ID}::pool::Pool<${coinTypeA}, ${coinTypeB}>`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      // Find pool with matching fee tier
      for (const poolObj of poolObjects.data) {
        if (poolObj.data?.content && "fields" in poolObj.data.content) {
          const fields = poolObj.data.content.fields as any;

          // Check if fee rate matches (convert from basis points)
          const poolFeeRate = parseInt(fields.fee_rate) / 10000;

          if (Math.abs(poolFeeRate - feeTier) < 0.0001) {
            return {
              id: poolObj.data.objectId,
              coin_type_a: coinTypeA,
              coin_type_b: coinTypeB,
              current_sqrt_price: fields.current_sqrt_price || "0",
              fee_rate: poolFeeRate,
              liquidity: fields.liquidity || "0",
              tick_current_index: parseInt(fields.tick_current_index) || 0,
              tick_spacing: parseInt(fields.tick_spacing) || 1,
              type: poolObj.data.type || "",
            };
          }
        }
      }

      // If no exact match found, return null
      return null;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to get pool";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

    // Pre-calculate swap amounts and fees using real pool data
  const preSwap = useCallback(async (
    params: CetusSwapParams
  ): Promise<CetusPreSwapResult | null> => {
    try {
      setLoading(true);
      setError(null);

      const suiClient = initSuiClient();

      // Get pool data
      const poolObject = await suiClient.getObject({
        id: params.pool_id,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!poolObject.data?.content || !("fields" in poolObject.data.content)) {
        throw new Error("Pool not found or invalid pool data");
      }

      const poolFields = poolObject.data.content.fields as any;
      const currentSqrtPrice = poolFields.current_sqrt_price;
      const liquidity = poolFields.liquidity;
      const feeRate = parseInt(poolFields.fee_rate) / 1000000; // Convert from ppm

      // Simplified price calculation
      // In a real implementation, you'd use the Cetus SDK's price calculation
      const inputAmount = parseFloat(params.amount);

      // Mock calculation based on square root price
      // This is a simplified version - real implementation would use Cetus math
      const priceRatio = params.a2b ? 0.95 : 1.05; // Simplified price impact
      const outputAmount = inputAmount * priceRatio;
      const fee = inputAmount * feeRate;
      const priceImpact = Math.abs(1 - priceRatio) * 100;

      return {
        estimated_amount_in: params.by_amount_in ? params.amount : (inputAmount / priceRatio).toString(),
        estimated_amount_out: params.by_amount_in ? outputAmount.toString() : params.amount,
        amount: params.amount,
        fee: fee.toString(),
        price_impact: priceImpact
      };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to calculate swap";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute swap transaction using Sui TransactionBlock
  const executeSwap = useCallback(async (
    params: CetusSwapParams,
    walletSignAndExecute?: (tx: TransactionBlock) => Promise<any>
  ): Promise<CetusSwapResult> => {
    try {
      setLoading(true);
      setError(null);

      if (!walletSignAndExecute) {
        throw new Error("Wallet function not provided");
      }

      // Create transaction block for Cetus swap
      const tx = new TransactionBlock();

      // This is a simplified version of a Cetus swap transaction
      // In a real implementation, you'd use the official Cetus SDK
      tx.moveCall({
        target: `${CETUS_CONFIG.GLOBAL_CONFIG_ID}::clmm_math::swap`,
        arguments: [
          tx.object(CETUS_CONFIG.GLOBAL_CONFIG_ID), // config
          tx.object(params.pool_id), // pool
          tx.pure(params.a2b), // a2b
          tx.pure(params.by_amount_in), // by_amount_in
          tx.pure(params.amount), // amount
          tx.pure(params.amount_limit), // amount_limit
          tx.object(CETUS_CONFIG.CLOCK_ADDRESS), // clock
        ],
        typeArguments: [params.coin_type_a, params.coin_type_b],
      });

      // Execute transaction through wallet
      const result = await walletSignAndExecute(tx);

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
  }, []);

  // Calculate slippage-adjusted amount limit
  const calculateAmountLimit = useCallback((
    estimatedAmount: string,
    slippagePercent: number,
    isMinimumOut: boolean
  ): string => {
    const amount = parseFloat(estimatedAmount);
    const slippageFactor = slippagePercent / 100;

    if (isMinimumOut) {
      // For minimum output, subtract slippage
      return (amount * (1 - slippageFactor)).toString();
    } else {
      // For maximum input, add slippage
      return (amount * (1 + slippageFactor)).toString();
    }
  }, []);

  // Get optimal routing between tokens using real pool data
  const findBestRoute = useCallback(async (
    fromToken: string,
    toToken: string,
    amount: string,
    isFixedInput: boolean = true
  ): Promise<CetusPool[]> => {
    try {
      setLoading(true);
      setError(null);

      const suiClient = initSuiClient();

      // Search for direct pools between the tokens
      const directPools = await suiClient.getOwnedObjects({
        owner: CETUS_CONFIG.GLOBAL_CONFIG_ID,
        filter: {
          StructType: `${CETUS_CONFIG.GLOBAL_CONFIG_ID}::pool::Pool<${fromToken}, ${toToken}>`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      // Also search for reverse direction
      const reversePools = await suiClient.getOwnedObjects({
        owner: CETUS_CONFIG.GLOBAL_CONFIG_ID,
        filter: {
          StructType: `${CETUS_CONFIG.GLOBAL_CONFIG_ID}::pool::Pool<${toToken}, ${fromToken}>`,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      const allPools = [...directPools.data, ...reversePools.data];
      const routes: CetusPool[] = [];

      for (const poolObj of allPools) {
        if (poolObj.data?.content && "fields" in poolObj.data.content) {
          const fields = poolObj.data.content.fields as any;

          routes.push({
            id: poolObj.data.objectId,
            coin_type_a: fromToken,
            coin_type_b: toToken,
            current_sqrt_price: fields.current_sqrt_price || "0",
            fee_rate: parseInt(fields.fee_rate) / 1000000,
            liquidity: fields.liquidity || "0",
            tick_current_index: parseInt(fields.tick_current_index) || 0,
            tick_spacing: parseInt(fields.tick_spacing) || 1,
            type: poolObj.data.type || "",
          });
        }
      }

      // Sort by liquidity (highest first) for best routing
      routes.sort((a, b) => parseFloat(b.liquidity) - parseFloat(a.liquidity));

      return routes;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to find route";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate swap fees for a route
  const calculateSwapFee = useCallback((
    route: CetusPool[],
    inputAmount: string
  ): string => {
    const amount = parseFloat(inputAmount);
    let totalFee = 0;

    route.forEach(pool => {
      totalFee += amount * pool.fee_rate;
    });

    return totalFee.toString();
  }, []);

  return {
    loading,
    error,
    getPool,
    preSwap,
    executeSwap,
    calculateAmountLimit,
    findBestRoute,
    calculateSwapFee,
  };
}