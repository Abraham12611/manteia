import { Router } from 'express';
import Joi from 'joi';
import { OneInchMultiNetworkService } from '../services/oneInchMultiNetworkService.js';
import { swapRateLimiter, quoteRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Initialize 1inch service
const oneInchService = new OneInchMultiNetworkService({
  apiKey: process.env.ONEINCH_API_KEY || 'OXORyGCQaZWg7NKa4gniPZnaLuGutkyu'
});

// Validation schemas
const getTokensSchema = Joi.object({
  chainId: Joi.number().required()
});

const quoteSchema = Joi.object({
  chainId: Joi.number().required(),
  src: Joi.string().required(),
  dst: Joi.string().required(),
  amount: Joi.string().required()
});

const swapSchema = Joi.object({
  chainId: Joi.number().required(),
  src: Joi.string().required(),
  dst: Joi.string().required(),
  amount: Joi.string().required(),
  from: Joi.string().required(),
  slippage: Joi.number().min(0).max(50).default(1)
});

// Validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    const dataToValidate = req.method === 'GET' ? req.query : req.body;
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

// Get supported networks
router.get('/networks', async (req, res) => {
  try {
    const { logger } = req;
    logger.info('Fetching supported networks');

    const networks = oneInchService.networks;
    const networksArray = Object.entries(networks).map(([key, network]) => ({
      key,
      ...network
    }));

    res.json({
      success: true,
      networks: networksArray,
      count: networksArray.length,
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Networks fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get networks',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get tokens for a specific network
router.get('/tokens/:chainId', async (req, res) => {
  try {
    const { logger } = req;
    const chainId = parseInt(req.params.chainId);

    if (isNaN(chainId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chain ID',
        requestId: req.id
      });
    }

    logger.info('Tokens request', { chainId });

    const tokens = await oneInchService.getTokens(chainId);

    res.json({
      success: true,
      chainId,
      tokens,
      count: Object.keys(tokens).length,
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

// Get popular tokens for a specific network
router.get('/tokens/:chainId/popular', async (req, res) => {
  try {
    const { logger } = req;
    const chainId = parseInt(req.params.chainId);

    if (isNaN(chainId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chain ID',
        requestId: req.id
      });
    }

    logger.info('Popular tokens request', { chainId });

    const popularTokens = await oneInchService.getPopularTokens(chainId);

    res.json({
      success: true,
      chainId,
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

// Get swap quote
router.post('/quote', quoteRateLimiter, validateRequest(quoteSchema), async (req, res) => {
  try {
    const { logger } = req;
    const { chainId, src, dst, amount } = req.validatedData;

    logger.info('Quote request', { chainId, src, dst, amount });

    const result = await oneInchService.getQuote({
      chainId,
      src,
      dst,
      amount
    });

    if (result.success) {
      res.json({
        success: true,
        quote: result.quote,
        chainId,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Quote failed',
        message: result.error,
        chainId,
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

// Build swap transaction
router.post('/swap', swapRateLimiter, validateRequest(swapSchema), async (req, res) => {
  try {
    const { logger } = req;
    const { chainId, src, dst, amount, from, slippage } = req.validatedData;

    logger.info('Swap build request', { chainId, src, dst, amount, from, slippage });

    const result = await oneInchService.buildSwap({
      chainId,
      src,
      dst,
      amount,
      from,
      slippage
    });

    if (result.success) {
      res.json({
        success: true,
        swap: result.swap,
        chainId,
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Swap build failed',
        message: result.error,
        chainId,
        requestId: req.id
      });
    }
  } catch (error) {
    req.logger.error('Swap build error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to build swap',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get token prices
router.get('/prices/:chainId', async (req, res) => {
  try {
    const { logger } = req;
    const chainId = parseInt(req.params.chainId);
    const { tokens } = req.query; // Comma-separated token addresses

    if (!tokens) {
      return res.status(400).json({
        success: false,
        error: 'Missing tokens parameter',
        requestId: req.id
      });
    }

    const tokenAddresses = tokens.split(',');
    logger.info('Price request', { chainId, tokens: tokenAddresses });

    const prices = await oneInchService.getTokenPrice(chainId, tokenAddresses);

    res.json({
      success: true,
      chainId,
      prices,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  } catch (error) {
    req.logger.error('Price fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prices',
      message: error.message,
      requestId: req.id
    });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const health = await oneInchService.healthCheck();

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
    logger.info('Clearing 1inch service cache');

    oneInchService.clearCache();

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

export default router;