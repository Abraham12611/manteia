import { CetusClmmSDK, initCetusSDK, Percentage, adjustForSlippage, d } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import BN from 'bn.js';

/**
 * Enhanced Cetus Service - Extends basic DEX operations with automatic token discovery
 * for unified cross-chain swap system
 * Based on official Cetus SDK documentation
 * @see https://docs.cetus.zone/developer/sui-contracts
 */
export class EnhancedCetusService {
  constructor({ network = 'testnet', logger }) {
    this.network = network;
    this.logger = logger;
    this.sdk = null;
    this.suiClient = null;
    this.initialized = false;

    // Network-specific configurations from official docs
    this.config = {
      testnet: {
        fullNodeUrl: 'https://fullnode.testnet.sui.io',
        globalConfig: '0x9774e359588ead122af1c7e7f64e14ade261cfeecdb5d0eb4a5b3b4c8ab8bd3e',
        packageId: '0xb2a1d27337788bda89d350703b8326952413bd94b35b9b573ac8401b9803d018',
        pools: {
          // Common USDC/SUI pool configurations
          USDC_SUI: process.env.CETUS_POOL_USDC_SUI || '0x...' // Will need actual pool address
        }
      },
      mainnet: {
        fullNodeUrl: 'https://fullnode.mainnet.sui.io',
        globalConfig: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
        packageId: '0x75b2e9ecad34944b8d0c874e568c90db0cf9437f0d7392abfd4cb902972f3e40',
        pools: {
          USDC_SUI: process.env.CETUS_POOL_USDC_SUI || '0x...'
        }
      }
    };

    // Common Sui tokens with their addresses and metadata
    this.commonTokens = {
      testnet: {
        SUI: {
          address: '0x2::sui::SUI',
          symbol: 'SUI',
          name: 'Sui',
          decimals: 9,
          logoURI: 'https://raw.githubusercontent.com/sui-foundation/sui/main/apps/wallet/src/ui/assets/sui-logo.svg'
        },
        USDC: {
          address: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png'
        },
        USDT: {
          address: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether.png'
        },
        WETH: {
          address: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN',
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          logoURI: 'https://assets.coingecko.com/coins/images/2518/large/weth.png'
        },
        CETUS: {
          address: '0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
          symbol: 'CETUS',
          name: 'Cetus',
          decimals: 9,
          logoURI: 'https://assets.coingecko.com/coins/images/28600/large/cetus.png'
        },
        XCETUS: {
          address: '0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS',
          symbol: 'XCETUS',
          name: 'xCetus',
          decimals: 9,
          logoURI: 'https://assets.coingecko.com/coins/images/28600/large/cetus.png'
        }
      },
      mainnet: {
        SUI: {
          address: '0x2::sui::SUI',
          symbol: 'SUI',
          name: 'Sui',
          decimals: 9,
          logoURI: 'https://raw.githubusercontent.com/sui-foundation/sui/main/apps/wallet/src/ui/assets/sui-logo.svg'
        },
        USDC: {
          address: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png'
        },
        USDT: {
          address: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether.png'
        },
        WETH: {
          address: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN',
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          logoURI: 'https://assets.coingecko.com/coins/images/2518/large/weth.png'
        },
        CETUS: {
          address: '0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
          symbol: 'CETUS',
          name: 'Cetus',
          decimals: 9,
          logoURI: 'https://assets.coingecko.com/coins/images/28600/large/cetus.png'
        },
        XCETUS: {
          address: '0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS',
          symbol: 'XCETUS',
          name: 'xCetus',
          decimals: 9,
          logoURI: 'https://assets.coingecko.com/coins/images/28600/large/cetus.png'
        }
      }
    };

    // Cache for discovered tokens
    this.tokenCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Initialize Cetus SDK
   */
  async initialize() {
    try {
      this.logger.info('Initializing Enhanced Cetus SDK...');

      const networkConfig = this.config[this.network];

      // Initialize Sui client
      this.suiClient = new SuiClient({
        url: networkConfig.fullNodeUrl
      });

      // Initialize Cetus SDK
      this.sdk = initCetusSDK({
        network: this.network,
        fullNodeUrl: networkConfig.fullNodeUrl,
        simulationAccount: {
          address: "0x326ce9894f08dcaa337fa232641cc34db957aec9ff6614c1186bc9a7508df0bb"
        }
      });

      this.logger.info(`Enhanced Cetus SDK initialized for ${this.network}`);
      this.initialized = true;

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Cetus SDK:', error);
      return false;
    }
  }

  /**
   * Get all available tokens on Sui from Cetus pools
   * Based on official Cetus SDK documentation - getPoolsWithPage()
   * @returns {Promise<Array>} Array of token objects
   */
  async getAllTokens() {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Cetus Service not initialized');
      }

      // Check cache first
      const cacheKey = `tokens_${this.network}`;
      const cached = this.tokenCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        this.logger.info(`Returning cached tokens for ${this.network} (${cached.data.length} tokens)`);
        return cached.data;
      }

