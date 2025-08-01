import { OneInchService } from './oneInchService.js';
import { WormholeService } from './wormholeService.js';
import { CetusService } from './cetusService.js';
import { SuiService } from './suiService.js';

/**
 * CrossChainSwapService - Orchestrates cross-chain swaps between Ethereum and Sui
 * Coordinates 1inch swaps, Wormhole bridging, and Cetus DEX operations
 */
export class CrossChainSwapService {
  constructor({ oneInchApiKey, network = 'testnet', logger }) {
    this.network = network;
    this.logger = logger;

    // Initialize all required services
    this.oneInchService = new OneInchService({
      apiKey: oneInchApiKey,
      baseUrl: 'https://api.1inch.dev',
      logger
    });

    this.wormholeService = new WormholeService({
      network,
      logger
    });

    this.cetusService = new CetusService({
      network,
      logger
    });

    this.suiService = new SuiService({
      network,
      logger
    });

    // Chain IDs
    this.chainIds = {
      ethereum: network === 'testnet' ? 11155111 : 1, // Sepolia or Mainnet
      sui: network === 'testnet' ? 'sui:testnet' : 'sui:mainnet'
    };

    // Swap state tracking
    this.activeSwaps = new Map();

    this.initialized = false;
  }

  /**
   * Initialize all services
   */
  async initialize() {
    try {
      this.logger.info('Initializing CrossChainSwapService...');

      const initResults = await Promise.all([
        this.wormholeService.initialize(),
        this.cetusService.initialize()
      ]);

      if (!initResults.every(result => result)) {
        throw new Error('Failed to initialize one or more services');
      }

      this.initialized = true;
      this.logger.info('CrossChainSwapService initialized successfully');

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize CrossChainSwapService:', error);
      return false;
    }
  }

