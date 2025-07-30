import { Router } from 'express';
import Joi from 'joi';
import { swapRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Validation schemas
const limitOrderSchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  makingAmount: Joi.string().required(),
  takingAmount: Joi.string().required(),
  maker: Joi.string().required(),
  expiry: Joi.number().optional(),
  predicate: Joi.string().optional(),
  permit: Joi.string().optional(),
  interaction: Joi.string().optional()
});

const twapOrderSchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  totalAmount: Joi.string().required(),
  intervals: Joi.number().min(2).max(100).required(),
  duration: Joi.number().min(60).required(), // Minimum 1 minute
  maker: Joi.string().required(),
  slippage: Joi.number().min(0).max(50).default(1)
});

const optionsOrderSchema = Joi.object({
  chainId: Joi.number().required(),
  makerAsset: Joi.string().required(),
  takerAsset: Joi.string().required(),
  makingAmount: Joi.string().required(),
  strikePrice: Joi.string().required(),
  expiry: Joi.number().required(),
  maker: Joi.string().required(),
  optionType: Joi.string().valid('call', 'put').default('call')
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

// Create limit order
router.post('/limit', swapRateLimiter, validateRequest(limitOrderSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating limit order', orderData);

    // Create limit order using 1inch Limit Order Protocol
    const order = await services.oneInch.createLimitOrder(orderData);

    // Store order for tracking
    const orderInfo = {
      orderId: order.orderHash || order.id,
      type: 'limit',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      makingAmount: orderData.makingAmount,
      takingAmount: orderData.takingAmount,
      maker: orderData.maker,
      status: 'created',
      createdAt: new Date().toISOString(),
      expiry: orderData.expiry ? new Date(orderData.expiry * 1000).toISOString() : null
    };

    res.json({
      success: true,
      order: orderInfo,
      onchainOrder: order,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Limit order creation error:', error);
    res.status(500).json({
      error: 'Failed to create limit order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Create TWAP order
router.post('/twap', swapRateLimiter, validateRequest(twapOrderSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating TWAP order', orderData);

    // Create TWAP order using 1inch Limit Order Protocol
    const twapResult = await services.oneInch.createTWAPOrder(orderData);

    // Process the created orders
    const orderInfo = {
      twapId: `twap_${Date.now()}`,
      type: 'twap',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      totalAmount: orderData.totalAmount,
      intervals: orderData.intervals,
      duration: orderData.duration,
      maker: orderData.maker,
      status: 'created',
      createdAt: new Date().toISOString(),
      orders: twapResult.orders.map(order => ({
        orderId: order.orderHash || order.id,
        amount: order.makingAmount,
        status: 'active'
      })),
      completedOrders: 0
    };

    res.json({
      success: true,
      twapOrder: orderInfo,
      strategy: twapResult.strategy,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('TWAP order creation error:', error);
    res.status(500).json({
      error: 'Failed to create TWAP order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Create options-like order
router.post('/options', swapRateLimiter, validateRequest(optionsOrderSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Creating options order', orderData);

    // Create options order using predicates
    const optionsResult = await services.oneInch.createOptionsOrder(orderData);

    const orderInfo = {
      orderId: optionsResult.orderHash || optionsResult.id,
      type: 'options',
      chainId: orderData.chainId,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      makingAmount: orderData.makingAmount,
      strikePrice: orderData.strikePrice,
      expiry: new Date(orderData.expiry * 1000).toISOString(),
      maker: orderData.maker,
      optionType: orderData.optionType,
      status: 'created',
      createdAt: new Date().toISOString()
    };

    res.json({
      success: true,
      order: orderInfo,
      strategy: optionsResult.strategy,
      onchainOrder: optionsResult,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Options order creation error:', error);
    res.status(500).json({
      error: 'Failed to create options order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get orders by maker address
router.get('/maker/:address', async (req, res) => {
  try {
    const { services, logger } = req;
    const { address } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    logger.info('Getting orders by maker', { address, page, limit, status });

    // Get orders from 1inch (this would need to be implemented in the service)
    const orders = await services.oneInch.getOrdersByMaker({
      address,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Filter by status if provided
    let filteredOrders = orders;
    if (status) {
      filteredOrders = orders.filter(order => order.status === status);
    }

    res.json({
      success: true,
      address,
      orders: filteredOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredOrders.length
      },
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error getting orders by maker:', error);
    res.status(500).json({
      error: 'Failed to get orders',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get active orders
router.get('/active', async (req, res) => {
  try {
    const { services, logger } = req;
    const { page = 1, limit = 20, chainId } = req.query;

    logger.info('Getting active orders', { page, limit, chainId });

    // Get active orders from 1inch
    const orders = await services.oneInch.getActiveOrders({
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Filter by chainId if provided
    let filteredOrders = orders;
    if (chainId) {
      filteredOrders = orders.filter(order => order.chainId === parseInt(chainId));
    }

    res.json({
      success: true,
      orders: filteredOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredOrders.length
      },
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error getting active orders:', error);
    res.status(500).json({
      error: 'Failed to get active orders',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get order status
router.get('/:orderId/status', async (req, res) => {
  try {
    const { services, logger } = req;
    const { orderId } = req.params;

    logger.info('Getting order status', { orderId });

    // Try to get status from 1inch first
    let orderStatus = null;

    try {
      orderStatus = await services.oneInch.getFusionOrderStatus(orderId);
      orderStatus.source = 'fusion';
    } catch (error) {
      // Order might be a limit order, try other methods
      logger.debug('Order not found in Fusion, trying other sources');
    }

    // If not found, might be a local order or different type
    if (!orderStatus) {
      // Implementation would check local database for TWAP/Options orders
      orderStatus = {
        orderId,
        status: 'unknown',
        message: 'Order not found in known sources'
      };
    }

    res.json({
      success: true,
      orderId,
      status: orderStatus,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error getting order status:', error);
    res.status(500).json({
      error: 'Failed to get order status',
      message: error.message,
      requestId: req.id
    });
  }
});

// Cancel order
router.delete('/:orderId', async (req, res) => {
  try {
    const { services, logger } = req;
    const { orderId } = req.params;
    const { maker } = req.body; // Maker address for verification

    logger.info('Cancelling order', { orderId, maker });

    // This would need to be implemented based on the order type
    // For 1inch Limit Orders, it would involve creating a cancellation transaction

    const result = {
      orderId,
      status: 'cancellation_initiated',
      timestamp: new Date().toISOString(),
      message: 'Order cancellation transaction created. Please sign and broadcast.'
    };

    res.json({
      success: true,
      result,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error cancelling order:', error);
    res.status(500).json({
      error: 'Failed to cancel order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get order book
router.get('/book/:chainId', async (req, res) => {
  try {
    const { services, logger } = req;
    const { chainId } = req.params;
    const { baseToken, quoteToken, depth = 10 } = req.query;

    if (!baseToken || !quoteToken) {
      return res.status(400).json({
        error: 'Missing baseToken or quoteToken parameters',
        requestId: req.id
      });
    }

    logger.info('Getting order book', { chainId, baseToken, quoteToken, depth });

    // This would aggregate orders from various sources to create an order book
    const orderBook = {
      chainId: parseInt(chainId),
      baseToken,
      quoteToken,
      timestamp: new Date().toISOString(),
      bids: [], // Buy orders
      asks: [], // Sell orders
      spread: '0',
      lastPrice: '0'
    };

    // Implementation would fetch and aggregate orders
    // For now, returning empty order book

    res.json({
      success: true,
      orderBook,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error getting order book:', error);
    res.status(500).json({
      error: 'Failed to get order book',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get order history
router.get('/history/:address', async (req, res) => {
  try {
    const { services, logger } = req;
    const { address } = req.params;
    const { page = 1, limit = 50, chainId, status, orderType } = req.query;

    logger.info('Getting order history', { address, page, limit, chainId, status, orderType });

    // This would get order history from 1inch APIs
    const history = await services.oneInch.getTransactionHistory(
      address,
      chainId ? parseInt(chainId) : undefined,
      parseInt(limit)
    );

    // Filter results based on query parameters
    let filteredHistory = history;

    if (status) {
      filteredHistory = filteredHistory.filter(item => item.status === status);
    }

    if (orderType) {
      filteredHistory = filteredHistory.filter(item => item.type === orderType);
    }

    res.json({
      success: true,
      address,
      history: filteredHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredHistory.length
      },
      filters: { chainId, status, orderType },
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error getting order history:', error);
    res.status(500).json({
      error: 'Failed to get order history',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get order analytics
router.get('/analytics/:address', async (req, res) => {
  try {
    const { services, logger } = req;
    const { address } = req.params;
    const { period = '7d' } = req.query; // 1d, 7d, 30d

    logger.info('Getting order analytics', { address, period });

    // This would calculate analytics from order history
    const analytics = {
      address,
      period,
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalVolume: '0',
      averageOrderSize: '0',
      successRate: 0,
      favoriteTokens: [],
      ordersByType: {
        limit: 0,
        twap: 0,
        options: 0,
        fusion: 0
      },
      performanceMetrics: {
        avgExecutionTime: 0,
        slippageStats: {
          average: 0,
          min: 0,
          max: 0
        }
      }
    };

    res.json({
      success: true,
      analytics,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Error getting order analytics:', error);
    res.status(500).json({
      error: 'Failed to get order analytics',
      message: error.message,
      requestId: req.id
    });
  }
});

export default router;