      this.logger.info(`Fetching all tokens from Cetus pools on ${this.network}...`);

      // Get all pools from Cetus using getPoolsWithPage()
      const pools = await this.sdk.Pool.getPoolsWithPage();

      // Extract unique tokens from all pools
      const tokenSet = new Set();
      const tokenMap = new Map();

      for (const pool of pools) {
        // Add coin type A
        if (!tokenSet.has(pool.coinTypeA)) {
          tokenSet.add(pool.coinTypeA);
          const tokenInfo = this._parseTokenFromCoinType(pool.coinTypeA);
          if (tokenInfo) {
            tokenMap.set(pool.coinTypeA, tokenInfo);
          }
        }

        // Add coin type B
        if (!tokenSet.has(pool.coinTypeB)) {
          tokenSet.add(pool.coinTypeB);
          const tokenInfo = this._parseTokenFromCoinType(pool.coinTypeB);
          if (tokenInfo) {
            tokenMap.set(pool.coinTypeB, tokenInfo);
          }
        }
      }

      // Convert to array
      const discoveredTokens = Array.from(tokenMap.values());

      // Add common tokens that might not be in pools yet
      const commonTokens = Object.values(this.commonTokens[this.network]);
      for (const commonToken of commonTokens) {
        if (!tokenSet.has(commonToken.address)) {
          discoveredTokens.push(commonToken);
        }
      }

      // Cache the result
      this.tokenCache.set(cacheKey, {
        data: discoveredTokens,
        timestamp: Date.now()
      });

