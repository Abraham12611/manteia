"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

interface LimitOrder {
  orderHash: string;
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  expires: number;
  status: "active" | "filled" | "cancelled" | "expired";
  strategyType?: string;
  createdAt: string;
  updatedAt: string;
}

interface Strategy {
  id: string;
  type: string;
  name: string;
  status: "active" | "paused" | "completed" | "cancelled";
  config: any;
  orders: LimitOrder[];
  createdAt: string;
  updatedAt: string;
}

interface OrderHistory {
  orderHash: string;
  strategyId: string;
  status: "filled" | "cancelled" | "expired";
  filledAmount?: string;
  filledPrice?: string;
  gasUsed?: string;
  executedAt?: string;
  createdAt: string;
}

/**
 * Hook for managing limit orders and strategies
 * Based on 1inch Limit Order Protocol documentation
 */

export function useLimitOrders() {
  const [activeOrders, setActiveOrders] = useState<LimitOrder[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Fetch active orders
  const fetchActiveOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/limit-orders/active`);

      if (response.data.success) {
        setActiveOrders(response.data.orders || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch active orders");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to fetch active orders");
      console.error("Error fetching active orders:", err);
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Fetch strategies
  const fetchStrategies = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/enhanced-strategies/active`);

      if (response.data.success) {
        setStrategies(response.data.strategies || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch strategies");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to fetch strategies");
      console.error("Error fetching strategies:", err);
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Fetch order history
  const fetchOrderHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/limit-orders/history`);

      if (response.data.success) {
        setOrderHistory(response.data.history || []);
      } else {
        throw new Error(response.data.message || "Failed to fetch order history");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to fetch order history");
      console.error("Error fetching order history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL]);

  // Cancel order
  const cancelOrder = useCallback(async (orderHash: string) => {
    try {
      setError(null);

      const response = await axios.delete(`${API_BASE_URL}/api/limit-orders/cancel/${orderHash}`);

      if (response.data.success) {
        // Update local state
        setActiveOrders(prev => prev.filter(order => order.orderHash !== orderHash));
        return { success: true };
      } else {
        throw new Error(response.data.message || "Failed to cancel order");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to cancel order";
      setError(errorMessage);
      console.error("Error cancelling order:", err);
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL]);

  // Adjust strategy
  const adjustStrategy = useCallback(async (strategyId: string, adjustments: any) => {
    try {
      setError(null);

      const response = await axios.put(`${API_BASE_URL}/api/limit-orders/adjust/${strategyId}`, adjustments);

      if (response.data.success) {
        // Update local state
        setStrategies(prev => prev.map(strategy =>
          strategy.id === strategyId
            ? { ...strategy, ...adjustments, updatedAt: new Date().toISOString() }
            : strategy
        ));
        return { success: true };
      } else {
        throw new Error(response.data.message || "Failed to adjust strategy");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to adjust strategy";
      setError(errorMessage);
      console.error("Error adjusting strategy:", err);
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL]);

  // Monitor order
  const monitorOrder = useCallback(async (orderHash: string) => {
    try {
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/limit-orders/monitor/${orderHash}`);

      if (response.data.success) {
        return { success: true, data: response.data.order };
      } else {
        throw new Error(response.data.message || "Failed to monitor order");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to monitor order";
      setError(errorMessage);
      console.error("Error monitoring order:", err);
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL]);

  // Get strategy analytics
  const getStrategyAnalytics = useCallback(async (strategyId: string) => {
    try {
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/enhanced-strategies/analytics/${strategyId}`);

      if (response.data.success) {
        return { success: true, data: response.data.analytics };
      } else {
        throw new Error(response.data.message || "Failed to fetch strategy analytics");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to fetch strategy analytics";
      setError(errorMessage);
      console.error("Error fetching strategy analytics:", err);
      return { success: false, error: errorMessage };
    }
  }, [API_BASE_URL]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchActiveOrders(),
      fetchStrategies(),
      fetchOrderHistory()
    ]);
  }, [fetchActiveOrders, fetchStrategies, fetchOrderHistory]);

  // Initial data fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Set up polling for real-time updates (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveOrders();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchActiveOrders]);

  return {
    // State
    activeOrders,
    strategies,
    orderHistory,
    isLoading,
    error,

    // Actions
    fetchActiveOrders,
    fetchStrategies,
    fetchOrderHistory,
    cancelOrder,
    adjustStrategy,
    monitorOrder,
    getStrategyAnalytics,
    refresh
  };
}