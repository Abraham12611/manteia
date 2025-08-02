import { Router } from 'express';
import Joi from 'joi';
import { swapRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Enhanced TWAP validation schema
const enhancedTWAPSchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  maker: Joi.string().required(),
  totalAmount: Joi.string().required(),
  intervals: Joi.number().min(2).max(100).required(),
  duration: Joi.number().min(60).required(),
  slippageProtection: Joi.object({
    maxSlippage: Joi.number().min(0.001).max(0.1).default(0.01),
    priceImpactThreshold: Joi.number().min(0.001).max(0.05).default(0.005),
    emergencyStop: Joi.boolean().default(true)
  }).default({}),
  dynamicAdjustment: Joi.object({
    enabled: Joi.boolean().default(true),
    marketConditionThreshold: Joi.number().min(0.01).max(0.1).default(0.02),
    intervalAdjustmentFactor: Joi.number().min(0.1).max(1).default(0.5)
  }).default({}),
  partialFillHandling: Joi.object({
    enabled: Joi.boolean().default(true),
    merkleTreeSecrets: Joi.boolean().default(true),
    retryFailedIntervals: Joi.boolean().default(true)
  }).default({})
});

// Barrier options validation schema
const barrierOptionsSchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  maker: Joi.string().required(),
  underlying: Joi.string().required(),
  amount: Joi.string().required(),
  barrierType: Joi.string().valid('knock-in', 'knock-out').required(),
  barrierLevel: Joi.string().required(),
  strikePrice: Joi.string().required(),
  expiry: Joi.number().required(),
  optionType: Joi.string().valid('call', 'put').required(),
  monitoring: Joi.object({
    frequency: Joi.number().min(30).max(3600).default(300),
    continuous: Joi.boolean().default(true)
  }).default({})
});

// Dynamic delta hedging validation schema
const dynamicDeltaHedgingSchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  maker: Joi.string().required(),
  underlying: Joi.string().required(),
  strikePrice: Joi.string().required(),
  optionType: Joi.string().valid('call', 'put').required(),
  optionPosition: Joi.object().required(),
  deltaTarget: Joi.number().min(-1).max(1).default(0),
  rebalanceThreshold: Joi.number().min(0.01).max(0.5).default(0.1),
  hedgingAsset: Joi.string().required(),
  monitoring: Joi.object({
    frequency: Joi.number().min(30).max(3600).default(60),
    maxRebalances: Joi.number().min(1).max(50).default(10)
  }).default({})
});

// Custom strategy validation schema
const customStrategySchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  maker: Joi.string().required(),
  amount: Joi.string().required(),
  type: Joi.string().required(),
  config: Joi.object({
    timeConditions: Joi.array().items(Joi.object({
      startTime: Joi.number().required(),
      endTime: Joi.number().required(),
      operator: Joi.number().valid(0, 1).default(0)
    })).optional(),
    priceConditions: Joi.array().items(Joi.object({
      token: Joi.string().required(),
      strikePrice: Joi.string().required(),
      optionType: Joi.string().valid('call', 'put').required(),
      expiry: Joi.number().required(),
      operator: Joi.number().valid(0, 1).default(0)
    })).optional(),
    volumeConditions: Joi.array().items(Joi.object({
      token: Joi.string().required(),
      minVolume: Joi.string().required(),
      maxVolume: Joi.string().required(),
      timeframe: Joi.number().required(),
      operator: Joi.number().valid(0, 1).default(0)
    })).optional(),
    customConditions: Joi.array().items(Joi.object({
      conditions: Joi.string().required(),
      customLogic: Joi.string().required(),
      operator: Joi.number().valid(0, 1).default(0)
    })).optional(),
    actions: Joi.array().items(Joi.object({
      type: Joi.number().required(),
      data: Joi.string().required()
    })).optional(),
    logic: Joi.string().valid('AND', 'OR').default('AND')
  }).required(),
  metadata: Joi.object().optional()
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

