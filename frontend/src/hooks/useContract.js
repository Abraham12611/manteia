import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import contractService from '../services/contractService';
import tradingService from '../services/tradingService';

export const useContract = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize contract and trading services
  useEffect(() => {
    const initializeServices = async () => {
      if (!publicClient) return;

      try {
        // Initialize contract service
        await contractService.init(publicClient);
        await tradingService.init(publicClient);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize services:', error);
        setError(`Failed to initialize: ${error.message}`);
      }
    };

    initializeServices();
  }, [publicClient]);

  // Get user's MNT balance
  const getMNTBalance = useCallback(async () => {
    if (!isInitialized || !address) {
      throw new Error('Services not initialized or wallet not connected');
    }

    try {
      const balance = await contractService.getMNTBalance(address);
      return balance;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized, address]);

  // Get user's collateral balance
  const getUserCollateral = useCallback(async () => {
    if (!isInitialized || !address) {
      throw new Error('Services not initialized or wallet not connected');
    }

    try {
      const collateral = await contractService.getUserCollateral(address);
      return collateral;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized, address]);

  // Deposit MNT as collateral
  const depositCollateral = useCallback(async (amount) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await contractService.depositCollateral(amount);

      // Track transaction in backend
      await tradingService.monitorTransaction(result.transactionHash, {
        type: 'deposit',
        amount: amount,
        userAddress: address
      });

      return result;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, address]);

  // Withdraw MNT collateral
  const withdrawCollateral = useCallback(async (amount) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await contractService.withdrawCollateral(amount);

      // Track transaction in backend
      await tradingService.monitorTransaction(result.transactionHash, {
        type: 'withdraw',
        amount: amount,
        userAddress: address
      });

      return result;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, address]);

  // Get user's share token balances
  const getUserBalances = useCallback(async (marketId) => {
    if (!isInitialized || !address) {
      throw new Error('Services not initialized or wallet not connected');
    }

    try {
      const balances = await contractService.getUserBalances(address, marketId);
      return balances;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized, address]);

  // Place an order
  const placeOrder = useCallback(async (marketId, outcome, price, size, orderType = 'limit') => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Validate order parameters
      tradingService.validateOrderParams(marketId, outcome, price, size);

      // Place order via contract
      const contractResult = await contractService.placeOrder(
        marketId,
        outcome,
        price,
        size,
        orderType
      );

      // Record order in backend
      const backendResult = await tradingService.placeOrder(
        marketId,
        outcome,
        price,
        size,
        orderType
      );

      // Monitor transaction
      await tradingService.monitorTransaction(contractResult.transactionHash, {
        type: 'order',
        marketId: marketId,
        outcome: outcome,
        price: price,
        size: size,
        orderType: orderType,
        userAddress: address
      });

      return {
        ...contractResult,
        orderId: backendResult.data?.orderId
      };
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, address]);

  // Cancel an order
  const cancelOrder = useCallback(async (orderId) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Cancel order via contract
      const contractResult = await contractService.cancelOrder(orderId);

      // Cancel order in backend
      await tradingService.cancelOrder(orderId);

      return contractResult;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Get market order book
  const getMarketOrderBook = useCallback(async (marketId) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      // Get order book from backend (more efficient than contract)
      const result = await tradingService.getMarketOrderBook(marketId);
      return result.data;
    } catch (err) {
      // Fallback to contract if backend fails
      try {
        const contractResult = await contractService.getOrderBook(marketId);
        return contractResult;
      } catch (contractErr) {
        const formattedError = contractService.formatTransactionError(contractErr);
        setError(formattedError);
        throw contractErr;
      }
    }
  }, [isInitialized]);

  // Get market price
  const getMarketPrice = useCallback(async (marketId) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      // Get price from backend first
      const result = await tradingService.getMarketPrice(marketId);
      return result.data;
    } catch (err) {
      // Fallback to contract
      try {
        const contractResult = await contractService.getMarketPrice(marketId);
        return contractResult;
      } catch (contractErr) {
        const formattedError = contractService.formatTransactionError(contractErr);
        setError(formattedError);
        throw contractErr;
      }
    }
  }, [isInitialized]);

  // Get user positions
  const getUserPositions = useCallback(async (marketId = null) => {
    if (!isInitialized || !address) {
      throw new Error('Services not initialized or wallet not connected');
    }

    try {
      const result = await tradingService.getUserPositions(address, marketId);
      return result.data;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized, address]);

  // Get user activity
  const getUserActivity = useCallback(async (filters = {}) => {
    if (!isInitialized || !address) {
      throw new Error('Services not initialized or wallet not connected');
    }

    try {
      const result = await tradingService.getUserActivity(address, filters);
      return result.data;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized, address]);

  // Redeem winnings
  const redeemWinnings = useCallback(async (marketId, outcome) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await contractService.redeemWinnings(marketId, outcome);

      // Track transaction
      await tradingService.monitorTransaction(result.transactionHash, {
        type: 'redeem',
        marketId: marketId,
        outcome: outcome,
        userAddress: address
      });

      return result;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, address]);

  // Resolve market (admin function)
  const resolveMarket = useCallback(async (marketId, outcome) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await contractService.resolveMarket(marketId, outcome);
      return result;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Check if market is resolved
  const isMarketResolved = useCallback(async (marketId) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      const resolved = await contractService.isMarketResolved(marketId);
      return resolved;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized]);

  // Get market outcome
  const getMarketOutcome = useCallback(async (marketId) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      const outcome = await contractService.getMarketOutcome(marketId);
      return outcome;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized]);

  // Get market statistics
  const getMarketStats = useCallback(async (marketId) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      // Get stats from backend first
      const result = await tradingService.getMarketStats(marketId);
      return result.data;
    } catch (err) {
      // Fallback to contract
      try {
        const contractResult = await contractService.getMarketStats(marketId);
        return contractResult;
      } catch (contractErr) {
        const formattedError = contractService.formatTransactionError(contractErr);
        setError(formattedError);
        throw contractErr;
      }
    }
  }, [isInitialized]);

  // Subscribe to market updates
  const subscribeToMarketUpdates = useCallback(async (marketId, callback) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      const unsubscribe = await tradingService.subscribeToMarketUpdates(marketId, callback);
      return unsubscribe;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized]);

  // Estimate gas for transaction
  const estimateGas = useCallback(async (method, params) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      const gasEstimate = await contractService.estimateGas(method, params);
      return gasEstimate;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized]);

  // Get current gas price
  const getCurrentGasPrice = useCallback(async () => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      const gasPrice = await contractService.getCurrentGasPrice();
      return gasPrice;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Calculate order cost
  const calculateOrderCost = useCallback((price, size) => {
    return tradingService.calculateOrderCost(price, size);
  }, []);

  // Calculate potential payout
  const calculatePotentialPayout = useCallback((size, outcomePrice) => {
    return tradingService.calculatePotentialPayout(size, outcomePrice);
  }, []);

  return {
    // State
    isInitialized,
    isLoading,
    error,
    address,
    isConnected,

    // Balance and Collateral
    getMNTBalance,
    getUserCollateral,
    depositCollateral,
    withdrawCollateral,
    getUserBalances,

    // Trading
    placeOrder,
    cancelOrder,
    getMarketOrderBook,
    getMarketPrice,
    getUserPositions,
    getUserActivity,
    getMarketStats,
    subscribeToMarketUpdates,

    // Market Resolution
    redeemWinnings,
    resolveMarket,
    isMarketResolved,
    getMarketOutcome,

    // Utilities
    estimateGas,
    getCurrentGasPrice,
    clearError,
    calculateOrderCost,
    calculatePotentialPayout,

    // Direct access to services for advanced usage
    contractService,
    tradingService
  };
};

export default useContract;