"use client";

import { useState, useCallback } from "react";
import axios from "axios";

interface CreateStrategyParams {
  type: string;
  config: any;
  name?: string;
  description?: string;
}

interface CreateStrategyResult {
  success: boolean;
  strategyId?: string;
  orderHash?: string;
  error?: string;
}

/**
 * Hook for creating new strategies
 * Based on 1inch Limit Order Protocol documentation
 */

export function useCreateStrategy() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Create enhanced TWAP strategy
  const createEnhancedTWAPStrategy = useCallback(async (params: CreateStrategyParams): Promise<CreateStrategyResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/enhanced-strategies/enhanced-twap`, params.config);

      if (response.data.success) {
        return {
          success: true,
          strategyId: response.data.strategyId,
          orderHash: response.data.orderHash
        };
      } else {
        throw new Error(response.data.message || "Failed to create enhanced TWAP strategy");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to create enhanced TWAP strategy";
      setError(errorMessage);
      console.error("Error creating enhanced TWAP strategy:", err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Create barrier options strategy
  const createBarrierOptionsStrategy = useCallback(async (params: CreateStrategyParams): Promise<CreateStrategyResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/enhanced-strategies/barrier-options`, params.config);

      if (response.data.success) {
        return {
          success: true,
          strategyId: response.data.strategyId,
          orderHash: response.data.orderHash
        };
      } else {
        throw new Error(response.data.message || "Failed to create barrier options strategy");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to create barrier options strategy";
      setError(errorMessage);
      console.error("Error creating barrier options strategy:", err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Create delta hedging strategy
  const createDeltaHedgingStrategy = useCallback(async (params: CreateStrategyParams): Promise<CreateStrategyResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/enhanced-strategies/delta-hedging`, params.config);

      if (response.data.success) {
        return {
          success: true,
          strategyId: response.data.strategyId,
          orderHash: response.data.orderHash
        };
      } else {
        throw new Error(response.data.message || "Failed to create delta hedging strategy");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to create delta hedging strategy";
      setError(errorMessage);
      console.error("Error creating delta hedging strategy:", err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Create custom strategy
  const createCustomStrategy = useCallback(async (params: CreateStrategyParams): Promise<CreateStrategyResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/enhanced-strategies/custom-strategy`, params.config);

      if (response.data.success) {
        return {
          success: true,
          strategyId: response.data.strategyId,
          orderHash: response.data.orderHash
        };
      } else {
        throw new Error(response.data.message || "Failed to create custom strategy");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to create custom strategy";
      setError(errorMessage);
      console.error("Error creating custom strategy:", err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Generic strategy creation function
  const createStrategy = useCallback(async (params: CreateStrategyParams): Promise<CreateStrategyResult> => {
    switch (params.type) {
      case "enhanced_twap":
        return createEnhancedTWAPStrategy(params);
      case "barrier_options":
        return createBarrierOptionsStrategy(params);
      case "delta_hedging":
        return createDeltaHedgingStrategy(params);
      case "custom_strategy":
        return createCustomStrategy(params);
      default:
        const errorMessage = `Unknown strategy type: ${params.type}`;
        setError(errorMessage);
        return { success: false, error: errorMessage };
    }
  }, [createEnhancedTWAPStrategy, createBarrierOptionsStrategy, createDeltaHedgingStrategy, createCustomStrategy]);

  // Validate strategy configuration
  const validateStrategyConfig = useCallback((type: string, config: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Common validation
    if (!config.chainId) {
      errors.push("Chain ID is required");
    }
    if (!config.makerAsset) {
      errors.push("Maker asset is required");
    }
    if (!config.takerAsset) {
      errors.push("Taker asset is required");
    }

    // Strategy-specific validation
    switch (type) {
      case "enhanced_twap":
        if (!config.totalAmount || parseFloat(config.totalAmount) <= 0) {
          errors.push("Total amount must be greater than 0");
        }
        if (!config.intervals || config.intervals < 1) {
          errors.push("Number of intervals must be at least 1");
        }
        if (!config.duration || config.duration < 60) {
          errors.push("Duration must be at least 60 seconds");
        }
        break;

      case "barrier_options":
        if (!config.barrierLevel) {
          errors.push("Barrier level is required");
        }
        if (!config.strikePrice) {
          errors.push("Strike price is required");
        }
        if (!config.optionType || !["call", "put"].includes(config.optionType)) {
          errors.push("Option type must be 'call' or 'put'");
        }
        break;

      case "delta_hedging":
        if (!config.underlying) {
          errors.push("Underlying asset is required");
        }
        if (!config.strikePrice) {
          errors.push("Strike price is required");
        }
        if (!config.optionPosition?.size) {
          errors.push("Option position size is required");
        }
        break;

      case "custom_strategy":
        if (!config.config?.timeConditions?.length &&
            !config.config?.priceConditions?.length &&
            !config.config?.volumeConditions?.length) {
          errors.push("At least one condition type is required");
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  return {
    // State
    isLoading,
    error,

    // Actions
    createStrategy,
    createEnhancedTWAPStrategy,
    createBarrierOptionsStrategy,
    createDeltaHedgingStrategy,
    createCustomStrategy,
    validateStrategyConfig
  };
}