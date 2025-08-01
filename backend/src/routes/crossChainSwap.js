import express from 'express';
import logger from '../utils/logger.js';
import { CrossChainSwapService } from '../services/crossChainSwapService.js';

const router = express.Router();

// Initialize cross-chain swap service
let crossChainSwapService;

const initializeCrossChainService = async () => {
  if (!crossChainSwapService) {
    crossChainSwapService = new CrossChainSwapService({
      oneInchApiKey: process.env.ONEINCH_API_KEY,
      network: process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet',
      logger
    });

    const initialized = await crossChainSwapService.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize CrossChainSwapService');
    }
  }
  return crossChainSwapService;
};

/**
 * GET /api/swap/test-1inch
 * Test 1inch API directly
 */
router.get('/test-1inch', async (req, res) => {
  try {
    logger.info('Testing 1inch API...');
    const service = await initializeCrossChainService();

    // Test simple ETH to USDC quote on Sepolia
    const testQuote = await service.oneInchService.getSwapQuote({
      src: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
      dst: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Sepolia
      amount: '20000000000000000', // 0.02 ETH in wei
      chainId: 11155111 // Sepolia
    });

    logger.info('1inch test result:', testQuote);
    res.json({
      success: true,
      test: '1inch API',
      result: testQuote
    });
  } catch (error) {
    logger.error('1inch test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/swap/quote
 * Get cross-chain swap quote
 */
router.post('/quote', async (req, res) => {
  try {
    logger.info('Quote request received:', req.body);
    const { fromChain, toChain, amount, fromToken, toToken, slippage } = req.body;

    // Validate required parameters
    if (!fromChain || !toChain || !amount || !fromToken || !toToken) {
      logger.warn('Missing required parameters:', { fromChain, toChain, amount, fromToken, toToken });
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    logger.info('Initializing cross-chain service...');
    const service = await initializeCrossChainService();
    logger.info('Cross-chain service initialized, getting quote...');

    const quoteResult = await service.getCrossChainQuote({
      fromChain,
      toChain,
      amount,
      fromToken,
      toToken,
      slippage: slippage || 0.5
    });

    logger.info('Quote result:', { success: quoteResult.success, hasQuote: !!quoteResult.quote });

    if (quoteResult.success) {
      const response = {
        success: true,
        quote: {
          inputAmount: amount,
          outputAmount: quoteResult.quote.estimatedOutput,
          priceImpact: quoteResult.quote.priceImpact,
          minimumReceived: (parseFloat(quoteResult.quote.estimatedOutput) * (1 - (slippage || 0.5) / 100)).toString(),
          steps: quoteResult.quote.steps,
          fees: quoteResult.quote.fees,
          route: []
        }
      };
      logger.info('Sending successful quote response');
      res.json(response);
    } else {
      logger.error('Quote failed:', quoteResult.error);
      res.status(400).json({
        success: false,
        error: quoteResult.error
      });
    }

  } catch (error) {
    logger.error('Error getting swap quote:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/swap/execute
 * Execute cross-chain swap
 */
router.post('/execute', async (req, res) => {
  try {
    const {
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
      slippage,
      fromAddress,
      toAddress,
      deadline
    } = req.body;

    // Validate required parameters
    if (!fromChain || !toChain || !amount || !fromToken || !toToken || !fromAddress || !toAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const service = await initializeCrossChainService();

    // Execute the appropriate swap flow
    let swapResult;
    if (fromChain === 'ethereum' && toChain === 'sui') {
      swapResult = await service.executeETHToSUISwap({
        ethAmount: amount,
        fromAddress,
        toAddress,
        slippage: slippage || 0.5,
        // Note: In production, signers would be handled differently
        ethSigner: null, // Placeholder - actual signing handled by frontend
        suiSigner: null  // Placeholder - actual signing handled by frontend
      });
    } else if (fromChain === 'sui' && toChain === 'ethereum') {
      swapResult = await service.executeSUIToETHSwap({
        suiAmount: amount,
        fromAddress,
        toAddress,
        slippage: slippage || 0.5,
        suiSigner: null, // Placeholder
        ethSigner: null  // Placeholder
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported swap direction'
      });
    }

    if (swapResult.success) {
      res.json({
        success: true,
        swapId: swapResult.swapId,
        swap: service.getSwapStatus(swapResult.swapId)
      });
    } else {
      res.status(400).json({
        success: false,
        error: swapResult.error
      });
    }

  } catch (error) {
    logger.error('Error executing swap:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/swap/status/:swapId
 * Get swap status
 */
router.get('/status/:swapId', async (req, res) => {
  try {
    const { swapId } = req.params;

    if (!swapId) {
      return res.status(400).json({
        success: false,
        error: 'Swap ID required'
      });
    }

    const service = await initializeCrossChainService();
    const swapStatus = service.getSwapStatus(swapId);

    if (swapStatus.found) {
      res.json({
        success: true,
        swap: swapStatus
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Swap not found'
      });
    }

  } catch (error) {
    logger.error('Error getting swap status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/swap/history
 * Get swap history for addresses
 */
router.post('/history', async (req, res) => {
  try {
    const { addresses, limit = 10, filter } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Addresses array required'
      });
    }

    const service = await initializeCrossChainService();
    const allSwaps = service.getAllActiveSwaps();

    // Filter swaps by addresses and status
    let filteredSwaps = allSwaps.filter(swap =>
      addresses.includes(swap.fromAddress) || addresses.includes(swap.toAddress)
    );

    if (filter) {
      switch (filter) {
        case 'completed':
          filteredSwaps = filteredSwaps.filter(swap => swap.status === 'COMPLETED');
          break;
        case 'pending':
          filteredSwaps = filteredSwaps.filter(swap =>
            !['COMPLETED', 'FAILED'].includes(swap.status)
          );
          break;
        case 'failed':
          filteredSwaps = filteredSwaps.filter(swap => swap.status === 'FAILED');
          break;
      }
    }

    // Sort by creation time (newest first) and limit
    const sortedSwaps = filteredSwaps
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);

    res.json({
      success: true,
      swaps: sortedSwaps
    });

  } catch (error) {
    logger.error('Error getting swap history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/swap/estimate-gas
 * Estimate gas costs for swap
 */
router.post('/estimate-gas', async (req, res) => {
  try {
    const { fromChain, toChain, amount, fromToken, toToken } = req.body;

    // For now, return mock gas estimates
    // In production, this would calculate actual gas costs
    const gasEstimates = {
      ethereum: fromChain === 'ethereum' || toChain === 'ethereum' ? '0.003' : undefined,
      sui: fromChain === 'sui' || toChain === 'sui' ? '0.001' : undefined
    };

    res.json({
      success: true,
      gasEstimates
    });

  } catch (error) {
    logger.error('Error estimating gas costs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/swap/supported-tokens
 * Get supported tokens for each chain
 */
router.get('/supported-tokens', async (req, res) => {
  try {
    const supportedTokens = {
      ethereum: [
        { symbol: "ETH", name: "Ethereum", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", name: "USD Coin", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 }, // Sepolia
      ],
      sui: [
        { symbol: "SUI", name: "Sui", address: "0x2::sui::SUI", decimals: 9 },
        { symbol: "USDC", name: "USD Coin", address: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN", decimals: 6 },
      ]
    };

    res.json({
      success: true,
      tokens: supportedTokens
    });

  } catch (error) {
    logger.error('Error getting supported tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;