import fetch from 'node-fetch';
import { ethers } from 'ethers';

/**
 * 1inch Multi-Network Service
 * Handles 1inch API integration across multiple supported networks
 * Based on successful CLI testing logic
 */
export class OneInchMultiNetworkService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ONEINCH_API_KEY;
    this.baseUrl = 'https://api.1inch.dev/swap/v6.0';
    this.logger = config.logger || console;

    // Supported networks with their configurations
    this.networks = {
      ethereum: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        symbol: 'ETH',
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/3rsrr9Elx0nFbbl_ocL2GJch1jc3aOaN',
        nativeToken: {
          symbol: 'ETH',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      },
      arbitrum: {
        chainId: 42161,
        name: 'Arbitrum One',
        symbol: 'ETH',
        rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arbitrum-one-rpc.publicnode.com',
        nativeToken: {
          symbol: 'ETH',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      },
      optimism: {
        chainId: 10,
        name: 'Optimism',
        symbol: 'ETH',
        rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://optimism-rpc.publicnode.com',
        nativeToken: {
          symbol: 'ETH',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      },
      polygon: {
        chainId: 137,
        name: 'Polygon',
        symbol: 'MATIC',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        nativeToken: {
          symbol: 'MATIC',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      },
      base: {
        chainId: 8453,
        name: 'Base',
        symbol: 'ETH',
        rpcUrl: process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
        nativeToken: {
          symbol: 'ETH',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      },
      bnb: {
        chainId: 56,
        name: 'BNB Chain',
        symbol: 'BNB',
        rpcUrl: process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org',
        nativeToken: {
          symbol: 'BNB',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      },
      avalanche: {
        chainId: 43114,
        name: 'Avalanche',
        symbol: 'AVAX',
        rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        nativeToken: {
          symbol: 'AVAX',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      },
      gnosis: {
        chainId: 100,
        name: 'Gnosis Chain',
        symbol: 'xDAI',
        rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
        nativeToken: {
          symbol: 'xDAI',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18
        }
      }
    };

    // Cache for tokens per network with timestamps
    this.tokensCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache

    // Request queue to prevent rate limiting
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.requestDelay = 200; // 200ms between requests
    this.maxConcurrentRequests = 2; // Max 2 concurrent requests
    this.activeRequests = 0;
  }

  /**
   * Get network configuration by chain ID
   */
  getNetworkByChainId(chainId) {
    return Object.values(this.networks).find(network => network.chainId === chainId);
  }

  /**
   * Get network key by chain ID
   */
  getNetworkKeyByChainId(chainId) {
    return Object.entries(this.networks).find(([_, network]) => network.chainId === chainId)?.[0];
  }

    /**
   * Queue a request to prevent rate limiting
   */
  async _queuedAPICall(endpoint) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        endpoint,
        resolve,
        reject,
        timestamp: Date.now()
      });

      this._processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  async _processQueue() {
    if (this.isProcessingQueue || this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      this.activeRequests++;

      // Process request with delay
      this._executeAPICall(request).finally(() => {
        this.activeRequests--;
      });

      // Add delay between requests
      if (this.requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }
    }

    this.isProcessingQueue = false;

    // Continue processing if there are more requests
    if (this.requestQueue.length > 0) {
      setTimeout(() => this._processQueue(), this.requestDelay);
    }
  }

  /**
   * Execute individual API call with retry logic
   */
  async _executeAPICall(request, retryCount = 0, maxRetries = 3) {
    try {
      const response = await fetch(`${this.baseUrl}${request.endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'accept': 'application/json'
        }
      });

      if (response.status === 429 && retryCount < maxRetries) {
        // Rate limited - implement exponential backoff
        const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
        this.logger.warn(`Rate limited by 1inch API. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this._executeAPICall(request, retryCount + 1, maxRetries);
      }

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`1inch API error ${response.status}:`, errorData);
        throw new Error(`1inch API error ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      request.resolve(data);
      return data;
    } catch (error) {
      if (retryCount < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
        // Network error - retry
        const delay = Math.pow(2, retryCount) * 1000;
        this.logger.warn(`Network error. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this._executeAPICall(request, retryCount + 1, maxRetries);
      }

      request.reject(error);
      throw error;
    }
  }

  /**
   * Make API call to 1inch with queuing
   */
  async _callAPI(endpoint) {
    return this._queuedAPICall(endpoint);
  }

    /**
   * Get available tokens for a network
   */
  async getTokens(chainId) {
    // Check cache first with timestamp
    const cacheKey = `tokens_${chainId}`;
    const cached = this.tokensCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      this.logger.info(`Returning cached tokens for chain ${chainId} (${Object.keys(cached.data).length} tokens)`);
      return cached.data;
    }

    try {
      this.logger.info(`Fetching tokens for chain ${chainId} from 1inch API`);
      const data = await this._callAPI(`/${chainId}/tokens`);

      // Cache the result with timestamp
      this.tokensCache.set(cacheKey, {
        data: data.tokens,
        timestamp: Date.now()
      });

      this.logger.info(`Found ${Object.keys(data.tokens).length} tokens for chain ${chainId}`);
      return data.tokens;
    } catch (error) {
      this.logger.error(`Failed to fetch tokens for chain ${chainId}:`, error);

      // If we have stale cache data, return it as fallback
      if (cached) {
        this.logger.warn(`Returning stale cached tokens for chain ${chainId} due to API error`);
        return cached.data;
      }

      throw error;
    }
  }

  /**
   * Get swap quote
   */
  async getQuote({ chainId, src, dst, amount }) {
    try {
      const params = new URLSearchParams({
        src,
        dst,
        amount: amount.toString()
      });

      this.logger.info(`Getting quote for chain ${chainId}:`, { src, dst, amount });
      const quote = await this._callAPI(`/${chainId}/quote?${params}`);

      this.logger.info(`Quote received:`, {
        dstAmount: quote.dstAmount,
        estimatedGas: quote.estimatedGas
      });

      return {
        success: true,
        quote
      };
    } catch (error) {
      this.logger.error(`Failed to get quote for chain ${chainId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build swap transaction
   */
  async buildSwap({ chainId, src, dst, amount, from, slippage = 1 }) {
    try {
      const params = new URLSearchParams({
        src,
        dst,
        amount: amount.toString(),
        from,
        slippage: slippage.toString(),
        disableEstimate: 'false'
      });

      this.logger.info(`Building swap transaction for chain ${chainId}:`, { src, dst, amount, from, slippage });
      const swapData = await this._callAPI(`/${chainId}/swap?${params}`);

      this.logger.info(`Swap transaction built:`, {
        to: swapData.tx.to,
        gas: swapData.tx.gas,
        value: swapData.tx.value
      });

      return {
        success: true,
        swap: swapData
      };
    } catch (error) {
      this.logger.error(`Failed to build swap transaction for chain ${chainId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get token price in USD
   */
  async getTokenPrice(chainId, tokenAddresses) {
    try {
      // 1inch doesn't have a direct price endpoint in v6.0
      // For now, return placeholder prices
      // In production, you'd integrate with a price feed service
      const prices = {};
      for (const address of tokenAddresses) {
        prices[address] = '1.00'; // Placeholder
      }
      return prices;
    } catch (error) {
      this.logger.error(`Failed to get token prices for chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Get popular tokens for a network
   */
  async getPopularTokens(chainId) {
    const allTokens = await this.getTokens(chainId);
    const popularSymbols = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI', 'WETH', 'UNI', 'LINK', 'ARB', 'OP', 'MATIC', 'AVAX'];

    const popular = [];
    for (const symbol of popularSymbols) {
      const token = Object.values(allTokens).find(t => t.symbol === symbol);
      if (token) {
        popular.push(token);
      }
    }

    return popular.slice(0, 10); // Return top 10
  }

  /**
   * Clear token cache (useful for testing or updates)
   */
  clearCache() {
    this.tokensCache.clear();
    this.logger.info('Cleared tokens cache');
  }

  /**
   * Health check for the service
   */
  async healthCheck() {
    try {
      // Test with Ethereum mainnet
      const tokens = await this.getTokens(1);
      return {
        status: 'healthy',
        networksCount: Object.keys(this.networks).length,
        ethereumTokensCount: Object.keys(tokens).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}