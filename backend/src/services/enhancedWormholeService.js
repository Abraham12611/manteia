import { wormhole, Wormhole, amount } from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import sui from '@wormhole-foundation/sdk/sui';
import { ethers } from 'ethers';

/**
 * Enhanced Wormhole Service - Extends basic bridging with quote functionality
 * for unified cross-chain swap system
 * Based on official Wormhole SDK documentation
 * @see https://docs.wormhole.com/wormhole/
 */
export class EnhancedWormholeService {
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
      arbitrum: {
        core: network === 'Testnet'
          ? '0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78'  // Sepolia (same as Ethereum for testnet)
          : '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',  // Mainnet
        tokenBridge: network === 'Testnet'
          ? '0xDB5492265f6038831E89f495670FF909aDe94bd9'  // Sepolia
          : '0x3ee18B2214AFF97000D974cf647E7C347E8fa585'   // Mainnet
      },
      optimism: {
        core: network === 'Testnet'
          ? '0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78'  // Sepolia
          : '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',  // Mainnet
        tokenBridge: network === 'Testnet'
          ? '0xDB5492265f6038831E89f495670FF909aDe94bd9'  // Sepolia
          : '0x3ee18B2214AFF97000D974cf647E7C347E8fa585'   // Mainnet
      },
      polygon: {
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

    // Supported tokens for bridging
    this.supportedTokens = {
      ethereum: {
        USDC: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        WETH: '0xC02aaA39b223FE8c0760A2e5b0d8C60C36e96eSc8',
        DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
      },
      arbitrum: {
        USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548'
      },
      optimism: {
        USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        WETH: '0x4200000000000000000000000000000000000006'
      },
      polygon: {
        USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
      },
      sui: {
        SUI: '0x2::sui::SUI',
        USDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
        USDT: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
        WETH: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN',
        CETUS: '0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS'
      }
    };

    // Token decimals mapping
    this.tokenDecimals = {
      USDC: 6,
      USDT: 6,
      WETH: 18,
      DAI: 18,
      ARB: 18,
      SUI: 9,
      CETUS: 9
    };
  }

  /**
   * Initialize Wormhole SDK with EVM and Sui support
   */
  async initialize() {
    try {
      this.logger.info('Initializing Enhanced Wormhole SDK...');

      // Initialize Wormhole with EVM and Sui platforms
      this.wh = await wormhole(this.network, [evm, sui]);

      this.logger.info(`Enhanced Wormhole SDK initialized for ${this.network}`);
      this.initialized = true;

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Wormhole SDK:', error);
      return false;
    }
  }

  /**
   * Get bridge quote for cross-chain transfer
   * @param {Object} params - Quote parameters
   * @param {string} params.fromChain - Source chain (ethereum, arbitrum, optimism, polygon, sui)
   * @param {string} params.toChain - Destination chain
   * @param {string} params.token - Token symbol (USDC, USDT, WETH, etc.)
   * @param {string} params.amount - Amount to bridge
   * @returns {Promise<Object>} Bridge quote
   */
  async getBridgeQuote(params) {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Wormhole Service not initialized');
      }

      const { fromChain, toChain, token, amount } = params;

      this.logger.info(`Getting bridge quote: ${amount} ${token} from ${fromChain} to ${toChain}`);

      // Validate supported chains and tokens
      if (!this.supportedTokens[fromChain] || !this.supportedTokens[toChain]) {
        throw new Error(`Unsupported chain: ${fromChain} or ${toChain}`);
      }

      if (!this.supportedTokens[fromChain][token]) {
        throw new Error(`Token ${token} not supported on ${fromChain}`);
      }

      // Get token addresses
      const fromTokenAddress = this.supportedTokens[fromChain][token];
      const toTokenAddress = this.supportedTokens[toChain][token];
      const decimals = this.tokenDecimals[token];

      // Get chain contexts
      const fromChainContext = this.wh.getChain(this._getChainName(fromChain));
      const toChainContext = this.wh.getChain(this._getChainName(toChain));

      // Create token ID using Wormhole.tokenId
      const tokenId = Wormhole.tokenId(this._getChainName(fromChain), fromTokenAddress);

      // Convert amount to proper format
      const transferAmount = amount.units(amount.parse(amount, decimals));

      // Create transfer object first
      const xfer = await this.wh.tokenTransfer(
        tokenId,
        transferAmount,
        { chain: this._getChainName(fromChain), address: fromAddress },
        { chain: this._getChainName(toChain), address: toAddress },
        false // Manual transfer
      );

      // Get quote for transfer
      const quote = await xfer.quoteTransfer();

      // Calculate fees
      const bridgeFee = quote.fee;
      const estimatedGas = quote.estimatedGas || '0';

      // Estimate time based on network
      const estimatedTime = this._estimateBridgeTime(fromChain, toChain);

      // Get wrapped token info for destination
      const wrappedTokenInfo = await this._getWrappedTokenInfo(toChain, token);

      this.logger.info(`Bridge quote received:`, {
        fromChain,
        toChain,
        token,
        amount,
        bridgeFee: bridgeFee.toString(),
        estimatedGas,
        estimatedTime,
        wrappedToken: wrappedTokenInfo.address
      });

