const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const BridgeProviderInterface = require('../interfaces/bridgeProviderInterface');

class BridgeManagerService extends EventEmitter {
  constructor() {
    super();
    this.providers = new Map();
    this.defaultProvider = null;
    this.initialized = false;
  }

  /**
   * Initialize the bridge manager with providers
   * @param {Array<Object>} providerConfigs - Array of provider configurations
   */
  async initialize(providerConfigs = []) {
    try {
      // Register default native bridge provider
      const nativeBridgeService = require('./nativeBridgeService');
      await this.registerProvider('native-mantle', nativeBridgeService);
      this.defaultProvider = 'native-mantle';

      // Register additional providers from config
      for (const config of providerConfigs) {
        await this.registerProvider(config.name, config.provider);
      }

      this.initialized = true;
      logger.info('Bridge manager initialized with providers:', Array.from(this.providers.keys()));
    } catch (error) {
      logger.error('Failed to initialize bridge manager:', error);
      throw error;
    }
  }

  /**
   * Register a bridge provider
   * @param {string} name - Provider name
   * @param {Object} provider - Provider instance
   */
  async registerProvider(name, provider) {
    try {
      // Validate provider implements required interface
      if (!this.isValidProvider(provider)) {
        throw new Error(`Provider ${name} does not implement required interface`);
      }

      // Initialize provider if not already initialized
      if (!provider.initialized && typeof provider.initialize === 'function') {
        await provider.initialize();
      }

      this.providers.set(name, provider);
      logger.info(`Registered bridge provider: ${name}`);
    } catch (error) {
      logger.error(`Failed to register provider ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a bridge provider by name
   * @param {string} name - Provider name
   * @returns {Object} Provider instance
   */
  getProvider(name) {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Bridge provider ${name} not found`);
    }
    return provider;
  }

  /**
   * Get the best provider for a specific route
   * @param {string} sourceChain - Source chain identifier
   * @param {string} destinationChain - Destination chain identifier
   * @param {string} token - Token address or symbol
   * @returns {Object} Best provider for the route
   */
  async getBestProvider(sourceChain, destinationChain, token) {
    try {
      const routeProviders = [];

      // Check each provider for route support
      for (const [name, provider] of this.providers) {
        try {
          const supportedChains = await provider.getSupportedChains();
          const supportsRoute = this.supportsRoute(supportedChains, sourceChain, destinationChain);

          if (supportsRoute) {
            const quote = await provider.getQuote({
              sourceChain,
              destinationChain,
              token,
              amount: '1' // Dummy amount for comparison
            });

            routeProviders.push({
              name,
              provider,
              quote,
              score: this.calculateProviderScore(quote)
            });
          }
        } catch (error) {
          logger.warn(`Provider ${name} failed route check:`, error.message);
        }
      }

      if (routeProviders.length === 0) {
        throw new Error('No providers support this route');
      }

      // Sort by score (lower is better)
      routeProviders.sort((a, b) => a.score - b.score);

      return routeProviders[0].provider;
    } catch (error) {
      logger.error('Failed to get best provider:', error);
      // Fall back to default provider
      return this.getProvider(this.defaultProvider);
    }
  }

  /**
   * Get bridge quote from the best provider
   * @param {Object} params - Quote parameters
   * @returns {Promise<Object>} Quote object
   */
  async getQuote(params) {
    try {
      const provider = await this.getBestProvider(
        params.sourceChain,
        params.destinationChain,
        params.token
      );

      const quote = await provider.getQuote(params);

      return {
        ...quote,
        provider: provider.name || 'unknown',
        providerId: Array.from(this.providers.entries())
          .find(([_, p]) => p === provider)?.[0]
      };
    } catch (error) {
      logger.error('Failed to get bridge quote:', error);
      throw error;
    }
  }