// Create enhanced TWAP order
router.post('/enhanced-twap', swapRateLimiter, validateRequest(enhancedTWAPSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating enhanced TWAP order', orderData);

    const result = await services.limitOrder.createEnhancedTWAPOrder(orderData);

    const orderInfo = {
      strategyId: result.orders[0].orderHash,
      type: 'enhanced_twap',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      maker: orderData.maker,
      totalAmount: orderData.totalAmount,
      intervals: result.dynamicIntervals,
      duration: orderData.duration,
      status: 'created',
      createdAt: new Date().toISOString(),
      merkleRoot: result.merkleRoot,
      orders: result.orders.map(order => ({
        orderHash: order.orderHash || order.id,
        interval: order.interval,
        status: 'active'
      }))
    };

    res.json({
      success: true,
      strategy: orderInfo,
      onchainOrders: result.orders,
      secrets: result.secrets,
      merkleRoot: result.merkleRoot,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Enhanced TWAP order creation error:', error);
    res.status(500).json({
      error: 'Failed to create enhanced TWAP order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Create barrier options order
router.post('/barrier-options', swapRateLimiter, validateRequest(barrierOptionsSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating barrier options order', orderData);

    const result = await services.limitOrder.createBarrierOptionsOrder(orderData);

    const orderInfo = {
      strategyId: result.orders[0].orderHash,
      type: 'barrier_options',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      maker: orderData.maker,
      underlying: orderData.underlying,
      amount: orderData.amount,
      barrierType: result.barrierType,
      barrierLevel: result.barrierLevel,
      strikePrice: orderData.strikePrice,
      optionType: orderData.optionType,
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
    req.logger.error('Barrier options order creation error:', error);
    res.status(500).json({
      error: 'Failed to create barrier options order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Create dynamic delta hedging order
router.post('/delta-hedging', swapRateLimiter, validateRequest(dynamicDeltaHedgingSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating dynamic delta hedging order', orderData);

    const result = await services.limitOrder.createDynamicDeltaHedgingOrder(orderData);

    const orderInfo = {
      strategyId: result.orders[0].orderHash,
      type: 'dynamic_delta_hedging',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      maker: orderData.maker,
      underlying: orderData.underlying,
      strikePrice: orderData.strikePrice,
      optionType: orderData.optionType,
      initialDelta: result.initialDelta,
      targetDelta: result.targetDelta,
      rebalanceThreshold: result.rebalanceThreshold,
      status: 'created',
      createdAt: new Date().toISOString(),
      orders: result.orders.map(order => ({
        orderHash: order.orderHash || order.id,
        type: order.type,
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
    req.logger.error('Dynamic delta hedging order creation error:', error);
    res.status(500).json({
      error: 'Failed to create dynamic delta hedging order',
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

    const result = await services.limitOrder.createCustomStrategyOrder(orderData);

    const orderInfo = {
      strategyId: result.orderHash,
      type: 'custom_strategy',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      maker: orderData.maker,
      amount: orderData.amount,
      strategyType: orderData.type,
      status: 'created',
      createdAt: new Date().toISOString(),
      config: result.config,
      metadata: result.metadata
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

// Get strategy templates
router.get('/templates', async (req, res) => {
  try {
    const { logger } = req;

    logger.info('Fetching strategy templates');

    const templates = [
      {
        id: 'enhanced_twap',
        name: 'Enhanced TWAP',
        description: 'Time-weighted average price with slippage protection and partial fills',
        category: 'execution',
        parameters: [
          { name: 'totalAmount', type: 'string', required: true, description: 'Total amount to trade' },
          { name: 'intervals', type: 'number', required: true, description: 'Number of intervals' },
          { name: 'duration', type: 'number', required: true, description: 'Total duration in seconds' },
          { name: 'maxSlippage', type: 'number', required: false, description: 'Maximum slippage tolerance' }
        ]
      },
      {
        id: 'barrier_options',
        name: 'Barrier Options',
        description: 'Knock-in/knock-out options with barrier monitoring',
        category: 'options',
        parameters: [
          { name: 'barrierType', type: 'string', required: true, description: 'knock-in or knock-out' },
          { name: 'barrierLevel', type: 'string', required: true, description: 'Barrier price level' },
          { name: 'strikePrice', type: 'string', required: true, description: 'Option strike price' },
          { name: 'optionType', type: 'string', required: true, description: 'call or put' }
        ]
      },
      {
        id: 'delta_hedging',
        name: 'Dynamic Delta Hedging',
        description: 'Automatic delta-neutral positioning with rebalancing',
        category: 'risk_management',
        parameters: [
          { name: 'deltaTarget', type: 'number', required: false, description: 'Target delta (0 = neutral)' },
          { name: 'rebalanceThreshold', type: 'number', required: false, description: 'Delta change threshold' },
          { name: 'hedgingAsset', type: 'string', required: true, description: 'Asset to hedge with' }
        ]
      }
    ];

    res.json({
      success: true,
      templates,
      count: templates.length,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error fetching strategy templates:', error);
    res.status(500).json({
      error: 'Failed to fetch strategy templates',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get strategy analytics
router.get('/analytics/:strategyId', async (req, res) => {
  try {
    const { services, logger } = req;
    const { strategyId } = req.params;

    logger.info('Fetching strategy analytics', { strategyId });

    // This would typically query analytics data
    // For now, return mock analytics
    const analytics = {
      strategyId,
      performance: {
        totalPnl: '1250.50',
        totalVolume: '50000.00',
        successRate: 0.85,
        averageExecutionTime: 1800, // 30 minutes
        slippage: 0.002 // 0.2%
      },
      risk: {
        maxDrawdown: '250.00',
        sharpeRatio: 1.2,
        volatility: 0.15,
        var95: '500.00' // Value at Risk 95%
      },
      execution: {
        totalOrders: 45,
        filledOrders: 38,
        cancelledOrders: 7,
        partialFills: 12
      },
      timestamps: {
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastExecution: new Date().toISOString(),
        nextRebalance: new Date(Date.now() + 3600000).toISOString()
      }
    };

    res.json({
      success: true,
      analytics,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error fetching strategy analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch strategy analytics',
      message: error.message,
      requestId: req.id
    });
  }
});

export default router;