      return {
        success: true,
        fromChain,
        toChain,
        token,
        amount,
        bridgeFee: bridgeFee.toString(),
        estimatedGas,
        estimatedTime,
        wrappedToken: wrappedTokenInfo.address,
        wrappedTokenSymbol: wrappedTokenInfo.symbol,
        receivedAmount: amount, // Same amount (minus fees)
        quote
      };

    } catch (error) {
      this.logger.error('Failed to get bridge quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute bridge transfer
   * @param {Object} params - Bridge parameters
   * @param {string} params.fromChain - Source chain
   * @param {string} params.toChain - Destination chain
   * @param {string} params.token - Token symbol
   * @param {string} params.amount - Amount to bridge
   * @param {string} params.fromAddress - Source address
   * @param {string} params.toAddress - Destination address
   * @param {Object} params.signer - Transaction signer
   * @returns {Promise<Object>} Bridge result
   */
  async executeBridge(params) {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Wormhole Service not initialized');
      }

      const { fromChain, toChain, token, amount, fromAddress, toAddress, signer } = params;

      this.logger.info(`Executing bridge: ${amount} ${token} from ${fromChain} to ${toChain}`);

      // Get quote first
      const quote = await this.getBridgeQuote({
        fromChain,
        toChain,
        token,
        amount
      });

      if (!quote.success) {
        throw new Error(`Failed to get bridge quote: ${quote.error}`);
      }

      // Get chain contexts
      const fromChainContext = this.wh.getChain(this._getChainName(fromChain));
      const toChainContext = this.wh.getChain(this._getChainName(toChain));

      // Create token ID using Wormhole.tokenId
      const fromTokenAddress = this.supportedTokens[fromChain][token];
      const tokenId = Wormhole.tokenId(this._getChainName(fromChain), fromTokenAddress);

      // Convert amount to proper format
      const decimals = this.tokenDecimals[token];
      const transferAmount = amount.units(amount.parse(amount, decimals));

      // Create token transfer
      const xfer = await this.wh.tokenTransfer(
        tokenId,
        transferAmount,
        { chain: this._getChainName(fromChain), address: fromAddress },
        { chain: this._getChainName(toChain), address: toAddress },
        false // Manual transfer (we handle completion)
      );

      // Execute transfer
      const srcTxids = await xfer.initiateTransfer(signer);

      this.logger.info(`Bridge initiated:`, {
        transferId: xfer.transferId,
        srcTxids
      });

      return {
        success: true,
        transferId: xfer.transferId,
        srcTxids,
        quote,
        status: 'initiated'
      };

    } catch (error) {
      this.logger.error('Failed to execute bridge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete bridge on destination chain
   * @param {Object} params - Completion parameters
   * @param {string} params.transferId - Transfer ID from initiate
   * @param {string} params.toChain - Destination chain
   * @param {Object} params.signer - Destination chain signer
   * @returns {Promise<Object>} Completion result
   */
  async completeBridge(params) {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Wormhole Service not initialized');
      }

      const { transferId, toChain, signer } = params;

      this.logger.info(`Completing bridge on ${toChain} for transfer ${transferId}`);

      // Get transfer by ID
      const xfer = await this.wh.getTransfer(transferId);

      // Wait for VAA
      const vaa = await this._waitForVAA(xfer, [], 300000); // 5 minutes timeout

      // Complete transfer
      const dstTxids = await xfer.completeTransfer(signer, vaa);

      this.logger.info(`Bridge completed:`, {
        transferId,
        dstTxids
      });

      return {
        success: true,
        transferId,
        dstTxids,
        status: 'completed'
      };

    } catch (error) {
      this.logger.error('Failed to complete bridge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get bridge status
   * @param {string} transferId - Transfer ID
   * @returns {Promise<Object>} Transfer status
   */
  async getBridgeStatus(transferId) {
    try {
      if (!this.initialized) {
        throw new Error('Enhanced Wormhole Service not initialized');
      }

      const xfer = await this.wh.getTransfer(transferId);
      const status = await xfer.getStatus();

      return {
        success: true,
        transferId,
        status: status.status,
        details: status
      };

    } catch (error) {
      this.logger.error('Failed to get bridge status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get supported tokens for a chain
   * @param {string} chain - Chain name
   * @returns {Array} Supported tokens
   */
  getSupportedTokensForChain(chain) {
    return this.supportedTokens[chain] || {};
  }

  /**
   * Get all supported chains
   * @returns {Array} Supported chains
   */
  getSupportedChains() {
    return Object.keys(this.supportedTokens);
  }

  /**
   * Check if token is supported for bridging
   * @param {string} chain - Chain name
   * @param {string} token - Token symbol
   * @returns {boolean} Is supported
   */
  isTokenSupported(chain, token) {
    return !!(this.supportedTokens[chain] && this.supportedTokens[chain][token]);
  }

  /**
   * Helper: Convert chain name to Wormhole format
   * @private
   */
  _getChainName(chain) {
    const chainMap = {
      ethereum: 'Ethereum',
      arbitrum: 'Arbitrum',
      optimism: 'Optimism',
      polygon: 'Polygon',
      sui: 'Sui'
    };
    return chainMap[chain] || chain;
  }

  /**
   * Helper: Estimate bridge time
   * @private
   */
  _estimateBridgeTime(fromChain, toChain) {
    // Base times in minutes
    const baseTimes = {
      ethereum: 15,
      arbitrum: 10,
      optimism: 10,
      polygon: 10,
      sui: 5
    };

    const fromTime = baseTimes[fromChain] || 15;
    const toTime = baseTimes[toChain] || 10;

    return `${Math.max(fromTime, toTime)} minutes`;
  }

  /**
   * Helper: Get wrapped token info
   * @private
   */
  async _getWrappedTokenInfo(chain, token) {
    // For now, return the same token (in real implementation, this would query the bridge)
    return {
      address: this.supportedTokens[chain][token],
      symbol: token,
      isWrapped: false
    };
  }

  /**
   * Helper: Wait for VAA (Valid Action Approval)
   * @private
   */
  async _waitForVAA(transfer, srcTxids, timeout = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const vaa = await transfer.fetchAttestation(srcTxids);
        if (vaa) {
          return vaa;
        }
      } catch (error) {
        // VAA not ready yet, continue waiting
      }

      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('VAA timeout - bridge may have failed');
  }
}