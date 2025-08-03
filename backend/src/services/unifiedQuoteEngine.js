import { OneInchMultiNetworkService } from './oneInchMultiNetworkService.js';
import { EnhancedCetusService } from './enhancedCetusService.js';
import { EnhancedWormholeService } from './enhancedWormholeService.js';

/**
 * Unified Quote Engine - Combines 1inch, Cetus, and Wormhole services
 * to provide seamless cross-chain and same-chain swap quotes
 */
export class UnifiedQuoteEngine {
  constructor({ logger, network = 'testnet' }) {
    this.logger = logger;
    this.network = network;

    // Initialize services
    this.oneInchService = new OneInchMultiNetworkService({
      apiKey: process.env.ONEINCH_API_KEY || 'OXORyGCQaZWg7NKa4gniPZnaLuGutkyu',
      logger
    });

    this.cetusService = new EnhancedCetusService({
      network,
      logger
    });

    this.wormholeService = new EnhancedWormholeService({
      network: network === 'testnet' ? 'Testnet' : 'Mainnet',
      logger
    });

    this.initialized = false;
  }

  /**
   * Initialize all services
   */
  async initialize() {
    try {
      this.logger.info('Initializing Unified Quote Engine...');

      // Initialize Cetus service
      await this.cetusService.initialize();

      // Initialize Wormhole service
      await this.wormholeService.initialize();

      // 1inch service doesn't need explicit initialization
      this.initialized = true;

      this.logger.info('Unified Quote Engine initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Unified Quote Engine:', error);
      return false;
    }
  }

