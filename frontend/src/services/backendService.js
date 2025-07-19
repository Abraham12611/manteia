import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

class BackendService {
  // User Management
  async createUser(walletAddress, email = null, username = null) {
    try {
      const response = await api.post('/users', {
        walletAddress,
        email,
        username
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create user');
    }
  }

  async getUser(walletAddress) {
    try {
      const response = await api.get(`/users/${walletAddress}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user');
    }
  }

  async updateUser(walletAddress, userData) {
    try {
      const response = await api.put(`/users/${walletAddress}`, userData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update user');
    }
  }

  async getUserProfile(walletAddress) {
    try {
      const response = await api.get(`/profile/${walletAddress}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user profile');
    }
  }

  async updateUserProfile(walletAddress, profileData) {
    try {
      const response = await api.put(`/profile/${walletAddress}`, profileData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update user profile');
    }
  }

  // Market Management
  async getMarkets(filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      if (filters.search) params.append('search', filters.search);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      const response = await api.get(`/trading/markets?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get markets');
    }
  }

  async getMarketById(marketId) {
    try {
      const response = await api.get(`/trading/markets/${marketId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market');
    }
  }

  async getFeaturedMarkets(limit = 6) {
    try {
      const response = await api.get(`/trading/markets/featured?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get featured markets');
    }
  }

  async getMarketsByCategory(category, limit = 10) {
    try {
      const response = await api.get(`/trading/markets/category/${category}?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get markets by category');
    }
  }

  async searchMarkets(query, filters = {}) {
    try {
      const params = new URLSearchParams();
      params.append('q', query);

      if (filters.category) params.append('category', filters.category);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);

      const response = await api.get(`/trading/markets/search?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to search markets');
    }
  }

  // Transaction Management
  async addTransaction(transactionData) {
    try {
      const response = await api.post('/transactions', transactionData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to add transaction');
    }
  }

  async getTransaction(transactionId) {
    try {
      const response = await api.get(`/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction');
    }
  }

  async getUserTransactions(userId, filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);

      const response = await api.get(`/transactions/user/${userId}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user transactions');
    }
  }

  async getTransactionDetails(transactionId) {
    try {
      const response = await api.get(`/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction details');
    }
  }

  async retryTransaction(transactionHash) {
    try {
      const response = await api.post(`/transactions/${transactionHash}/retry`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to retry transaction');
    }
  }

  async getTransactionStats() {
    try {
      const response = await api.get('/transactions/stats/summary');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction statistics');
    }
  }

  // Receipt Management
  async getReceipt(receiptId) {
    try {
      const response = await api.get(`/receipts/${receiptId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get receipt');
    }
  }

  async getUserReceipts(userId, filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      if (filters.type) params.append('type', filters.type);

      const response = await api.get(`/receipts/user/${userId}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user receipts');
    }
  }

  async getReceiptByTransaction(transactionHash) {
    try {
      const response = await api.get(`/receipts/transaction/${transactionHash}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw this.handleError(error, 'Failed to get receipt by transaction');
    }
  }

  async downloadReceiptPDF(receiptId) {
    try {
      const response = await api.get(`/receipts/${receiptId}/pdf`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${receiptId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      throw this.handleError(error, 'Failed to download receipt PDF');
    }
  }

  async verifyReceipt(receiptId) {
    try {
      const response = await api.post(`/receipts/${receiptId}/verify`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to verify receipt');
    }
  }

  async regenerateReceiptPDF(receiptId) {
    try {
      const response = await api.post(`/receipts/${receiptId}/regenerate-pdf`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to regenerate receipt PDF');
    }
  }

  async getReceiptStats() {
    try {
      const response = await api.get('/receipts/stats/summary');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get receipt statistics');
    }
  }

  // Health and System Status
  async getHealthStatus() {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get health status');
    }
  }

  async getSystemServices() {
    try {
      const response = await api.get('/health/services');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get system services status');
    }
  }

  async getSystemMetrics() {
    try {
      const response = await api.get('/health/metrics');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get system metrics');
    }
  }

  async getBlockchainStatus() {
    try {
      const response = await api.get('/health/blockchain');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get blockchain status');
    }
  }

  // Trading Data
  async getMarketOrderBook(marketId) {
    try {
      const response = await api.get(`/trading/markets/${marketId}/orderbook`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market order book');
    }
  }

  async getMarketPrice(marketId) {
    try {
      const response = await api.get(`/trading/markets/${marketId}/price`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market price');
    }
  }

  async getMarketTrades(marketId, filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      if (filters.fromTime) params.append('fromTime', filters.fromTime);
      if (filters.toTime) params.append('toTime', filters.toTime);

      const response = await api.get(`/trading/markets/${marketId}/trades?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market trades');
    }
  }

  async getUserPositions(walletAddress, marketId = null) {
    try {
      const params = new URLSearchParams();
      if (marketId) params.append('marketId', marketId);

      const response = await api.get(`/trading/positions/user/${walletAddress}?${params}`);
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

      const response = await api.get(`/trading/activity/user/${walletAddress}?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user activity');
    }
  }

  // Utility Methods
  async getTransactionFromBlockchain(transactionHash) {
    try {
      const response = await api.get(`/blockchain/transaction/${transactionHash}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction from blockchain');
    }
  }

  // Integration with existing contract service
  async trackTransaction(transactionHash, transactionType, userId, additionalData = {}) {
    try {
      // Get transaction details from blockchain first
      const txDetails = await this.getTransactionFromBlockchain(transactionHash);

      const transactionData = {
        userId,
        transactionHash,
        transactionType,
        fromAddress: txDetails.from,
        toAddress: txDetails.to,
        value: txDetails.value?.toString() || '0',
        chainId: process.env.REACT_APP_MANTLE_SEPOLIA_CHAIN_ID || '5003',
        ...additionalData
      };

      return await this.addTransaction(transactionData);
    } catch (error) {
      console.error('Failed to track transaction:', error);
      throw error;
    }
  }

  // WebSocket connection for real-time updates (future enhancement)
  connectWebSocket(userId) {
    // Implementation would go here for real-time transaction updates
    console.log('WebSocket connection would be established here for user:', userId);
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
}

// Create singleton instance
const backendService = new BackendService();

export default backendService;