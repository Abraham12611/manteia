import { CetusClmmSDK, initCetusSDK, Percentage, adjustForSlippage, d } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import BN from 'bn.js';

/**
 * CetusService - Handles DEX operations on Sui using Cetus CLMM
 * Based on official Cetus SDK documentation
 * @see https://docs.cetus.zone/developer/sui-contracts
 */
export class CetusService {
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

    // Common token addresses (will need to be updated with actual addresses)
    this.tokens = {
      testnet: {
        SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
        USDC: '0x...', // Wrapped USDC on Sui testnet
      },
      mainnet: {
        SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
        USDC: '0x...' // Wrapped USDC on Sui mainnet
      }
    };
  }

  /**
   * Initialize Cetus SDK
   */
  async initialize() {
    try {
      this.logger.info('Initializing Cetus SDK...');

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

      this.logger.info(`Cetus SDK initialized for ${this.network}`);
      this.initialized = true;

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Cetus SDK:', error);
      return false;
    }
  }

  /**
   * Swap USDC for SUI tokens
   * @param {Object} params - Swap parameters
   * @param {string} params.amount - USDC amount (with decimals)
   * @param {number} params.slippage - Slippage tolerance (e.g., 0.5 for 0.5%)
   * @param {string} params.recipient - Recipient address
   * @param {Object} params.signer - Transaction signer
   * @returns {Promise<Object>} Swap result
   */
  async swapUSDCToSUI(params) {
    try {
      if (!this.initialized) {
        throw new Error('CetusService not initialized');
      }

      const { amount, slippage = 0.5, recipient, signer } = params;

      this.logger.info(`Swapping ${amount} USDC to SUI`);

      // Get token addresses for current network
      const networkTokens = this.tokens[this.network];
      const usdcToken = networkTokens.USDC;
      const suiToken = networkTokens.SUI;

      // Find best pool for USDC/SUI
      const pool = await this._findBestPool(usdcToken, suiToken);
      if (!pool) {
        throw new Error('No suitable USDC/SUI pool found');
      }

      // Calculate swap details
      const swapResult = await this._calculateSwap({
        pool,
        inputToken: usdcToken,
        outputToken: suiToken,
        amount,
        isFixedInput: true
      });

      // Apply slippage protection
      const slippageTolerance = Percentage.fromDecimal(d(slippage / 100));
      const amountLimit = adjustForSlippage(
        new BN(swapResult.estimated_amount_out),
        slippageTolerance,
        false // For minimum output
      );

      // Create swap transaction
      const swapTx = await this.sdk.Swap.createSwapTransactionPayload({
        pool_id: pool.objectId,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        a2b: pool.coinTypeA === usdcToken, // USDC to SUI
        by_amount_in: true,
        amount: amount,
        amount_limit: amountLimit.toString(),
        swap_partner: "" // No partner
      });

      this.logger.info('Swap transaction created:', {
        pool: pool.objectId,
        expectedOutput: swapResult.estimated_amount_out,
        minOutput: amountLimit.toString(),
        priceImpact: swapResult.price_impact
      });

      return {
        success: true,
        transaction: swapTx,
        swapData: swapResult,
        pool: pool,
        minAmountOut: amountLimit.toString()
      };

    } catch (error) {
      this.logger.error('USDC to SUI swap failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Swap SUI for USDC tokens
   * @param {Object} params - Swap parameters
   * @param {string} params.amount - SUI amount (with decimals)
   * @param {number} params.slippage - Slippage tolerance (e.g., 0.5 for 0.5%)
   * @param {string} params.recipient - Recipient address
   * @param {Object} params.signer - Transaction signer
   * @returns {Promise<Object>} Swap result
   */
  async swapSUIToUSDC(params) {
    try {
      if (!this.initialized) {
        throw new Error('CetusService not initialized');
      }

      const { amount, slippage = 0.5, recipient, signer } = params;

      this.logger.info(`Swapping ${amount} SUI to USDC`);

      // Get token addresses for current network
      const networkTokens = this.tokens[this.network];
      const suiToken = networkTokens.SUI;
      const usdcToken = networkTokens.USDC;

      // Find best pool for SUI/USDC
      const pool = await this._findBestPool(suiToken, usdcToken);
      if (!pool) {
        throw new Error('No suitable SUI/USDC pool found');
      }

      // Calculate swap details
      const swapResult = await this._calculateSwap({
        pool,
        inputToken: suiToken,
        outputToken: usdcToken,
        amount,
        isFixedInput: true
      });

      // Apply slippage protection
      const slippageTolerance = Percentage.fromDecimal(d(slippage / 100));
      const amountLimit = adjustForSlippage(
        new BN(swapResult.estimated_amount_out),
        slippageTolerance,
        false // For minimum output
      );

      // Create swap transaction
      const swapTx = await this.sdk.Swap.createSwapTransactionPayload({
        pool_id: pool.objectId,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        a2b: pool.coinTypeA === suiToken, // SUI to USDC
        by_amount_in: true,
        amount: amount,
        amount_limit: amountLimit.toString(),
        swap_partner: ""
      });

      this.logger.info('Swap transaction created:', {
        pool: pool.objectId,
        expectedOutput: swapResult.estimated_amount_out,
        minOutput: amountLimit.toString(),
        priceImpact: swapResult.price_impact
      });

      return {
        success: true,
        transaction: swapTx,
        swapData: swapResult,
        pool: pool,
        minAmountOut: amountLimit.toString()
      };

    } catch (error) {
      this.logger.error('SUI to USDC swap failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get swap quote without executing
   * @param {Object} params - Quote parameters
   * @param {string} params.inputToken - Input token address
   * @param {string} params.outputToken - Output token address
   * @param {string} params.amount - Input amount
   * @returns {Promise<Object>} Quote result
   */
  async getSwapQuote(params) {
    try {
      if (!this.initialized) {
        throw new Error('CetusService not initialized');
      }

      const { inputToken, outputToken, amount } = params;

      // Find best pool
      const pool = await this._findBestPool(inputToken, outputToken);
      if (!pool) {
        throw new Error(`No pool found for ${inputToken}/${outputToken}`);
      }

      // Calculate swap
      const swapResult = await this._calculateSwap({
        pool,
        inputToken,
        outputToken,
        amount,
        isFixedInput: true
      });

      return {
        success: true,
        inputAmount: amount,
        outputAmount: swapResult.estimated_amount_out,
        priceImpact: swapResult.price_impact,
        fee: swapResult.fee,
        pool: pool.objectId
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
   * Find the best pool for a token pair
   * @private
   */
  async _findBestPool(tokenA, tokenB) {
    try {
      // Get pools for this token pair
      const pools = await this.sdk.Pool.getPoolList();

      // Filter pools that match our token pair
      const matchingPools = pools.filter(pool =>
        (pool.coinTypeA === tokenA && pool.coinTypeB === tokenB) ||
        (pool.coinTypeA === tokenB && pool.coinTypeB === tokenA)
      );

      if (matchingPools.length === 0) {
        return null;
      }

      // Fetch detailed data for each pool
      const detailedPools = await Promise.all(
        matchingPools.map(async (pool) => {
          const poolData = await this.sdk.Pool.getPool(pool.poolAddress);
          return {
            ...poolData,
            objectId: pool.poolAddress
          };
        })
      );

      // Sort by liquidity (highest first)
      detailedPools.sort((a, b) => {
        const liquidityA = new BN(a.liquidity || '0');
        const liquidityB = new BN(b.liquidity || '0');
        return liquidityB.cmp(liquidityA);
      });

      return detailedPools[0];

    } catch (error) {
      this.logger.error('Failed to find best pool:', error);
      return null;
    }
  }

  /**
   * Calculate swap amounts and price impact
   * @private
   */
  async _calculateSwap(params) {
    try {
      const { pool, inputToken, outputToken, amount, isFixedInput } = params;

      // Determine swap direction
      const a2b = pool.coinTypeA === inputToken;

      // Get token decimals
      const inputDecimals = inputToken === this.tokens[this.network].USDC ? 6 : 9;
      const outputDecimals = outputToken === this.tokens[this.network].USDC ? 6 : 9;

      // Calculate pre-swap result
      const preSwapResult = await this.sdk.Swap.preSwap({
        pool,
        current_sqrt_price: pool.current_sqrt_price,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        decimalsA: pool.coinTypeA === this.tokens[this.network].USDC ? 6 : 9,
        decimalsB: pool.coinTypeB === this.tokens[this.network].USDC ? 6 : 9,
        a2b,
        by_amount_in: isFixedInput,
        amount
      });

      return {
        estimated_amount_in: preSwapResult.estimatedAmountIn?.toString() || amount,
        estimated_amount_out: preSwapResult.estimatedAmountOut?.toString() || '0',
        amount: preSwapResult.amount?.toString() || amount,
        fee: preSwapResult.fee?.toString() || '0',
        price_impact: preSwapResult.priceImpact || 0
      };

    } catch (error) {
      this.logger.error('Failed to calculate swap:', error);
      throw error;
    }
  }

  /**
   * Get pool information
   * @param {string} poolId - Pool object ID
   * @returns {Promise<Object>} Pool data
   */
  async getPoolInfo(poolId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const pool = await this.sdk.Pool.getPool(poolId);
      return {
        success: true,
        pool
      };

    } catch (error) {
      this.logger.error('Failed to get pool info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all available pools
   * @returns {Promise<Array>} List of pools
   */
  async getAllPools() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const pools = await this.sdk.Pool.getPoolList();
      return pools;

    } catch (error) {
      this.logger.error('Failed to get pools:', error);
      return [];
    }
  }

  /**
   * Calculate price impact for a swap
   * @param {Object} params - Price impact parameters
   * @returns {Promise<number>} Price impact percentage
   */
  async calculatePriceImpact(params) {
    try {
      const { inputToken, outputToken, amount } = params;

      const pool = await this._findBestPool(inputToken, outputToken);
      if (!pool) {
        return 0;
      }

      const swapResult = await this._calculateSwap({
        pool,
        inputToken,
        outputToken,
        amount,
        isFixedInput: true
      });

      return swapResult.price_impact || 0;

    } catch (error) {
      this.logger.error('Failed to calculate price impact:', error);
      return 0;
    }
  }

  /**
   * Get supported tokens for this network
   * @returns {Object} Supported tokens
   */
  getSupportedTokens() {
    return this.tokens[this.network];
  }

  /**
   * Get network configuration
   * @returns {Object} Network config
   */
  getNetworkConfig() {
    return this.config[this.network];
  }
}

export default CetusService;