  /**
   * Get unified quote for any swap (same-chain or cross-chain)
   * @param {Object} params - Quote parameters
   * @param {string} params.fromChain - Source chain (ethereum, arbitrum, optimism, polygon, sui)
   * @param {string} params.toChain - Destination chain
   * @param {string} params.fromToken - From token symbol or address
   * @param {string} params.toToken - To token symbol or address
   * @param {string} params.amount - Amount to swap
   * @param {number} params.slippage - Slippage tolerance (default: 0.5)
   * @returns {Promise<Object>} Unified quote result
   */
  async getQuote(params) {
    try {
      if (!this.initialized) {
        throw new Error('Unified Quote Engine not initialized');
      }

      const { fromChain, toChain, fromToken, toToken, amount, slippage = 0.5 } = params;

      this.logger.info(`Getting unified quote: ${amount} ${fromToken} (${fromChain}) -> ${toToken} (${toChain})`);

      // Determine if this is a cross-chain or same-chain swap
      const isCrossChain = fromChain !== toChain;

      if (isCrossChain) {
        return await this._getCrossChainQuote(params);
      } else {
        return await this._getSameChainQuote(params);
      }

    } catch (error) {
      this.logger.error('Failed to get unified quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get quote for same-chain swap
   * @private
   */
  async _getSameChainQuote(params) {
    const { fromChain, fromToken, toToken, amount, slippage } = params;

    this.logger.info(`Getting same-chain quote on ${fromChain}`);

    if (fromChain === 'sui') {
      // Use Cetus for Sui swaps
      return await this._getCetusQuote(params);
    } else {
      // Use 1inch for EVM swaps
      return await this._getOneInchQuote(params);
    }
  }

  /**
   * Get quote for cross-chain swap
   * @private
   */
  async _getCrossChainQuote(params) {
    const { fromChain, toChain, fromToken, toToken, amount, slippage } = params;

    this.logger.info(`Getting cross-chain quote: ${fromChain} -> ${toChain}`);

    // Step 1: Get bridge quote from Wormhole
    const bridgeQuote = await this.wormholeService.getBridgeQuote({
      fromChain,
      toChain,
      token: fromToken,
      amount
    });

    if (!bridgeQuote.success) {
      return {
        success: false,
        error: `Bridge quote failed: ${bridgeQuote.error}`
      };
    }

    // Step 2: Get swap quote on destination chain
    const swapQuote = await this._getDestinationSwapQuote({
      chain: toChain,
      fromToken: bridgeQuote.wrappedToken, // Bridged token
      toToken,
      amount: bridgeQuote.receivedAmount,
      slippage
    });

    if (!swapQuote.success) {
      return {
        success: false,
        error: `Destination swap quote failed: ${swapQuote.error}`
      };
    }

    // Step 3: Combine quotes
    const totalFee = parseFloat(bridgeQuote.bridgeFee) + parseFloat(swapQuote.fee || '0');
    const totalTime = `${bridgeQuote.estimatedTime} + ${swapQuote.estimatedTime || '~30 seconds'}`;

    return {
      success: true,
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: swapQuote.toAmount,
      bridgeFee: bridgeQuote.bridgeFee,
      swapFee: swapQuote.fee,
      totalFee: totalFee.toString(),
      estimatedTime: totalTime,
      route: 'bridge-swap',
      priceImpact: swapQuote.priceImpact || 0,
      steps: [
        {
          type: 'bridge',
          chain: fromChain,
          description: `Bridge ${fromToken} to ${toChain}`,
          estimatedFee: bridgeQuote.bridgeFee,
          estimatedTime: bridgeQuote.estimatedTime
        },
        {
          type: 'swap',
          chain: toChain,
          description: `Swap to ${toToken}`,
          estimatedFee: swapQuote.fee,
          estimatedTime: swapQuote.estimatedTime || '~30 seconds'
        }
      ],
      bridgeQuote,
      swapQuote
    };
  }

  /**
   * Get Cetus quote for Sui swaps
   * @private
   */
  async _getCetusQuote(params) {
    const { fromToken, toToken, amount, slippage } = params;

    try {
      // Get token addresses from symbols
      const fromTokenInfo = await this.cetusService.getTokenBySymbol(fromToken);
      const toTokenInfo = await this.cetusService.getTokenBySymbol(toToken);

      if (!fromTokenInfo || !toTokenInfo) {
        throw new Error(`Token not found: ${fromToken} or ${toToken}`);
      }

      const quote = await this.cetusService.getSwapQuote({
        fromToken: fromTokenInfo.address,
        toToken: toTokenInfo.address,
        amount,
        slippage
      });

      if (!quote.success) {
        throw new Error(quote.error);
      }

      return {
        success: true,
        fromChain: 'sui',
        toChain: 'sui',
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: quote.toAmount,
        totalFee: quote.fee,
        estimatedTime: '~30 seconds',
        route: 'direct',
        priceImpact: quote.priceImpact || 0,
        steps: [{
          type: 'swap',
          chain: 'sui',
          description: `Swap ${fromToken} to ${toToken} on Cetus`,
          estimatedFee: quote.fee,
          estimatedTime: '~30 seconds'
        }],
        quote
      };

    } catch (error) {
      this.logger.error('Failed to get Cetus quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get 1inch quote for EVM swaps
   * @private
   */
  async _getOneInchQuote(params) {
    const { fromChain, fromToken, toToken, amount, slippage } = params;

    try {
      // Get chain ID for 1inch
      const chainId = this._getChainId(fromChain);

      // Get token addresses from symbols
      const tokens = await this.oneInchService.getTokens(chainId);

      const fromTokenInfo = Object.values(tokens).find(t => t.symbol === fromToken);
      const toTokenInfo = Object.values(tokens).find(t => t.symbol === toToken);

      if (!fromTokenInfo || !toTokenInfo) {
        throw new Error(`Token not found: ${fromToken} or ${toToken}`);
      }

      const quote = await this.oneInchService.getQuote({
        chainId,
        src: fromTokenInfo.address,
        dst: toTokenInfo.address,
        amount
      });

      if (!quote.success) {
        throw new Error(quote.error);
      }

      return {
        success: true,
        fromChain,
        toChain: fromChain,
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: quote.quote.dstAmount,
        totalFee: quote.quote.estimatedGas,
        estimatedTime: '~30 seconds',
        route: 'direct',
        priceImpact: 0, // 1inch doesn't provide price impact in v6.0
        steps: [{
          type: 'swap',
          chain: fromChain,
          description: `Swap ${fromToken} to ${toToken} on 1inch`,
          estimatedFee: quote.quote.estimatedGas,
          estimatedTime: '~30 seconds'
        }],
        quote: quote.quote
      };

    } catch (error) {
      this.logger.error('Failed to get 1inch quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get swap quote on destination chain for cross-chain swaps
   * @private
   */
  async _getDestinationSwapQuote(params) {
    const { chain, fromToken, toToken, amount, slippage } = params;

    if (chain === 'sui') {
      // Use Cetus for Sui destination
      return await this.cetusService.getSwapQuote({
        fromToken,
        toToken,
        amount,
        slippage
      });
    } else {
      // Use 1inch for EVM destination
      const chainId = this._getChainId(chain);
      const tokens = await this.oneInchService.getTokens(chainId);

      const fromTokenInfo = Object.values(tokens).find(t => t.address.toLowerCase() === fromToken.toLowerCase());
      const toTokenInfo = Object.values(tokens).find(t => t.symbol === toToken);

      if (!fromTokenInfo || !toTokenInfo) {
        throw new Error(`Token not found: ${fromToken} or ${toToken}`);
      }

      const quote = await this.oneInchService.getQuote({
        chainId,
        src: fromTokenInfo.address,
        dst: toTokenInfo.address,
        amount
      });

      if (!quote.success) {
        throw new Error(quote.error);
      }

      return {
        success: true,
        toAmount: quote.quote.dstAmount,
        fee: quote.quote.estimatedGas,
        estimatedTime: '~30 seconds',
        priceImpact: 0
      };
    }
  }

  /**
   * Get available tokens for a chain
   * @param {string} chain - Chain name
   * @returns {Promise<Array>} Array of available tokens
   */
  async getAvailableTokens(chain) {
    try {
      if (chain === 'sui') {
        return await this.cetusService.getAllTokens();
      } else {
        const chainId = this._getChainId(chain);
        const tokens = await this.oneInchService.getTokens(chainId);
        return Object.values(tokens);
      }
    } catch (error) {
      this.logger.error(`Failed to get tokens for ${chain}:`, error);
      return [];
    }
  }

  /**
   * Get popular tokens for a chain
   * @param {string} chain - Chain name
   * @returns {Promise<Array>} Array of popular tokens
   */
  async getPopularTokens(chain) {
    try {
      if (chain === 'sui') {
        return await this.cetusService.getPopularTokens();
      } else {
        const chainId = this._getChainId(chain);
        return await this.oneInchService.getPopularTokens(chainId);
      }
    } catch (error) {
      this.logger.error(`Failed to get popular tokens for ${chain}:`, error);
      return [];
    }
  }

  /**
   * Search tokens by symbol or name
   * @param {string} chain - Chain name
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching tokens
   */
  async searchTokens(chain, query) {
    try {
      if (chain === 'sui') {
        return await this.cetusService.searchTokens(query);
      } else {
        const allTokens = await this.getAvailableTokens(chain);
        const lowercaseQuery = query.toLowerCase();

        return allTokens.filter(token =>
          token.symbol.toLowerCase().includes(lowercaseQuery) ||
          token.name.toLowerCase().includes(lowercaseQuery)
        );
      }
    } catch (error) {
      this.logger.error(`Failed to search tokens for ${chain}:`, error);
      return [];
    }
  }

  /**
   * Check if cross-chain swap is supported
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @param {string} token - Token symbol
   * @returns {boolean} Is supported
   */
  isCrossChainSupported(fromChain, toChain, token) {
    return this.wormholeService.isTokenSupported(fromChain, token) &&
           this.wormholeService.isTokenSupported(toChain, token);
  }

  /**
   * Get supported chains
   * @returns {Array} Array of supported chains
   */
  getSupportedChains() {
    return ['ethereum', 'arbitrum', 'optimism', 'polygon', 'sui'];
  }

  /**
   * Get chain ID for EVM chains
   * @private
   */
  _getChainId(chain) {
    const chainMap = {
      ethereum: 1,
      arbitrum: 42161,
      optimism: 10,
      polygon: 137,
      base: 8453,
      bnb: 56,
      avalanche: 43114,
      gnosis: 100
    };
    return chainMap[chain] || 1;
  }

  /**
   * Health check for all services
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const results = {
        oneInch: false,
        cetus: false,
        wormhole: false,
        overall: false
      };

      // Check 1inch
      try {
        const oneInchHealth = await this.oneInchService.healthCheck();
        results.oneInch = oneInchHealth.status === 'healthy';
      } catch (error) {
        this.logger.error('1inch health check failed:', error);
      }

      // Check Cetus
      try {
        const cetusTokens = await this.cetusService.getAllTokens();
        results.cetus = cetusTokens.length > 0;
      } catch (error) {
        this.logger.error('Cetus health check failed:', error);
      }

      // Check Wormhole
      try {
        results.wormhole = this.wormholeService.initialized;
      } catch (error) {
        this.logger.error('Wormhole health check failed:', error);
      }

      results.overall = results.oneInch && results.cetus && results.wormhole;

      return {
        success: true,
        status: results.overall ? 'healthy' : 'degraded',
        services: results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}