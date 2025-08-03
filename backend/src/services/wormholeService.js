import { wormhole } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import sui from '@wormhole-foundation/sdk/sui';
import { ethers } from 'ethers';

/**
 * WormholeService - Handles cross-chain token bridging between Ethereum and Sui
 * Based on official Wormhole SDK documentation
 * @see https://docs.wormhole.com/wormhole/
 */
export class WormholeService {
  constructor({ network = 'Testnet', logger }) {
    this.network = network;
    this.logger = logger;
    this.wh = null;
    this.initialized = false;

    // Contract addresses from official docs
    this.contracts = {
      ethereum: {
        core: network === 'Testnet'
          ? '0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78'  // Sepolia
          : '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',  // Mainnet
        tokenBridge: network === 'Testnet'
          ? '0xDB5492265f6038831E89f495670FF909aDe94bd9'  // Sepolia
          : '0x3ee18B2214AFF97000D974cf647E7C347E8fa585'   // Mainnet
      },
      sui: {
        core: network === 'Testnet'
          ? '0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790'  // Testnet
          : '0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c', // Mainnet
        tokenBridge: network === 'Testnet'
          ? '0x6fb10cdb7aa299e9a4308752dadecb049ff55a892de92992a1edbd7912b3d6da'  // Testnet
          : '0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9'  // Mainnet
      }
    };
  }

  /**
   * Initialize Wormhole SDK with EVM and Sui support
   */
  async initialize() {
    try {
      this.logger.info('Initializing Wormhole SDK...');

      // Initialize Wormhole with EVM and Sui platforms
      this.wh = await wormhole(this.network, [evm, sui]);

      this.logger.info(`Wormhole SDK initialized for ${this.network}`);
      this.initialized = true;

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Wormhole SDK:', error);
      return false;
    }
  }

