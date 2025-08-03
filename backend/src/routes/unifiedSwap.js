import { Router } from 'express';
import Joi from 'joi';
import { UnifiedQuoteEngine } from '../services/unifiedQuoteEngine.js';
import { swapRateLimiter, quoteRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Initialize unified quote engine
const unifiedQuoteEngine = new UnifiedQuoteEngine({
  logger: console,
  network: process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet'
});

// Initialize the engine on startup
unifiedQuoteEngine.initialize().catch(error => {
  console.error('Failed to initialize Unified Quote Engine:', error);
});

// Validation schemas
const getQuoteSchema = Joi.object({
  fromChain: Joi.string().valid('ethereum', 'arbitrum', 'optimism', 'polygon', 'sui').required(),
  toChain: Joi.string().valid('ethereum', 'arbitrum', 'optimism', 'polygon', 'sui').required(),
  fromToken: Joi.string().required(),
  toToken: Joi.string().required(),
  amount: Joi.string().required(),
  slippage: Joi.number().min(0.1).max(50).default(0.5)
});

const getTokensSchema = Joi.object({
  chain: Joi.string().valid('ethereum', 'arbitrum', 'optimism', 'polygon', 'sui').required()
});

const searchTokensSchema = Joi.object({
  chain: Joi.string().valid('ethereum', 'arbitrum', 'optimism', 'polygon', 'sui').required(),
  query: Joi.string().min(2).required()
});

// Validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    // For routes with path parameters, combine params with query/body
    const dataToValidate = {
      ...req.params,
      ...(req.method === 'GET' ? req.query : req.body)
    };
    const { error, value } = schema.validate(dataToValidate);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }
    req.validatedData = value;
    next();
  };
}

// Get supported chains
router.get('/chains', async (req, res) => {
  try {
    const { logger } = req;
    logger.info('Fetching supported chains');

    const chains = unifiedQuoteEngine.getSupportedChains();
    const chainDetails = chains.map(chain => ({
      id: chain,
      name: getChainDisplayName(chain),
      logoUrl: getChainLogoUrl(chain),
      isEVM: chain !== 'sui'
    }));

    res.json({
      success: true,
      chains: chainDetails,
      count: chains.length,
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Chains fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chains',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get available tokens for a chain
router.get('/tokens/:chain', validateRequest(getTokensSchema), async (req, res) => {
  try {
    const { logger } = req;
    const { chain } = req.validatedData;

    logger.info('Tokens request', { chain });

    const tokens = await unifiedQuoteEngine.getAvailableTokens(chain);

    res.json({
      success: true,
      chain,
      tokens,
      count: tokens.length,
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Tokens fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tokens',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get popular tokens for a chain
router.get('/tokens/:chain/popular', validateRequest(getTokensSchema), async (req, res) => {
  try {
    const { logger } = req;
    const { chain } = req.validatedData;

    logger.info('Popular tokens request', { chain });

    const popularTokens = await unifiedQuoteEngine.getPopularTokens(chain);

    res.json({
      success: true,
      chain,
      tokens: popularTokens,
      count: popularTokens.length,
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Popular tokens fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular tokens',
      message: error.message,
      requestId: req.id
    });
  }
});

// Search tokens
router.get('/tokens/:chain/search', validateRequest(searchTokensSchema), async (req, res) => {
  try {
    const { logger } = req;
    const { chain, query } = req.validatedData;

    logger.info('Token search request', { chain, query });

    const tokens = await unifiedQuoteEngine.searchTokens(chain, query);

    res.json({
      success: true,
      chain,
      query,
      tokens,
      count: tokens.length,
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Token search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tokens',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get unified swap quote
router.post('/quote', quoteRateLimiter, validateRequest(getQuoteSchema), async (req, res) => {
  try {
    const { logger } = req;
    const { fromChain, toChain, fromToken, toToken, amount, slippage } = req.validatedData;

    logger.info('Unified quote request', { fromChain, toChain, fromToken, toToken, amount, slippage });

    const result = await unifiedQuoteEngine.getQuote({
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
      slippage
    });

    if (result.success) {
      res.json({
        success: true,
        quote: result,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Quote failed',
        message: result.error,
        requestId: req.id
      });
    }
  } catch (error) {
    req.logger.error('Quote error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quote',
      message: error.message,
      requestId: req.id
    });
  }
});

// Check if cross-chain swap is supported
router.get('/supported', async (req, res) => {
  try {
    const { logger } = req;
    const { fromChain, toChain, token } = req.query;

    if (!fromChain || !toChain || !token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromChain, toChain, token',
        requestId: req.id
      });
    }

    logger.info('Cross-chain support check', { fromChain, toChain, token });

    const isSupported = unifiedQuoteEngine.isCrossChainSupported(fromChain, toChain, token);

    res.json({
      success: true,
      fromChain,
      toChain,
      token,
      isSupported,
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Support check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check support',
      message: error.message,
      requestId: req.id
    });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const health = await unifiedQuoteEngine.healthCheck();

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: health.status === 'healthy',
      health,
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Health check error:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
      requestId: req.id
    });
  }
});

// Clear cache (for development/testing)
router.post('/cache/clear', async (req, res) => {
  try {
    const { logger } = req;
    logger.info('Clearing unified swap cache');

    // Clear caches from all services
    if (unifiedQuoteEngine.cetusService) {
      unifiedQuoteEngine.cetusService.clearCache();
    }
    if (unifiedQuoteEngine.oneInchService) {
      unifiedQuoteEngine.oneInchService.clearCache();
    }

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message,
      requestId: req.id
    });
  }
});

// Helper functions
function getChainDisplayName(chain) {
  const names = {
    ethereum: 'Ethereum',
    arbitrum: 'Arbitrum One',
    optimism: 'Optimism',
    polygon: 'Polygon',
    sui: 'Sui'
  };
  return names[chain] || chain;
}

function getChainLogoUrl(chain) {
  const logos = {
    ethereum: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    arbitrum: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21-47-00.jpg',
    optimism: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png',
    polygon: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
    sui: 'https://raw.githubusercontent.com/sui-foundation/sui/main/apps/wallet/src/ui/assets/sui-logo.svg'
  };
  return logos[chain] || '';
}

export default router;