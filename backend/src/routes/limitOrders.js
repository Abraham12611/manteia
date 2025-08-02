import { Router } from 'express';
import Joi from 'joi';
import { swapRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Enhanced validation schemas for advanced strategies
const concentratedLiquiditySchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  maker: Joi.string().required(),
  priceRange: Joi.object({
    ranges: Joi.array().items(Joi.object({
      lowerPrice: Joi.string().required(),
      upperPrice: Joi.string().required(),
      liquidityAmount: Joi.string().required()
    })).min(1).required()
  }).required(),
  rebalanceThreshold: Joi.number().min(0.01).max(50).default(5),
  impermanentLossProtection: Joi.boolean().default(false)
});

const multiLegOptionsSchema = Joi.object({
  chainId: Joi.number().required(),
  maker: Joi.string().required(),
  spreadType: Joi.string().valid('vertical', 'horizontal', 'diagonal').required(),
  legs: Joi.array().items(Joi.object({
    makerAsset: Joi.string().required(),
    takerAsset: Joi.string().required(),
    underlying: Joi.string().required(),
    strikePrice: Joi.string().required(),
    optionType: Joi.string().valid('call', 'put').required(),
    expiry: Joi.number().required(),
    amount: Joi.string().required(),
    delta: Joi.number().optional()
  })).min(2).required(),
  deltaHedging: Joi.object({
    enabled: Joi.boolean().default(false),
    rebalanceThreshold: Joi.number().min(0.01).max(10).default(1)
  }).default({ enabled: false })
});

const customStrategySchema = Joi.object({
  chainId: Joi.number().required(),
  type: Joi.string().required(),
  conditions: Joi.object().required(),
  execution: Joi.object().required(),
  monitoring: Joi.object().optional(),
  riskManagement: Joi.object().optional()
});

const strategyAdjustmentSchema = Joi.object({
  adjustments: Joi.object().required()
});

// Validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
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

// Create concentrated liquidity order
router.post('/concentrated', swapRateLimiter, validateRequest(concentratedLiquiditySchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating concentrated liquidity order', orderData);

    // Create concentrated liquidity order using enhanced service
    const result = await services.limitOrder.createConcentratedLiquidityOrder(orderData);

    // Store order info for tracking
    const orderInfo = {
      strategyId: result.orders[0].orderHash,
      type: 'concentrated_liquidity',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      maker: orderData.maker,
      priceRanges: orderData.priceRange.ranges.length,
      status: 'created',
      createdAt: new Date().toISOString(),
      orders: result.orders.map(order => ({
        orderHash: order.orderHash || order.id,
        status: 'active'
      }))
    };

    res.json({
      success: true,
      strategy: orderInfo,
      onchainOrders: result.orders,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Concentrated liquidity order creation error:', error);
    res.status(500).json({
      error: 'Failed to create concentrated liquidity order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Create multi-leg options order
router.post('/multi-leg-options', swapRateLimiter, validateRequest(multiLegOptionsSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating multi-leg options order', orderData);

    // Create multi-leg options order using enhanced service
    const result = await services.limitOrder.createMultiLegOptionsOrder(orderData);

    // Store order info for tracking
    const orderInfo = {
      strategyId: result.orders[0].orderHash,
      type: 'multi_leg_options',
      chainId: orderData.chainId,
      maker: orderData.maker,
      spreadType: result.spreadType,
      legs: orderData.legs.length,
      status: 'created',
      createdAt: new Date().toISOString(),
      orders: result.orders.map(order => ({
        orderHash: order.orderHash || order.id,
        status: 'active'
      }))
    };

    res.json({
      success: true,
      strategy: orderInfo,
      onchainOrders: result.orders,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Multi-leg options order creation error:', error);
    res.status(500).json({
      error: 'Failed to create multi-leg options order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Create custom strategy order
router.post('/custom-strategy', swapRateLimiter, validateRequest(customStrategySchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating custom strategy order', orderData);

    // Create custom strategy order using enhanced service
    const result = await services.limitOrder.createCustomStrategyOrder(orderData);

    // Store order info for tracking
    const orderInfo = {
      strategyId: result.orderHash,
      type: orderData.type,
      chainId: orderData.chainId,
      status: 'created',
      createdAt: new Date().toISOString(),
      orderHash: result.orderHash
    };

    res.json({
      success: true,
      strategy: orderInfo,
      onchainOrder: result,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Custom strategy order creation error:', error);
    res.status(500).json({
      error: 'Failed to create custom strategy order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get active strategies
router.get('/active', async (req, res) => {
  try {
    const { services, logger } = req;

    logger.info('Fetching active strategies');

    const activeStrategies = services.limitOrder.getActiveStrategies();

    res.json({
      success: true,
      strategies: activeStrategies,
      count: activeStrategies.length,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error fetching active strategies:', error);
    res.status(500).json({
      error: 'Failed to fetch active strategies',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get order history
router.get('/history', async (req, res) => {
  try {
    const { services, logger } = req;
    const { limit = 100, offset = 0 } = req.query;

    logger.info('Fetching order history', { limit, offset });

    // This would typically query a database
    // For now, return mock data
    const history = [
      {
        id: '1',
        type: 'concentrated_liquidity',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date().toISOString(),
        orders: 3,
        totalValue: '1000.00'
      },
      {
        id: '2',
        type: 'multi_leg_options',
        status: 'active',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        orders: 2,
        totalValue: '500.00'
      }
    ];

    res.json({
      success: true,
      history: history.slice(offset, offset + limit),
      total: history.length,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error fetching order history:', error);
    res.status(500).json({
      error: 'Failed to fetch order history',
      message: error.message,
      requestId: req.id
    });
  }
});

// Adjust strategy parameters
router.put('/adjust/:strategyId', swapRateLimiter, validateRequest(strategyAdjustmentSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const { strategyId } = req.params;
    const { adjustments } = req.validatedData;

    logger.info('Adjusting strategy', { strategyId, adjustments });

    // Adjust strategy using enhanced service
    const result = await services.limitOrder.adjustStrategy(strategyId, adjustments);

    res.json({
      success: true,
      result,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Strategy adjustment error:', error);
    res.status(500).json({
      error: 'Failed to adjust strategy',
      message: error.message,
      requestId: req.id
    });
  }
});

// Cancel order
router.delete('/cancel/:orderHash', async (req, res) => {
  try {
    const { services, logger } = req;
    const { orderHash } = req.params;

    logger.info('Cancelling order', { orderHash });

    // Cancel order using enhanced service
    const result = await services.limitOrder.cancelOrder(orderHash);

    res.json({
      success: true,
      result,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Order cancellation error:', error);
    res.status(500).json({
      error: 'Failed to cancel order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Monitor order status
router.post('/monitor/:orderHash', async (req, res) => {
  try {
    const { services, logger } = req;
    const { orderHash } = req.params;

    logger.info('Monitoring order', { orderHash });

    // Monitor order using enhanced service
    const result = await services.limitOrder.monitorOrder(orderHash);

    res.json({
      success: true,
      result,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Order monitoring error:', error);
    res.status(500).json({
      error: 'Failed to monitor order',
      message: error.message,
      requestId: req.id
    });
  }
});

export default router;