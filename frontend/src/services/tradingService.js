import axios from 'axios';
import { ethers } from 'ethers';

// Create axios instance for trading API
const tradingApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/api/trading`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
tradingApi.interceptors.request.use(
  (config) => {
    console.log(`[Trading API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[Trading API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
tradingApi.interceptors.response.use(
  (response) => {
    console.log(`[Trading API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[Trading API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

class TradingService {
  constructor() {
    this.provider = null;
    this.signer = null;
  }

  // Initialize with provider and signer
  async init(provider, signer = null) {
    this.provider = provider;
    this.signer = signer;
  }

  // Order Management
  async placeOrder(marketId, outcome, price, size, orderType = 'market') {
    try {
      // Validate inputs
      if (!marketId || outcome === undefined || !price || !size) {
        throw new Error('Missing required order parameters');
      }

      if (parseFloat(price) <= 0 || parseFloat(price) > 1) {
        throw new Error('Price must be between 0 and 1');
      }

      if (parseFloat(size) <= 0) {
        throw new Error('Size must be greater than 0');
      }

      const orderData = {
        marketId: marketId.toString(),
        outcome: Boolean(outcome),
        price: parseFloat(price),
        size: parseFloat(size),
        orderType: orderType.toLowerCase(),
        timestamp: Date.now()
      };

      const response = await tradingApi.post('/orders', orderData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to place order');
    }
  }

  async cancelOrder(orderId) {
    try {
      const response = await tradingApi.delete(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to cancel order');
    }
  }

  async getUserOrders(walletAddress, filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.marketId) params.append('marketId', filters.marketId);
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);

      const response = await tradingApi.get(`/orders/user/${walletAddress}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user orders');
    }
  }

  async getOrderById(orderId) {
    try {
      const response = await tradingApi.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get order');
    }
  }

  // Market Data
  async getMarketOrderBook(marketId) {
    try {
      const response = await tradingApi.get(`/trading/markets/${marketId}/orderbook`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get order book');
    }
  }

  async getMarketPrice(marketId) {
    try {
      const response = await tradingApi.get(`/trading/markets/${marketId}/price`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market price');
    }
  }

  async getMarketTrades(marketId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.offset) params.append('offset', options.offset);

      const response = await tradingApi.get(`/trading/markets/${marketId}/trades?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market trades');
    }
  }

  async getMarketStats(marketId) {
    try {
      const response = await tradingApi.get(`/trading/markets/${marketId}/stats`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market stats');
    }
  }

  // Position Management
  async getUserPositions(walletAddress, marketId = null) {
    try {
      const params = new URLSearchParams();
      if (marketId) params.append('marketId', marketId);

      const response = await tradingApi.get(`/positions/user/${walletAddress}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user positions');
    }
  }

  async getUserActivity(walletAddress, filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      if (filters.type) params.append('type', filters.type);
      if (filters.marketId) params.append('marketId', filters.marketId);

      const response = await tradingApi.get(`/activity/user/${walletAddress}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user activity');
    }
  }

  // Balance and Collateral
  async getUserMNTBalance(walletAddress) {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const balance = await this.provider.getBalance(walletAddress);
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      throw this.handleError(error, 'Failed to get MNT balance');
    }
  }

  async getUserCollateral(walletAddress) {
    try {
      const response = await tradingApi.get(`/collateral/user/${walletAddress}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user collateral');
    }
  }

  async depositCollateral(amount) {
    try {
      if (!this.signer) {
        throw new Error('Signer not initialized');
      }

      const amountWei = ethers.parseEther(amount.toString());

      const response = await tradingApi.post('/collateral/deposit', {
        amount: amount.toString(),
        walletAddress: await this.signer.getAddress()
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to deposit collateral');
    }
  }

  async withdrawCollateral(amount) {
    try {
      if (!this.signer) {
        throw new Error('Signer not initialized');
      }

      const response = await tradingApi.post('/collateral/withdraw', {
        amount: amount.toString(),
        walletAddress: await this.signer.getAddress()
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to withdraw collateral');
    }
  }

  // Price Calculations
  calculateOrderCost(price, size) {
    return parseFloat(price) * parseFloat(size);
  }

  calculatePotentialPayout(size, outcomePrice) {
    // For prediction markets, potential payout is size * (1 / outcomePrice)
    // But max payout is 1 MNT per share
    return parseFloat(size) * 1;
  }

  calculatePnL(positions, currentPrices) {
    let totalPnL = 0;

    positions.forEach(position => {
      const currentPrice = currentPrices[position.marketId] || 0;
      const marketValue = position.shares * currentPrice;
      const pnl = marketValue - position.totalCost;
      totalPnL += pnl;
    });

    return totalPnL;
  }

  // Market Resolution
  async claimWinnings(marketId, outcome) {
    try {
      if (!this.signer) {
        throw new Error('Signer not initialized');
      }

      const response = await tradingApi.post('/positions/claim', {
        marketId: marketId.toString(),
        outcome: Boolean(outcome),
        walletAddress: await this.signer.getAddress()
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to claim winnings');
    }
  }

  // Transaction Monitoring
  async monitorTransaction(txHash, orderData) {
    try {
      const response = await tradingApi.post('/transactions/monitor', {
        transactionHash: txHash,
        orderData: orderData,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to monitor transaction');
    }
  }

  async getTransactionStatus(txHash) {
    try {
      const response = await tradingApi.get(`/transactions/${txHash}/status`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction status');
    }
  }

  // Real-time Updates
  async subscribeToMarketUpdates(marketId, callback) {
    try {
      // In a real implementation, this would use WebSocket
      console.log('Subscribing to market updates for:', marketId);

      // For now, we'll poll for updates
      const intervalId = setInterval(async () => {
        try {
          const orderBook = await this.getMarketOrderBook(marketId);
          const price = await this.getMarketPrice(marketId);

          callback({
            marketId,
            orderBook: orderBook.data,
            price: price.data,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error in market update subscription:', error);
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(intervalId);
    } catch (error) {
      throw this.handleError(error, 'Failed to subscribe to market updates');
    }
  }

  // Utility Methods
  handleError(error, defaultMessage) {
    const errorMessage = error.response?.data?.error || error.message || defaultMessage;
    const errorCode = error.response?.data?.code || 'UNKNOWN_ERROR';
    const statusCode = error.response?.status || 500;

    return {
      message: errorMessage,
      code: errorCode,
      status: statusCode,
      timestamp: new Date().toISOString(),
      original: error
    };
  }

  // Validation helpers
  validateOrderParams(marketId, outcome, price, size) {
    if (!marketId) {
      throw new Error('Market ID is required');
    }

    if (outcome === undefined || outcome === null) {
      throw new Error('Outcome is required');
    }

    if (!price || isNaN(price) || price <= 0 || price > 1) {
      throw new Error('Price must be between 0 and 1');
    }

    if (!size || isNaN(size) || size <= 0) {
      throw new Error('Size must be greater than 0');
    }

    return true;
  }

  // Format helpers
  formatPrice(price) {
    return parseFloat(price).toFixed(2);
  }

  formatSize(size) {
    return parseFloat(size).toFixed(0);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatPercentage(value) {
    return `${(value * 100).toFixed(1)}%`;
  }
}

// Create singleton instance
const tradingService = new TradingService();

export default tradingService;