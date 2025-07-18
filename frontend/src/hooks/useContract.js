import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { ethers } from 'ethers';
import contractService from '../services/contractService';

export const useContract = () => {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize contract service when wallet connects
  useEffect(() => {
    const initializeContract = async () => {
      if (isConnected && walletProvider) {
        try {
          setIsLoading(true);
          setError(null);

          const provider = new ethers.BrowserProvider(walletProvider);
          const signer = await provider.getSigner();

          await contractService.init(provider, signer);
          setIsInitialized(true);
        } catch (err) {
          console.error('Error initializing contract:', err);
          setError(contractService.formatTransactionError(err));
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsInitialized(false);
      }
    };

    initializeContract();
  }, [isConnected, walletProvider]);

  // Get user balances for a market
  const getUserBalances = useCallback(async (marketId) => {
    if (!isInitialized || !address) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    try {
      setIsLoading(true);
      setError(null);

      const balances = await contractService.getUserBalances(address, marketId);
      return balances;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, address]);

  // Place an order
  const placeOrder = useCallback(async (marketId, price, amount, isBuy) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await contractService.placeOrder(marketId, price, amount, isBuy);
      return result;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Get order details
  const getOrderDetails = useCallback(async (marketId) => {
    if (!isInitialized || !address) {
      throw new Error('Contract not initialized or wallet not connected');
    }

    try {
      setIsLoading(true);
      setError(null);

      const orderDetails = await contractService.getOrderDetails(marketId, address);
      return orderDetails;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, address]);

  // Get gas estimate for a transaction
  const estimateGas = useCallback(async (method, params) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      const estimate = await contractService.estimateGas(method, params);
      return estimate;
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

  // Verify contract deployment
  const verifyContractDeployment = useCallback(async () => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      const verification = await contractService.verifyContractDeployment();
      return verification;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    }
  }, [isInitialized]);

  // Listen to contract events
  const listenToEvents = useCallback((eventName, callback) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    return contractService.listenToEvents(eventName, callback);
  }, [isInitialized]);

  // Redeem winnings
  const redeemWinnings = useCallback(async (marketId, outcome) => {
    if (!isInitialized) {
      throw new Error('Contract not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await contractService.redeemWinnings(marketId, outcome);
      return result;
    } catch (err) {
      const formattedError = contractService.formatTransactionError(err);
      setError(formattedError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

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

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

    return {
    // State
    isInitialized,
    isLoading,
    error,
    address,
    isConnected,

    // Methods
    getUserBalances,
    placeOrder,
    getOrderDetails,
    estimateGas,
    getCurrentGasPrice,
    verifyContractDeployment,
    listenToEvents,
    redeemWinnings,
    resolveMarket,
    isMarketResolved,
    getMarketOutcome,
    clearError,

    // Direct access to contract service for advanced usage
    contractService
  };
};

export default useContract;