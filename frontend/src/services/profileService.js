import axios from 'axios';

// Create axios instance for profile API
const profileApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/api/profile`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
profileApi.interceptors.request.use(
  (config) => {
    console.log(`[Profile API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[Profile API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
profileApi.interceptors.response.use(
  (response) => {
    console.log(`[Profile API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[Profile API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

class ProfileService {
  constructor() {
    this.name = 'ProfileService';
  }

  // Get user profile
  async getUserProfile(walletAddress) {
    try {
      const response = await profileApi.get(`/${walletAddress}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user profile');
    }
  }

  // Update user profile
  async updateUserProfile(walletAddress, updates) {
    try {
      const response = await profileApi.put(`/${walletAddress}`, updates);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update user profile');
    }
  }

  // Get user positions
  async getUserPositions(walletAddress, filters = {}) {
    try {
      const response = await profileApi.get(`/${walletAddress}/positions`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user positions');
    }
  }

  // Get user activity
  async getUserActivity(walletAddress, filters = {}) {
    try {
      const response = await profileApi.get(`/${walletAddress}/activity`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user activity');
    }
  }

  // Get user statistics
  async getUserStatistics(walletAddress) {
    try {
      const response = await profileApi.get(`/${walletAddress}/statistics`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user statistics');
    }
  }

  // Get user preferences
  async getUserPreferences(walletAddress) {
    try {
      const response = await profileApi.get(`/${walletAddress}/preferences`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user preferences');
    }
  }

  // Update user preferences
  async updateUserPreferences(walletAddress, preferences) {
    try {
      const response = await profileApi.put(`/${walletAddress}/preferences`, preferences);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update user preferences');
    }
  }

  // Get leaderboard
  async getLeaderboard(category = 'volume', limit = 50, timeframe = 'all') {
    try {
      const response = await profileApi.get(`/leaderboard/${category}`, {
        params: { limit, timeframe }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get leaderboard');
    }
  }

  // WebSocket methods for real-time updates
  subscribeToProfileUpdates(walletAddress, callback) {
    if (typeof window !== 'undefined' && window.socket) {
      window.socket.emit('subscribe_profile_updates', walletAddress);
      window.socket.on('profile_update', callback);
    }
  }

  unsubscribeFromProfileUpdates(callback) {
    if (typeof window !== 'undefined' && window.socket) {
      window.socket.off('profile_update', callback);
    }
  }

  // Helper methods
  formatCurrency(amount, currency = 'USD') {
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0.00';

    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    }

    return num.toFixed(2);
  }

  formatVolume(volume) {
    const num = parseFloat(volume);
    if (isNaN(num)) return '$0.00';

    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(2)}K`;
    }

    return `$${num.toFixed(2)}`;
  }

  formatPercentage(percentage) {
    const num = parseFloat(percentage);
    if (isNaN(num)) return '0%';

    return `${num.toFixed(1)}%`;
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatRelativeTime(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    } else if (diffInSeconds < 2592000) {
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } else {
      return this.formatDate(dateString);
    }
  }

  formatWalletAddress(address) {
    if (!address) return 'N/A';

    if (address.length <= 10) return address;

    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  getPositionTypeColor(type) {
    switch (type) {
      case 'buy':
        return '#10b981'; // green
      case 'sell':
        return '#ef4444'; // red
      case 'redeem':
        return '#3b82f6'; // blue
      default:
        return '#6b7280'; // gray
    }
  }

  getPositionTypeIcon(type) {
    switch (type) {
      case 'buy':
        return '📈';
      case 'sell':
        return '📉';
      case 'redeem':
        return '💰';
      default:
        return '📊';
    }
  }

  getMarketStatusColor(status) {
    switch (status) {
      case 'active':
        return '#10b981'; // green
      case 'resolved':
        return '#3b82f6'; // blue
      case 'cancelled':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }

  getMarketStatusText(status) {
    switch (status) {
      case 'active':
        return 'Active';
      case 'resolved':
        return 'Resolved';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }

  getCategoryColor(category) {
    const colors = {
      'politics': '#dc2626',
      'sports': '#059669',
      'crypto': '#7c3aed',
      'tech': '#0891b2',
      'culture': '#ea580c',
      'world': '#4338ca',
      'economy': '#065f46',
      'entertainment': '#be185d'
    };
    return colors[category?.toLowerCase()] || '#6b7280';
  }

  getCategoryIcon(category) {
    const icons = {
      'politics': '🏛️',
      'sports': '⚽',
      'crypto': '₿',
      'tech': '💻',
      'culture': '🎭',
      'world': '🌍',
      'economy': '💹',
      'entertainment': '🎬'
    };
    return icons[category?.toLowerCase()] || '📊';
  }

  generateAvatarUrl(walletAddress) {
    // Generate a consistent avatar URL based on wallet address
    const seed = walletAddress || 'default';
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  }

  getReputationLevel(score) {
    if (score >= 1000) return 'Legend';
    if (score >= 500) return 'Expert';
    if (score >= 250) return 'Advanced';
    if (score >= 100) return 'Intermediate';
    if (score >= 50) return 'Beginner';
    return 'Novice';
  }

  getReputationColor(score) {
    if (score >= 1000) return '#dc2626'; // red
    if (score >= 500) return '#ea580c'; // orange
    if (score >= 250) return '#d97706'; // amber
    if (score >= 100) return '#059669'; // green
    if (score >= 50) return '#0891b2'; // cyan
    return '#6b7280'; // gray
  }

  calculateProfitMargin(profitLoss, totalVolume) {
    if (!totalVolume || totalVolume === 0) return 0;
    return (profitLoss / totalVolume) * 100;
  }

  calculateROI(profitLoss, invested) {
    if (!invested || invested === 0) return 0;
    return (profitLoss / invested) * 100;
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
export default new ProfileService();