  /**
   * Execute bridge transaction
   * @param {Object} params - Bridge parameters
   * @param {string} providerName - Optional specific provider name
   * @returns {Promise<Object>} Bridge result
   */
  async executeBridge(params, providerName = null) {
    try {
      let provider;

      if (providerName) {
        provider = this.getProvider(providerName);
      } else {
        provider = await this.getBestProvider(
          params.sourceChain,
          params.destinationChain,
          params.token
        );
      }

      const result = await provider.executeBridge(params);

      return {
        ...result,
        provider: provider.name || 'unknown',
        providerId: Array.from(this.providers.entries())
          .find(([_, p]) => p === provider)?.[0]
      };
    } catch (error) {
      logger.error('Failed to execute bridge:', error);
      throw error;
    }
  }

  /**
   * Get bridge status from appropriate provider
   * @param {string} bridgeId - Bridge transaction ID
   * @param {string} providerName - Optional specific provider name
   * @returns {Promise<Object>} Bridge status
   */
  async getBridgeStatus(bridgeId, providerName = null) {
    try {
      if (providerName) {
        const provider = this.getProvider(providerName);
        return await provider.getBridgeStatus(bridgeId);
      }

      // Try each provider until one recognizes the bridge ID
      for (const [name, provider] of this.providers) {
        try {
          const status = await provider.getBridgeStatus(bridgeId);
          return {
            ...status,
            provider: name
          };
        } catch (error) {
          // Continue to next provider
          continue;
        }
      }

      throw new Error('Bridge transaction not found in any provider');
    } catch (error) {
      logger.error('Failed to get bridge status:', error);
      throw error;
    }
  }

  /**
   * Get user bridge history from all providers
   * @param {string} userAddress - User's wallet address
   * @param {number} limit - Number of records to return
   * @returns {Promise<Array<Object>>} Combined bridge history
   */
  async getUserBridgeHistory(userAddress, limit = 50) {
    try {
      const allHistory = [];

      // Get history from all providers
      for (const [name, provider] of this.providers) {
        try {
          const history = await provider.getUserBridgeHistory(userAddress, limit);
          const historyWithProvider = history.map(record => ({
            ...record,
            provider: name
          }));
          allHistory.push(...historyWithProvider);
        } catch (error) {
          logger.warn(`Failed to get history from provider ${name}:`, error.message);
        }
      }

      // Sort by creation date (most recent first)
      allHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Limit results
      return allHistory.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get user bridge history:', error);
      throw error;
    }
  }

  /**
   * Get combined bridge statistics from all providers
   * @returns {Promise<Object>} Combined statistics
   */
  async getBridgeStats() {
    try {
      const stats = {
        totalBridges: 0,
        completedBridges: 0,
        pendingBridges: 0,
        failedBridges: 0,
        totalVolume: '0',
        providers: {}
      };

      // Get stats from all providers
      for (const [name, provider] of this.providers) {
        try {
          const providerStats = await provider.getBridgeStats();
          stats.providers[name] = providerStats;

          // Aggregate totals
          stats.totalBridges += providerStats.totalBridges || 0;
          stats.completedBridges += providerStats.completedBridges || 0;
          stats.pendingBridges += providerStats.pendingBridges || 0;
          stats.failedBridges += providerStats.failedBridges || 0;
          stats.totalVolume = (
            parseFloat(stats.totalVolume) + parseFloat(providerStats.totalVolume || '0')
          ).toString();
        } catch (error) {
          logger.warn(`Failed to get stats from provider ${name}:`, error.message);
          stats.providers[name] = { error: error.message };
        }
      }

      // Calculate success rate
      stats.successRate = stats.totalBridges > 0 ?
        (stats.completedBridges / stats.totalBridges * 100).toFixed(2) : 0;

      return stats;
    } catch (error) {
      logger.error('Failed to get bridge statistics:', error);
      throw error;
    }
  }

