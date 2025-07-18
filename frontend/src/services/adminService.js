import axios from 'axios';

// Create axios instance for admin API
const adminApi = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/api/admin`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and auth
adminApi.interceptors.request.use(
  (config) => {
    console.log(`[Admin API Request] ${config.method?.toUpperCase()} ${config.url}`);

    // Add auth token if available
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('[Admin API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
adminApi.interceptors.response.use(
  (response) => {
    console.log(`[Admin API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[Admin API Response Error]', error.response?.data || error.message);

    // Handle auth errors
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }

    return Promise.reject(error);
  }
);

class AdminService {
  constructor() {
    this.token = localStorage.getItem('adminToken');
  }

  // Authentication
  async login(username, password) {
    try {
      const response = await adminApi.post('/login', {
        username,
        password
      });

      if (response.data.success && response.data.token) {
        this.token = response.data.token;
        localStorage.setItem('adminToken', this.token);
        return { success: true, token: this.token };
      }

      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      throw this.handleError(error, 'Login failed');
    }
  }

  async logout() {
    try {
      // Call logout endpoint if available
      await adminApi.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless
      this.token = null;
      localStorage.removeItem('adminToken');
    }
  }

  async verifyToken() {
    try {
      const response = await adminApi.get('/verify');
      return response.data.success;
    } catch (error) {
      this.logout();
      return false;
    }
  }

  // Market Management
  async createMarket(marketData) {
    try {
      const response = await adminApi.post('/markets', marketData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create market');
    }
  }

  async updateMarket(marketId, marketData) {
    try {
      const response = await adminApi.put(`/markets/${marketId}`, marketData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update market');
    }
  }

  async deleteMarket(marketId) {
    try {
      const response = await adminApi.delete(`/markets/${marketId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to delete market');
    }
  }

  async getMarkets(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await adminApi.get(`/markets?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get markets');
    }
  }

  async getMarketById(marketId) {
    try {
      const response = await adminApi.get(`/markets/${marketId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market');
    }
  }

  async resolveMarket(marketId, outcome, resolutionDetails) {
    try {
      const response = await adminApi.post(`/markets/${marketId}/resolve`, {
        outcome,
        resolutionDetails
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to resolve market');
    }
  }

  // Statistics and Analytics
  async getMarketStats() {
    try {
      const response = await adminApi.get('/stats/markets');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get market statistics');
    }
  }

  async getTradingStats() {
    try {
      const response = await adminApi.get('/stats/trading');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get trading statistics');
    }
  }

  async getUserStats() {
    try {
      const response = await adminApi.get('/stats/users');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user statistics');
    }
  }

  async getSystemStats() {
    try {
      const response = await adminApi.get('/stats/system');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get system statistics');
    }
  }

  // User Management
  async getUsers(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await adminApi.get(`/users?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get users');
    }
  }

  async getUserById(userId) {
    try {
      const response = await adminApi.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user');
    }
  }

  async suspendUser(userId, reason) {
    try {
      const response = await adminApi.post(`/users/${userId}/suspend`, { reason });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to suspend user');
    }
  }

  async unsuspendUser(userId) {
    try {
      const response = await adminApi.post(`/users/${userId}/unsuspend`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to unsuspend user');
    }
  }

  // Trading Management
  async getOrders(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await adminApi.get(`/orders?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get orders');
    }
  }

  async getTrades(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await adminApi.get(`/trades?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get trades');
    }
  }

  async cancelOrder(orderId, reason) {
    try {
      const response = await adminApi.post(`/orders/${orderId}/cancel`, { reason });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to cancel order');
    }
  }

  // System Management
  async getSystemHealth() {
    try {
      const response = await adminApi.get('/system/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get system health');
    }
  }

  async getSystemLogs(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await adminApi.get(`/system/logs?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get system logs');
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

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token;
  }

  // Get current token
  getToken() {
    return this.token;
  }
}

// Create singleton instance
const adminService = new AdminService();

export default adminService;