      this.logger.info(`Found ${discoveredTokens.length} tokens on ${this.network}`);
      return discoveredTokens;

    } catch (error) {
      this.logger.error('Error fetching Cetus tokens:', error);

      // Fallback to common tokens
      const fallbackTokens = Object.values(this.commonTokens[this.network]);
      this.logger.info(`Using fallback tokens: ${fallbackTokens.length} common tokens`);
      return fallbackTokens;
    }
  }

  /**
   * Get tokens by searching pools with specific coin types
   * @param {Array} coinTypes - Array of coin types to search for
   * @returns {Promise<Array>} Array of token objects
   */
  async getTokensByCoins(coinTypes) {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Cetus Service not initialized');
      }

      this.logger.info(`Searching for tokens by coin types: ${coinTypes.join(', ')}`);

      const pools = await this.sdk.Pool.getPoolByCoins(coinTypes);
      const tokens = [];

      for (const pool of pools) {
        const tokenA = this._parseTokenFromCoinType(pool.coinTypeA);
        const tokenB = this._parseTokenFromCoinType(pool.coinTypeB);

        if (tokenA) tokens.push(tokenA);
        if (tokenB) tokens.push(tokenB);
      }

      // Remove duplicates
      const uniqueTokens = tokens.filter((token, index, self) =>
        index === self.findIndex(t => t.address === token.address)
      );

      this.logger.info(`Found ${uniqueTokens.length} tokens for specified coin types`);
      return uniqueTokens;

    } catch (error) {
      this.logger.error('Error fetching tokens by coins:', error);
      return [];
    }
  }

  /**
   * Search tokens by symbol or name
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching tokens
   */
  async searchTokens(query) {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      const allTokens = await this.getAllTokens();
      const lowercaseQuery = query.toLowerCase();

      return allTokens.filter(token =>
        token.symbol.toLowerCase().includes(lowercaseQuery) ||
        token.name.toLowerCase().includes(lowercaseQuery)
      );

    } catch (error) {
      this.logger.error('Error searching tokens:', error);
      return [];
    }
  }

  /**
   * Get token by address
   * @param {string} address - Token address
   * @returns {Promise<Object|null>} Token object or null
   */
  async getTokenByAddress(address) {
    try {
      const allTokens = await this.getAllTokens();
      return allTokens.find(token => token.address.toLowerCase() === address.toLowerCase()) || null;
    } catch (error) {
      this.logger.error('Error getting token by address:', error);
      return null;
    }
  }

  /**
   * Get token by symbol
   * @param {string} symbol - Token symbol
   * @returns {Promise<Object|null>} Token object or null
   */
  async getTokenBySymbol(symbol) {
    try {
      const allTokens = await this.getAllTokens();
      return allTokens.find(token => token.symbol.toLowerCase() === symbol.toLowerCase()) || null;
    } catch (error) {
      this.logger.error('Error getting token by symbol:', error);
      return null;
    }
  }

  /**
   * Get swap quote for token pair
   * @param {Object} params - Quote parameters
   * @param {string} params.fromToken - From token address
   * @param {string} params.toToken - To token address
   * @param {string} params.amount - Amount to swap
   * @param {number} params.slippage - Slippage tolerance
   * @returns {Promise<Object>} Quote result
   */
  async getSwapQuote(params) {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Cetus Service not initialized');
      }

      const { fromToken, toToken, amount, slippage = 0.5 } = params;

      this.logger.info(`Getting swap quote: ${amount} ${fromToken} -> ${toToken}`);

      // Find best pool for the token pair
      const pool = await this._findBestPool(fromToken, toToken);
      if (!pool) {
        throw new Error(`No pool found for ${fromToken} -> ${toToken}`);
      }

      // Calculate swap
      const swapResult = await this._calculateSwap({
        poolId: pool.poolId,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        a2b: pool.coinTypeA === fromToken,
        byAmountIn: true,
        amount: amount,
        slippage: slippage
      });

      return {
        success: true,
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: swapResult.estimatedAmountOut,
        fee: swapResult.fee,
        priceImpact: swapResult.priceImpact,
        poolId: pool.poolId
      };

    } catch (error) {
      this.logger.error('Failed to get swap quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute swap transaction
   * @param {Object} params - Swap parameters
   * @param {string} params.fromToken - From token address
   * @param {string} params.toToken - To token address
   * @param {string} params.amount - Amount to swap
   * @param {number} params.slippage - Slippage tolerance
   * @param {string} params.recipient - Recipient address
   * @param {Object} params.signer - Transaction signer
   * @returns {Promise<Object>} Swap result
   */
  async executeSwap(params) {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Cetus Service not initialized');
      }

      const { fromToken, toToken, amount, slippage = 0.5, recipient, signer } = params;

      this.logger.info(`Executing swap: ${amount} ${fromToken} -> ${toToken}`);

      // Get quote first
      const quote = await this.getSwapQuote({
        fromToken,
        toToken,
        amount,
        slippage
      });

      if (!quote.success) {
        throw new Error(`Failed to get quote: ${quote.error}`);
      }

      // Find best pool
      const pool = await this._findBestPool(fromToken, toToken);
      if (!pool) {
        throw new Error(`No pool found for ${fromToken} -> ${toToken}`);
      }

      // Calculate swap with slippage
      const slippagePercentage = new Percentage(slippage, 100);
      const amountLimit = adjustForSlippage(d(quote.toAmount), slippagePercentage, false);

      // Create swap transaction
      const swapParams = {
        pool_id: pool.poolId,
        coin_type_a: pool.coinTypeA,
        coin_type_b: pool.coinTypeB,
        a2b: pool.coinTypeA === fromToken,
        by_amount_in: true,
        amount: amount,
        amount_limit: amountLimit.toString(),
        slippage: slippage
      };

      // Execute swap
      const swapResult = await this.sdk.Swap.swap(swapParams, signer);

      this.logger.info(`Swap executed successfully:`, {
        transactionDigest: swapResult.transactionDigest,
        fromAmount: amount,
        toAmount: quote.toAmount
      });

      return {
        success: true,
        transactionDigest: swapResult.transactionDigest,
        fromAmount: amount,
        toAmount: quote.toAmount,
        fee: quote.fee,
        priceImpact: quote.priceImpact
      };

    } catch (error) {
      this.logger.error('Failed to execute swap:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get popular tokens (most liquid)
   * @returns {Promise<Array>} Array of popular tokens
   */
  async getPopularTokens() {
    try {
      const allTokens = await this.getAllTokens();

      // Define popular token symbols
      const popularSymbols = ['SUI', 'USDC', 'USDT', 'WETH', 'CETUS', 'XCETUS'];

      const popular = [];
      for (const symbol of popularSymbols) {
        const token = allTokens.find(t => t.symbol === symbol);
        if (token) {
          popular.push(token);
        }
      }

      return popular;
    } catch (error) {
      this.logger.error('Error getting popular tokens:', error);
      return [];
    }
  }

  /**
   * Clear token cache
   */
  clearCache() {
    this.tokenCache.clear();
    this.logger.info('Cleared token cache');
  }

  /**
   * Parse token information from coin type
   * @private
   */
  _parseTokenFromCoinType(coinType) {
    try {
      // Parse coin type to extract symbol and name
      const parts = coinType.split('::');
      if (parts.length < 3) return null;

      const symbol = parts[parts.length - 1] || 'UNKNOWN';
      const name = parts[parts.length - 2] || 'Unknown Token';

      return {
        address: coinType,
        symbol,
        name,
        decimals: this._getTokenDecimals(symbol),
        chainId: 21, // Sui chain ID
        logoURI: this._getTokenLogo(symbol)
      };
    } catch (error) {
      this.logger.warn(`Failed to parse coin type: ${coinType}`, error);
      return null;
    }
  }

  /**
   * Get token decimals based on symbol
   * @private
   */
  _getTokenDecimals(symbol) {
    const decimalsMap = {
      'SUI': 9,
      'USDC': 6,
      'USDT': 6,
      'WETH': 18,
      'CETUS': 9,
      'XCETUS': 9,
      'WBTC': 8,
      'WAVAX': 18,
      'WFTM': 18,
      'WGLMR': 18,
      'WSOL': 9
    };

    return decimalsMap[symbol] || 9; // Default to 9 for Sui tokens
  }

  /**
   * Get token logo URL
   * @private
   */
  _getTokenLogo(symbol) {
    const logoMap = {
      'SUI': 'https://raw.githubusercontent.com/sui-foundation/sui/main/apps/wallet/src/ui/assets/sui-logo.svg',
      'USDC': 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
      'USDT': 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
      'WETH': 'https://assets.coingecko.com/coins/images/2518/large/weth.png',
      'CETUS': 'https://assets.coingecko.com/coins/images/28600/large/cetus.png',
      'XCETUS': 'https://assets.coingecko.com/coins/images/28600/large/cetus.png'
    };

    return logoMap[symbol] || '';
  }

  /**
   * Find best pool for token pair
   * @private
   */
  async _findBestPool(tokenA, tokenB) {
    try {
      const pools = await this.sdk.Pool.getPoolList(tokenA, tokenB);

      if (!pools || pools.length === 0) {
        return null;
      }

      // For now, return the first pool
      // In production, you'd want to find the pool with best liquidity/price
      return {
        poolId: pools[0].poolId,
        coinTypeA: pools[0].coinTypeA,
        coinTypeB: pools[0].coinTypeB,
        feeRate: pools[0].feeRate
      };
    } catch (error) {
      this.logger.error('Error finding best pool:', error);
      return null;
    }
  }

  /**
   * Calculate swap parameters
   * @private
   */
  async _calculateSwap(params) {
    try {
      const { poolId, coinTypeA, coinTypeB, a2b, byAmountIn, amount, slippage } = params;

      const swapParams = {
        pool_id: poolId,
        coin_type_a: coinTypeA,
        coin_type_b: coinTypeB,
        a2b,
        by_amount_in: byAmountIn,
        amount: amount,
        slippage: slippage
      };

      const result = await this.sdk.Swap.preSwap(swapParams);

      return {
        estimatedAmountIn: result.estimatedAmountIn,
        estimatedAmountOut: result.estimatedAmountOut,
        fee: result.fee,
        priceImpact: result.priceImpact || 0
      };
    } catch (error) {
      this.logger.error('Error calculating swap:', error);
      throw error;
    }
  }
}