  /**
   * Get supported chains from all providers
   * @returns {Promise<Array<Object>>} All supported chains
   */
  async getSupportedChains() {
    try {
      const allChains = new Map();

      // Get chains from all providers
      for (const [name, provider] of this.providers) {
        try {
          const chains = await provider.getSupportedChains();
          chains.forEach(chain => {
            const existing = allChains.get(chain.id);
            if (!existing) {
              allChains.set(chain.id, { ...chain, providers: [name] });
            } else {
              existing.providers.push(name);
            }
          });
        } catch (error) {
          logger.warn(`Failed to get chains from provider ${name}:`, error.message);
        }
      }

      return Array.from(allChains.values());
    } catch (error) {
      logger.error('Failed to get supported chains:', error);
      throw error;
    }
  }

  /**
   * Get health status of all providers
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    try {
      const status = {
        bridgeManager: {
          initialized: this.initialized,
          providersCount: this.providers.size,
          defaultProvider: this.defaultProvider
        },
        providers: {}
      };

      // Get status from all providers
      for (const [name, provider] of this.providers) {
        try {
          if (typeof provider.getHealthStatus === 'function') {
            status.providers[name] = await provider.getHealthStatus();
          } else if (typeof provider.getStatus === 'function') {
            status.providers[name] = await provider.getStatus();
          } else {
            status.providers[name] = { status: 'unknown' };
          }
        } catch (error) {
          status.providers[name] = { status: 'error', error: error.message };
        }
      }

      return status;
    } catch (error) {
      logger.error('Failed to get health status:', error);
      throw error;
    }
  }

  /**
   * Check if provider implements required interface
   * @param {Object} provider - Provider instance
   * @returns {boolean} Whether provider is valid
   */
  isValidProvider(provider) {
    const requiredMethods = [
      'getSupportedChains',
      'getQuote',
      'executeBridge',
      'getBridgeStatus',
      'getUserBridgeHistory'
    ];

    return requiredMethods.every(method => typeof provider[method] === 'function');
  }

  /**
   * Check if provider supports a specific route
   * @param {Array<Object>} supportedChains - Provider's supported chains
   * @param {string} sourceChain - Source chain identifier
   * @param {string} destinationChain - Destination chain identifier
   * @returns {boolean} Whether route is supported
   */
  supportsRoute(supportedChains, sourceChain, destinationChain) {
    const sourceSupported = supportedChains.some(chain =>
      chain.id === sourceChain || chain.chainId === sourceChain
    );
    const destinationSupported = supportedChains.some(chain =>
      chain.id === destinationChain || chain.chainId === destinationChain
    );

    return sourceSupported && destinationSupported;
  }

  /**
   * Calculate provider score for route optimization
   * @param {Object} quote - Provider quote
   * @returns {number} Provider score (lower is better)
   */
  calculateProviderScore(quote) {
    // Score based on fees, time, and reliability
    const feeScore = parseFloat(quote.estimatedFee || '0') * 1000;
    const timeScore = this.parseEstimatedTime(quote.estimatedTime) * 10;
    const reliabilityScore = 0; // Could be based on historical data

    return feeScore + timeScore + reliabilityScore;
  }

  /**
   * Parse estimated time string to minutes
   * @param {string} timeStr - Time string (e.g., "10-15 minutes", "7 days")
   * @returns {number} Time in minutes
   */
  parseEstimatedTime(timeStr) {
    if (!timeStr) return 0;

    if (timeStr.includes('minutes')) {
      const match = timeStr.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } else if (timeStr.includes('hours')) {
      const match = timeStr.match(/(\d+)/);
      return match ? parseInt(match[1]) * 60 : 0;
    } else if (timeStr.includes('days')) {
      const match = timeStr.match(/(\d+)/);
      return match ? parseInt(match[1]) * 1440 : 0;
    }

    return 0;
  }

  /**
   * Stop all providers and clean up
   */
  async stop() {
    try {
      for (const [name, provider] of this.providers) {
        try {
          if (typeof provider.stop === 'function') {
            await provider.stop();
          }
        } catch (error) {
          logger.warn(`Failed to stop provider ${name}:`, error.message);
        }
      }

      this.providers.clear();
      this.initialized = false;
      logger.info('Bridge manager stopped');
    } catch (error) {
      logger.error('Failed to stop bridge manager:', error);
    }
  }
}

module.exports = new BridgeManagerService();