  /**
   * Execute ETH → SUI cross-chain swap
   * Flow: ETH → USDC (1inch) → Bridge USDC (Wormhole) → USDC → SUI (Cetus)
   * @param {Object} params - Swap parameters
   * @param {string} params.ethAmount - ETH amount in wei
   * @param {string} params.fromAddress - Ethereum sender address
   * @param {string} params.toAddress - Sui recipient address
   * @param {Object} params.ethSigner - Ethereum signer
   * @param {Object} params.suiSigner - Sui signer
   * @param {number} params.slippage - Slippage tolerance (default: 1%)
   * @returns {Promise<Object>} Swap execution result
   */
  async executeETHToSUISwap(params) {
    const swapId = this._generateSwapId();

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const { ethAmount, fromAddress, toAddress, ethSigner, suiSigner, slippage = 1 } = params;

      this.logger.info(`Starting ETH → SUI swap: ${ethAmount} wei`, { swapId });

      // Initialize swap tracking
      this._updateSwapState(swapId, {
        type: 'ETH_TO_SUI',
        status: 'INITIATED',
        ethAmount,
        fromAddress,
        toAddress,
        steps: {
          ethToUsdc: 'PENDING',
          bridge: 'PENDING',
          usdcToSui: 'PENDING'
        }
      });

      // Step 1: Swap ETH → USDC on Ethereum using 1inch
      this.logger.info('Step 1: Swapping ETH to USDC on Ethereum', { swapId });
      this._updateSwapState(swapId, {
        status: 'ETH_TO_USDC_SWAP',
        steps: { ...this.activeSwaps.get(swapId).steps, ethToUsdc: 'IN_PROGRESS' }
      });

      const ethSwapResult = await this.oneInchService.buildETHToUSDCSwap({
        amount: ethAmount,
        fromAddress,
        slippage,
        chainId: this.chainIds.ethereum
      });

      if (!ethSwapResult.success) {
        throw new Error(`ETH to USDC swap failed: ${ethSwapResult.error}`);
      }

      // Execute the ETH → USDC swap transaction
      // Note: In production, this would be executed by the frontend/client
      const usdcAmount = ethSwapResult.expectedOutput;

      this._updateSwapState(swapId, {
        steps: { ...this.activeSwaps.get(swapId).steps, ethToUsdc: 'COMPLETED' },
        usdcAmount,
        ethTxHash: 'pending' // Will be filled when transaction is executed
      });

      this.logger.info(`ETH to USDC swap prepared. Expected USDC: ${usdcAmount}`, { swapId });

      // Step 2: Bridge USDC from Ethereum to Sui using Wormhole
      this.logger.info('Step 2: Bridging USDC from Ethereum to Sui', { swapId });
      this._updateSwapState(swapId, {
        status: 'BRIDGING',
        steps: { ...this.activeSwaps.get(swapId).steps, bridge: 'IN_PROGRESS' }
      });

      const bridgeResult = await this.wormholeService.bridgeUSDCToSui({
        amount: usdcAmount,
        fromAddress,
        toAddress,
        signer: ethSigner
      });

      if (!bridgeResult.success) {
        throw new Error(`USDC bridging failed: ${bridgeResult.error}`);
      }

      this._updateSwapState(swapId, {
        steps: { ...this.activeSwaps.get(swapId).steps, bridge: 'COMPLETED' },
        bridgeTxHash: bridgeResult.ethTxHash,
        vaa: bridgeResult.vaa
      });

      this.logger.info('USDC bridge initiated successfully', {
        swapId,
        bridgeTxHash: bridgeResult.ethTxHash
      });

      // Step 3: Complete bridge on Sui and swap USDC → SUI
      this.logger.info('Step 3: Completing bridge and swapping USDC to SUI', { swapId });
      this._updateSwapState(swapId, {
        status: 'USDC_TO_SUI_SWAP',
        steps: { ...this.activeSwaps.get(swapId).steps, usdcToSui: 'IN_PROGRESS' }
      });

      // Complete bridge on Sui
      const bridgeCompletion = await this.wormholeService.completeUSDCBridgeOnSui({
        vaa: bridgeResult.vaa,
        transfer: bridgeResult.transfer,
        suiSigner
      });

      if (!bridgeCompletion.success) {
        throw new Error(`Bridge completion failed: ${bridgeCompletion.error}`);
      }

      // Swap USDC → SUI on Cetus
      const suiSwapResult = await this.cetusService.swapUSDCToSUI({
        amount: usdcAmount,
        slippage,
        recipient: toAddress,
        signer: suiSigner
      });

      if (!suiSwapResult.success) {
        throw new Error(`USDC to SUI swap failed: ${suiSwapResult.error}`);
      }

      this._updateSwapState(swapId, {
        status: 'COMPLETED',
        steps: { ...this.activeSwaps.get(swapId).steps, usdcToSui: 'COMPLETED' },
        suiTxHash: bridgeCompletion.suiTxHash,
        finalSuiAmount: suiSwapResult.swapData.estimated_amount_out,
        completedAt: new Date().toISOString()
      });

      this.logger.info('ETH → SUI swap completed successfully', {
        swapId,
        finalSuiAmount: suiSwapResult.swapData.estimated_amount_out
      });

      return {
        success: true,
        swapId,
        result: {
          ethAmount,
          finalSuiAmount: suiSwapResult.swapData.estimated_amount_out,
          transactions: {
            ethSwap: ethSwapResult.transaction,
            bridge: bridgeResult.ethTxHash,
            suiCompletion: bridgeCompletion.suiTxHash
          },
          usdcAmount
        }
      };

    } catch (error) {
      this.logger.error('ETH to SUI swap failed:', error, { swapId });

      this._updateSwapState(swapId, {
        status: 'FAILED',
        error: error.message,
        failedAt: new Date().toISOString()
      });

      return {
        success: false,
        swapId,
        error: error.message
      };
    }
  }

  /**
   * Execute SUI → ETH cross-chain swap
   * Flow: SUI → USDC (Cetus) → Bridge USDC (Wormhole) → USDC → ETH (1inch)
   * @param {Object} params - Swap parameters
   * @param {string} params.suiAmount - SUI amount with decimals
   * @param {string} params.fromAddress - Sui sender address
   * @param {string} params.toAddress - Ethereum recipient address
   * @param {Object} params.suiSigner - Sui signer
   * @param {Object} params.ethSigner - Ethereum signer
   * @param {number} params.slippage - Slippage tolerance (default: 1%)
   * @returns {Promise<Object>} Swap execution result
   */
  async executeSUIToETHSwap(params) {
    const swapId = this._generateSwapId();

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const { suiAmount, fromAddress, toAddress, suiSigner, ethSigner, slippage = 1 } = params;

      this.logger.info(`Starting SUI → ETH swap: ${suiAmount} SUI`, { swapId });

      // Initialize swap tracking
      this._updateSwapState(swapId, {
        type: 'SUI_TO_ETH',
        status: 'INITIATED',
        suiAmount,
        fromAddress,
        toAddress,
        steps: {
          suiToUsdc: 'PENDING',
          bridge: 'PENDING',
          usdcToEth: 'PENDING'
        }
      });

      // Step 1: Swap SUI → USDC on Cetus
      this.logger.info('Step 1: Swapping SUI to USDC on Cetus', { swapId });
      this._updateSwapState(swapId, {
        status: 'SUI_TO_USDC_SWAP',
        steps: { ...this.activeSwaps.get(swapId).steps, suiToUsdc: 'IN_PROGRESS' }
      });

      const suiSwapResult = await this.cetusService.swapSUIToUSDC({
        amount: suiAmount,
        slippage,
        recipient: fromAddress,
        signer: suiSigner
      });

      if (!suiSwapResult.success) {
        throw new Error(`SUI to USDC swap failed: ${suiSwapResult.error}`);
      }

      const usdcAmount = suiSwapResult.swapData.estimated_amount_out;

      this._updateSwapState(swapId, {
        steps: { ...this.activeSwaps.get(swapId).steps, suiToUsdc: 'COMPLETED' },
        usdcAmount
      });

      this.logger.info(`SUI to USDC swap completed. USDC amount: ${usdcAmount}`, { swapId });

      // Step 2: Bridge USDC from Sui to Ethereum
      this.logger.info('Step 2: Bridging USDC from Sui to Ethereum', { swapId });
      this._updateSwapState(swapId, {
        status: 'BRIDGING',
        steps: { ...this.activeSwaps.get(swapId).steps, bridge: 'IN_PROGRESS' }
      });

      const bridgeResult = await this.wormholeService.bridgeUSDCToEthereum({
        amount: usdcAmount,
        fromAddress,
        toAddress,
        signer: suiSigner
      });

      if (!bridgeResult.success) {
        throw new Error(`USDC bridging failed: ${bridgeResult.error}`);
      }

      this._updateSwapState(swapId, {
        steps: { ...this.activeSwaps.get(swapId).steps, bridge: 'COMPLETED' },
        bridgeTxHash: bridgeResult.suiTxHash,
        vaa: bridgeResult.vaa
      });

      // Step 3: Complete bridge on Ethereum and swap USDC → ETH
      this.logger.info('Step 3: Completing bridge and swapping USDC to ETH', { swapId });
      this._updateSwapState(swapId, {
        status: 'USDC_TO_ETH_SWAP',
        steps: { ...this.activeSwaps.get(swapId).steps, usdcToEth: 'IN_PROGRESS' }
      });

      // Complete bridge on Ethereum
      const bridgeCompletion = await this.wormholeService.completeUSDCBridgeOnEthereum({
        vaa: bridgeResult.vaa,
        transfer: bridgeResult.transfer,
        ethSigner
      });

      if (!bridgeCompletion.success) {
        throw new Error(`Bridge completion failed: ${bridgeCompletion.error}`);
      }

      // Swap USDC → ETH using 1inch
      const ethSwapResult = await this.oneInchService.buildUSDCToETHSwap({
        amount: usdcAmount,
        fromAddress: toAddress,
        slippage,
        chainId: this.chainIds.ethereum
      });

      if (!ethSwapResult.success) {
        throw new Error(`USDC to ETH swap failed: ${ethSwapResult.error}`);
      }

      const finalEthAmount = ethSwapResult.expectedOutput;

      this._updateSwapState(swapId, {
        status: 'COMPLETED',
        steps: { ...this.activeSwaps.get(swapId).steps, usdcToEth: 'COMPLETED' },
        ethTxHash: bridgeCompletion.ethTxHash,
        finalEthAmount,
        completedAt: new Date().toISOString()
      });

      this.logger.info('SUI → ETH swap completed successfully', {
        swapId,
        finalEthAmount
      });

      return {
        success: true,
        swapId,
        result: {
          suiAmount,
          finalEthAmount,
          transactions: {
            suiSwap: suiSwapResult.transaction,
            bridge: bridgeResult.suiTxHash,
            ethCompletion: bridgeCompletion.ethTxHash,
            ethSwap: ethSwapResult.transaction
          },
          usdcAmount
        }
      };

    } catch (error) {
      this.logger.error('SUI to ETH swap failed:', error, { swapId });

      this._updateSwapState(swapId, {
        status: 'FAILED',
        error: error.message,
        failedAt: new Date().toISOString()
      });

      return {
        success: false,
        swapId,
        error: error.message
      };
    }
  }

  /**
   * Get quote for cross-chain swap
   * @param {Object} params - Quote parameters
   * @param {string} params.fromChain - Source chain ('ethereum' or 'sui')
   * @param {string} params.toChain - Destination chain ('ethereum' or 'sui')
   * @param {string} params.amount - Input amount
   * @param {string} params.fromToken - Source token ('ETH' or 'SUI')
   * @param {string} params.toToken - Destination token ('ETH' or 'SUI')
   * @returns {Promise<Object>} Quote result
   */
  async getCrossChainQuote(params) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const { fromChain, toChain, amount, fromToken, toToken } = params;

      this.logger.info(`Getting cross-chain quote: ${amount} ${fromToken} (${fromChain}) → ${toToken} (${toChain})`);

      let quote = {
        inputAmount: amount,
        inputToken: fromToken,
        outputToken: toToken,
        steps: [],
        estimatedOutput: '0',
        priceImpact: 0,
        fees: {
          swap: '0',
          bridge: '0',
          total: '0'
        }
      };

      if (fromChain === 'ethereum' && toChain === 'sui') {
        // ETH → SUI flow

        // Step 1: ETH → USDC quote
        const ethUsdcQuote = await this.oneInchService.getSwapQuote({
          src: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          dst: this.chainIds.ethereum === 1
            ? '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
            : '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
          amount,
          chainId: this.chainIds.ethereum
        });

        if (!ethUsdcQuote.success) {
          throw new Error(`ETH/USDC quote failed: ${ethUsdcQuote.error}`);
        }

        quote.steps.push({
          type: 'swap',
          chain: 'ethereum',
          from: 'ETH',
          to: 'USDC',
          expectedOutput: ethUsdcQuote.toAmount
        });

        // Step 2: Bridge fees estimation
        const bridgeFees = await this.wormholeService.estimateBridgeFees('Ethereum', 'Sui', 'USDC');
        quote.steps.push({
          type: 'bridge',
          from: 'ethereum',
          to: 'sui',
          fees: bridgeFees
        });

        // Step 3: USDC → SUI quote
        const usdcSuiQuote = await this.cetusService.getSwapQuote({
          inputToken: this.cetusService.getSupportedTokens().USDC,
          outputToken: this.cetusService.getSupportedTokens().SUI,
          amount: ethUsdcQuote.toAmount
        });

        if (!usdcSuiQuote.success) {
          throw new Error(`USDC/SUI quote failed: ${usdcSuiQuote.error}`);
        }

        quote.steps.push({
          type: 'swap',
          chain: 'sui',
          from: 'USDC',
          to: 'SUI',
          expectedOutput: usdcSuiQuote.outputAmount
        });

        quote.estimatedOutput = usdcSuiQuote.outputAmount;
        quote.priceImpact = usdcSuiQuote.priceImpact;

      } else if (fromChain === 'sui' && toChain === 'ethereum') {
        // SUI → ETH flow

        // Step 1: SUI → USDC quote
        const suiUsdcQuote = await this.cetusService.getSwapQuote({
          inputToken: this.cetusService.getSupportedTokens().SUI,
          outputToken: this.cetusService.getSupportedTokens().USDC,
          amount
        });

        if (!suiUsdcQuote.success) {
          throw new Error(`SUI/USDC quote failed: ${suiUsdcQuote.error}`);
        }

        quote.steps.push({
          type: 'swap',
          chain: 'sui',
          from: 'SUI',
          to: 'USDC',
          expectedOutput: suiUsdcQuote.outputAmount
        });

        // Step 2: Bridge fees
        const bridgeFees = await this.wormholeService.estimateBridgeFees('Sui', 'Ethereum', 'USDC');
        quote.steps.push({
          type: 'bridge',
          from: 'sui',
          to: 'ethereum',
          fees: bridgeFees
        });

        // Step 3: USDC → ETH quote
        const usdcEthQuote = await this.oneInchService.getSwapQuote({
          src: this.chainIds.ethereum === 1
            ? '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
            : '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
          dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          amount: suiUsdcQuote.outputAmount,
          chainId: this.chainIds.ethereum
        });

        if (!usdcEthQuote.success) {
          throw new Error(`USDC/ETH quote failed: ${usdcEthQuote.error}`);
        }

        quote.steps.push({
          type: 'swap',
          chain: 'ethereum',
          from: 'USDC',
          to: 'ETH',
          expectedOutput: usdcEthQuote.toAmount
        });

        quote.estimatedOutput = usdcEthQuote.toAmount;
        quote.priceImpact = suiUsdcQuote.priceImpact;
      }

      return {
        success: true,
        quote
      };

    } catch (error) {
      this.logger.error('Failed to get cross-chain quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get swap status
   * @param {string} swapId - Swap ID
   * @returns {Object} Swap status
   */
  getSwapStatus(swapId) {
    const swap = this.activeSwaps.get(swapId);
    if (!swap) {
      return {
        found: false,
        error: 'Swap not found'
      };
    }

    return {
      found: true,
      ...swap
    };
  }

  /**
   * Get all active swaps
   * @returns {Array} Active swaps
   */
  getAllActiveSwaps() {
    return Array.from(this.activeSwaps.entries()).map(([id, swap]) => ({
      id,
      ...swap
    }));
  }

  /**
   * Generate unique swap ID
   * @private
   */
  _generateSwapId() {
    return `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update swap state
   * @private
   */
  _updateSwapState(swapId, updates) {
    const currentState = this.activeSwaps.get(swapId) || {};
    this.activeSwaps.set(swapId, {
      ...currentState,
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }
}

export default CrossChainSwapService;