import axios from 'axios';

// Create axios instance with base configuration
const bridgeApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/api/bridge`,
  timeout: 15000, // Bridges can take longer
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
bridgeApi.interceptors.request.use(
  (config) => {
    console.log(`[Bridge API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[Bridge API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
bridgeApi.interceptors.response.use(
  (response) => {
    console.log(`[Bridge API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[Bridge API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

class BridgeService {
  constructor() {
    this.name = 'BridgeService';
  }

  // Get bridge quote
  async getQuote(sourceChain, destinationChain, amount, token = 'ETH') {
    try {
      const response = await bridgeApi.post('/quote', {
        sourceChain,
        destinationChain,
        amount,
        token
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get bridge quote');
    }
  }

  // Initiate bridge to Mantle
  async bridgeToMantle(userAddress, amount, token = 'ETH', minGasLimit = 200000) {
    try {
      const response = await bridgeApi.post('/to-mantle', {
        userAddress,
        amount,
        token,
        minGasLimit
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to initiate bridge to Mantle');
    }
  }

  // Initiate bridge from Mantle
  async bridgeFromMantle(userAddress, amount, token = 'ETH', minGasLimit = 200000) {
    try {
      const response = await bridgeApi.post('/from-mantle', {
        userAddress,
        amount,
        token,
        minGasLimit
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to initiate bridge from Mantle');
    }
  }

  // Get bridge transaction status
  async getBridgeStatus(bridgeId) {
    try {
      const response = await bridgeApi.get(`/status/${bridgeId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get bridge status');
    }
  }

  // Get user bridge history
  async getUserBridgeHistory(userAddress, limit = 50) {
    try {
      const response = await bridgeApi.get(`/history/${userAddress}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get bridge history');
    }
  }

  // Get supported chains
  async getSupportedChains() {
    try {
      const response = await bridgeApi.get('/chains');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get supported chains');
    }
  }

  // Get bridge statistics
  async getBridgeStats() {
    try {
      const response = await bridgeApi.get('/stats');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get bridge statistics');
    }
  }

  // Get bridge health status
  async getBridgeHealth() {
    try {
      const response = await bridgeApi.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get bridge health');
    }
  }

  // WebSocket methods for real-time updates
  subscribeToBridgeUpdates(bridgeId, callback) {
    if (typeof window !== 'undefined' && window.socket) {
      window.socket.emit('subscribe_bridge_updates', bridgeId);
      window.socket.on('bridge_update', callback);
    }
  }

  unsubscribeFromBridgeUpdates(callback) {
    if (typeof window !== 'undefined' && window.socket) {
      window.socket.off('bridge_update', callback);
    }
  }

  // Helper methods
  formatAmount(amount, decimals = 6) {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';

    if (num >= 1e9) {
      return (num / 1e9).toFixed(decimals) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(decimals) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(decimals) + 'K';
    }

    return num.toFixed(decimals);
  }

  formatTime(timeString) {
    if (!timeString || timeString === 'Completed') return timeString;

    // Parse different time formats
    if (timeString.includes('minutes')) {
      return timeString;
    } else if (timeString.includes('hours')) {
      return timeString;
    } else if (timeString.includes('days')) {
      return timeString;
    }

    return timeString;
  }

  getStatusColor(status) {
    switch (status) {
      case 'initiated':
        return '#f59e0b'; // amber
      case 'processing':
        return '#3b82f6'; // blue
      case 'challenge_period':
        return '#8b5cf6'; // purple
      case 'completed':
        return '#10b981'; // green
      case 'failed':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }

  getStatusText(status) {
    switch (status) {
      case 'initiated':
        return 'Initiated';
      case 'processing':
        return 'Processing';
      case 'challenge_period':
        return 'Challenge Period';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  getChainName(chainId) {
    const chainNames = {
      1: 'Ethereum',
      5: 'Ethereum Goerli',
      11155111: 'Ethereum Sepolia',
      5003: 'Mantle Sepolia',
      5000: 'Mantle',
      137: 'Polygon',
      80001: 'Polygon Mumbai'
    };
    return chainNames[chainId] || `Chain ${chainId}`;
  }

  getChainIcon(chainId) {
    const chainIcons = {
      1: '/icons/ethereum.svg',
      5: '/icons/ethereum.svg',
      11155111: '/icons/ethereum.svg',
      5003: '/icons/mantle.svg',
      5000: '/icons/mantle.svg',
      137: '/icons/polygon.svg',
      80001: '/icons/polygon.svg'
    };
    return chainIcons[chainId] || '/icons/default-chain.svg';
  }

  getTokenIcon(token) {
    const tokenIcons = {
      'ETH': '/icons/ethereum.svg',
      'MNT': '/icons/mantle.svg',
      'USDC': '/icons/usdc.svg',
      'USDT': '/icons/usdt.svg'
    };
    return tokenIcons[token] || '/icons/default-token.svg';
  }

  // Calculate progress percentage
  calculateProgress(status, bridgeData) {
    switch (status) {
      case 'initiated':
        return 20;
      case 'processing':
        return 60;
      case 'challenge_period':
        return 80;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  }

  // Estimate completion time
  estimateCompletionTime(status, bridgeData, direction) {
    switch (status) {
      case 'initiated':
        return direction === 'to-mantle' ? '10-15 minutes' : '5-10 minutes';
      case 'processing':
        return direction === 'to-mantle' ? '5-10 minutes' : '3-5 minutes';
      case 'challenge_period':
        return '6-7 days remaining';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  // Validate bridge parameters
  validateBridgeParams(params) {
    const errors = [];

    if (!params.userAddress) {
      errors.push('User address is required');
    }

    if (!params.amount || parseFloat(params.amount) <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!params.sourceChain) {
      errors.push('Source chain is required');
    }

    if (!params.destinationChain) {
      errors.push('Destination chain is required');
    }

    if (params.sourceChain === params.destinationChain) {
      errors.push('Source and destination chains must be different');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Error handling
  handleError(error, defaultMessage = 'An error occurred') {
    console.error(`[${this.name}] ${defaultMessage}:`, error);

    if (error.response) {
      // Server responded with error status
      const serverError = error.response.data?.error;
      if (serverError) {
        return new Error(serverError.message || defaultMessage);
      }
      return new Error(`Server error: ${error.response.status}`);
    } else if (error.request) {
      // Network error
      return new Error('Network error. Please check your connection.');
    } else {
      // Other error
      return new Error(error.message || defaultMessage);
    }
  }
}

// Export singleton instance
export default new BridgeService();