  /**
   * Bridge USDC from Ethereum to Sui
   * @param {Object} params - Bridge parameters
   * @param {string} params.amount - Amount in USDC (with decimals)
   * @param {string} params.fromAddress - Ethereum sender address
   * @param {string} params.toAddress - Sui recipient address
   * @param {Object} params.signer - Ethereum signer
   * @returns {Promise<Object>} Bridge transaction result
   */
  async bridgeUSDCToSui(params) {
    try {
      if (!this.initialized) {
        throw new Error('WormholeService not initialized');
      }

      const { amount: usdcAmount, fromAddress, toAddress, signer } = params;

      this.logger.info(`Starting USDC bridge: ${usdcAmount} from ETH to Sui`);

      // Get chain contexts
      const ethChain = this.wh.getChain('Ethereum');
      const suiChain = this.wh.getChain('Sui');

      // USDC token ID on Ethereum (6 decimals)
      const usdcTokenId = TokenId.fromString('Ethereum:0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'); // USDC on Ethereum

      // Convert amount to bigint with proper decimals (USDC has 6 decimals)
      const transferAmount = amount.units(amount.parse(usdcAmount, 6));

      // Create token transfer
      const xfer = await this.wh.tokenTransfer(
        usdcTokenId,
        transferAmount,
        { chain: 'Ethereum', address: fromAddress },
        { chain: 'Sui', address: toAddress },
        false // Manual transfer (we handle completion)
      );

      // Get quote for transfer
      const quote = await TokenTransfer.quoteTransfer(
        this.wh,
        ethChain,
        suiChain,
        xfer.transfer
      );

      this.logger.info('Transfer quote:', quote);

      // Initiate transfer on Ethereum
      const ethSigner = this._createEthereumSigner(ethChain, signer);
      const srcTxids = await xfer.initiateTransfer(ethSigner);

      this.logger.info('Transfer initiated on Ethereum:', srcTxids);

      // Wait for VAA (Verifiable Action Approval)
      const vaa = await this._waitForVAA(xfer, srcTxids);

      this.logger.info('VAA received:', vaa);

      return {
        success: true,
        ethTxHash: srcTxids[0],
        vaa: vaa,
        transfer: xfer,
        quote: quote
      };

    } catch (error) {
      this.logger.error('USDC bridge to Sui failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete USDC bridge on Sui side
   * @param {Object} params - Completion parameters
   * @param {Object} params.vaa - VAA from bridge initiation
   * @param {Object} params.transfer - Transfer object
   * @param {Object} params.suiSigner - Sui signer
   * @returns {Promise<Object>} Completion result
   */
  async completeUSDCBridgeOnSui(params) {
    try {
      const { vaa, transfer, suiSigner } = params;

      this.logger.info('Completing USDC bridge on Sui...');

      // Get Sui chain context
      const suiChain = this.wh.getChain('Sui');

      // Create Sui signer for SDK
      const suiSignerObj = this._createSuiSigner(suiChain, suiSigner);

      // Complete transfer on Sui
      const dstTxids = await transfer.completeTransfer(suiSignerObj);

      this.logger.info('Transfer completed on Sui:', dstTxids);

      return {
        success: true,
        suiTxHash: dstTxids[0]
      };

    } catch (error) {
      this.logger.error('USDC bridge completion on Sui failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Bridge USDC from Sui to Ethereum
   * @param {Object} params - Bridge parameters
   * @param {string} params.amount - Amount in USDC
   * @param {string} params.fromAddress - Sui sender address
   * @param {string} params.toAddress - Ethereum recipient address
   * @param {Object} params.signer - Sui signer
   * @returns {Promise<Object>} Bridge transaction result
   */
  async bridgeUSDCToEthereum(params) {
    try {
      if (!this.initialized) {
        throw new Error('WormholeService not initialized');
      }

      const { amount: usdcAmount, fromAddress, toAddress, signer } = params;

      this.logger.info(`Starting USDC bridge: ${usdcAmount} from Sui to ETH`);

      // Get chain contexts
      const suiChain = this.wh.getChain('Sui');
      const ethChain = this.wh.getChain('Ethereum');

      // USDC token ID on Sui (wrapped)
      const usdcTokenId = TokenId.fromString('Sui:0x...'); // Will need actual wrapped USDC address on Sui

      // Convert amount to bigint with proper decimals
      const transferAmount = amount.units(amount.parse(usdcAmount, 6));

      // Create token transfer
      const xfer = await this.wh.tokenTransfer(
        usdcTokenId,
        transferAmount,
        { chain: 'Sui', address: fromAddress },
        { chain: 'Ethereum', address: toAddress },
        false // Manual transfer
      );

      // Get quote for transfer
      const quote = await TokenTransfer.quoteTransfer(
        this.wh,
        suiChain,
        ethChain,
        xfer.transfer
      );

      this.logger.info('Transfer quote:', quote);

      // Initiate transfer on Sui
      const suiSigner = this._createSuiSigner(suiChain, signer);
      const srcTxids = await xfer.initiateTransfer(suiSigner);

      this.logger.info('Transfer initiated on Sui:', srcTxids);

      // Wait for VAA
      const vaa = await this._waitForVAA(xfer, srcTxids);

      this.logger.info('VAA received:', vaa);

      return {
        success: true,
        suiTxHash: srcTxids[0],
        vaa: vaa,
        transfer: xfer,
        quote: quote
      };

    } catch (error) {
      this.logger.error('USDC bridge to Ethereum failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete USDC bridge on Ethereum side
   * @param {Object} params - Completion parameters
   * @param {Object} params.vaa - VAA from bridge initiation
   * @param {Object} params.transfer - Transfer object
   * @param {Object} params.ethSigner - Ethereum signer
   * @returns {Promise<Object>} Completion result
   */
  async completeUSDCBridgeOnEthereum(params) {
    try {
      const { vaa, transfer, ethSigner } = params;

      this.logger.info('Completing USDC bridge on Ethereum...');

      // Get Ethereum chain context
      const ethChain = this.wh.getChain('Ethereum');

      // Create Ethereum signer for SDK
      const ethSignerObj = this._createEthereumSigner(ethChain, ethSigner);

      // Complete transfer on Ethereum
      const dstTxids = await transfer.completeTransfer(ethSignerObj);

      this.logger.info('Transfer completed on Ethereum:', dstTxids);

      return {
        success: true,
        ethTxHash: dstTxids[0]
      };

    } catch (error) {
      this.logger.error('USDC bridge completion on Ethereum failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get bridge status and track transfer progress
   * @param {Object} transfer - Transfer object
   * @returns {Promise<Object>} Status information
   */
  async getBridgeStatus(transfer) {
    try {
      // Check transfer state
      const state = transfer.getTransferState();

      return {
        state: state,
        isComplete: transfer.isComplete(),
        srcTxHash: transfer.srcTxHash,
        dstTxHash: transfer.dstTxHash
      };

    } catch (error) {
      this.logger.error('Failed to get bridge status:', error);
      return {
        error: error.message
      };
    }
  }

  /**
   * Wait for VAA (Verifiable Action Approval) from Guardians
   * @private
   */
  async _waitForVAA(transfer, srcTxids, timeout = 300000) { // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Try to get VAA
        const vaa = await transfer.fetchAttestation(60000); // 1 minute timeout per attempt

        if (vaa) {
          return vaa;
        }

        // Wait 10 seconds before next attempt
        await new Promise(resolve => setTimeout(resolve, 10000));

      } catch (error) {
        this.logger.debug('VAA not ready yet, retrying...', error.message);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    throw new Error('Timeout waiting for VAA');
  }

  /**
   * Create Ethereum signer for Wormhole SDK
   * @private
   */
  async _createEthereumSigner(chainContext, signer) {
    const platform = await evm();
    return await platform.getSigner(await chainContext.getRpc(), signer.privateKey);
  }

  /**
   * Create Sui signer for Wormhole SDK
   * @private
   */
  async _createSuiSigner(chainContext, signer) {
    const platform = await sui();
    return await platform.getSigner(await chainContext.getRpc(), signer.privateKey);
  }

  /**
   * Get supported tokens for bridging
   */
  getSupportedTokens() {
    return {
      ethereum: {
        USDC: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
      },
      sui: {
        // Will need to add wrapped USDC address once deployed
        USDC: '0x...'
      }
    };
  }

  /**
   * Estimate bridge fees
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @param {string} tokenSymbol - Token to bridge
   * @returns {Promise<Object>} Fee estimation
   */
  async estimateBridgeFees(fromChain, toChain, tokenSymbol) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const srcChain = this.wh.getChain(fromChain);
      const dstChain = this.wh.getChain(toChain);

      // Get token info
      const tokenInfo = this.getSupportedTokens()[fromChain.toLowerCase()][tokenSymbol];
      if (!tokenInfo) {
        throw new Error(`Token ${tokenSymbol} not supported on ${fromChain}`);
      }

      // For now return estimated fees, in production would calculate actual fees
      return {
        networkFee: '0.001', // ETH or SUI for gas
        bridgeFee: '0.0001', // Wormhole bridge fee
        totalFee: '0.0011'
      };

    } catch (error) {
      this.logger.error('Failed to estimate bridge fees:', error);
      throw error;
    }
  }
}

export default WormholeService;