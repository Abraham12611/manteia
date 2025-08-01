import { CetusClmmSDK, initCetusSDK, Percentage, adjustForSlippage, d } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
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

    // Token addresses matching the hardcoded pool definitions
    this.tokens = {
      testnet: {
        SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
        USDC: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', // Testnet USDC
      },
      mainnet: {
        SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
        USDC: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC' // Mainnet USDC (same for testing)
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
      // For now, use hardcoded pools since SDK Pool.getPoolList() doesn't exist
      // TODO: Update when proper Cetus SDK v2 is integrated

      const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
      const SUI_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';

      // Known USDC/SUI pool on testnet (this should be updated with actual pool address)
      const KNOWN_POOLS = {
        [`${USDC_TYPE}/${SUI_TYPE}`]: {
          poolAddress: '0x9dee3896ee4cbaa70a396c4dfacf7e0e76ebbc0d8d5b8df9c42bd0cb1e6e7f21', // Example testnet pool
          coinTypeA: USDC_TYPE,
          coinTypeB: SUI_TYPE,
          fee: 3000 // 0.3%
        },
        [`${SUI_TYPE}/${USDC_TYPE}`]: {
          poolAddress: '0x9dee3896ee4cbaa70a396c4dfacf7e0e76ebbc0d8d5b8df9c42bd0cb1e6e7f21', // Example testnet pool
          coinTypeA: SUI_TYPE,
          coinTypeB: USDC_TYPE,
          fee: 3000 // 0.3%
        }
      };

      const poolKey1 = `${tokenA}/${tokenB}`;
      const poolKey2 = `${tokenB}/${tokenA}`;

      const pool = KNOWN_POOLS[poolKey1] || KNOWN_POOLS[poolKey2];

      if (!pool) {
        this.logger.warn(`No hardcoded pool found for ${tokenA}/${tokenB}`);
        return null;
      }

      // Return the pool with objectId for compatibility
      return {
        ...pool,
        objectId: pool.poolAddress
      };

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

      // For now, provide a simplified calculation since SDK methods are not working
      // TODO: Implement proper Cetus SDK v2 integration

      const inputAmount = parseFloat(amount);
      let outputAmount;

      // Simple mock calculation based on rough USDC/SUI exchange rate
      const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
      const SUI_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';

      if (inputToken === USDC_TYPE && outputToken === SUI_TYPE) {
        // USDC to SUI: Assume 1 USDC = ~1.5 SUI (example rate)
        outputAmount = inputAmount * 1.5;
      } else if (inputToken === SUI_TYPE && outputToken === USDC_TYPE) {
        // SUI to USDC: Assume 1 SUI = ~0.65 USDC (example rate)
        outputAmount = inputAmount * 0.65;
      } else {
        // Default 1:1 rate for unknown pairs
        outputAmount = inputAmount;
      }

      // Apply some slippage and fees
      const fee = outputAmount * 0.003; // 0.3% fee
      const finalOutput = outputAmount - fee;

      // Determine correct decimal multiplier based on output token
      const outputDecimals = outputToken === SUI_TYPE ? 1e9 : 1e6; // SUI = 9 decimals, USDC = 6 decimals

      return {
        estimated_amount_in: amount,
        estimated_amount_out: (finalOutput * outputDecimals).toFixed(0), // Convert to smallest units with correct decimals
        amount: amount,
        fee: (fee * outputDecimals).toFixed(0),
        price_impact: 0.1 // 0.1% mock price impact
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

      // Mock pool info for now since SDK.Pool.getPool doesn't exist
      // TODO: Implement proper pool fetching with Cetus SDK v2
      return {
        success: true,
        pool: {
          objectId: poolId,
          coinTypeA: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
          coinTypeB: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
          liquidity: '1000000000000000000',
          fee: 3000
        }
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

      // Return hardcoded pools since SDK.Pool.getPoolList doesn't exist
      // TODO: Implement proper pool fetching with Cetus SDK v2
      const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
      const SUI_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';

      return [
        {
          poolAddress: '0x9dee3896ee4cbaa70a396c4dfacf7e0e76ebbc0d8d5b8df9c42bd0cb1e6e7f21',
          coinTypeA: USDC_TYPE,
          coinTypeB: SUI_TYPE,
          fee: 3000,
          liquidity: '1000000000000000000'
        }
      ];

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