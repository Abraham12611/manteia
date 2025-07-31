import { Router } from 'express';
import Joi from 'joi';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Custom rate limiter for resolver operations
const resolverRateLimiter = createRateLimiter({
  keyspace: 'resolver',
  points: 20,
  duration: 60,
  blockDuration: 300,
  message: 'Too many resolver requests. Please try again later.'
});

// Validation schemas
const resolverRegistrationSchema = Joi.object({
  resolverAddress: Joi.string().required(),
  name: Joi.string().min(3).max(50).required(),
  feeBps: Joi.number().min(0).max(10000).required(), // 0-100% in basis points
  description: Joi.string().max(500).optional(),
  website: Joi.string().uri().optional(),
  email: Joi.string().email().optional()
});

const resolverUpdateSchema = Joi.object({
  name: Joi.string().min(3).max(50).optional(),
  feeBps: Joi.number().min(0).max(10000).optional(),
  isActive: Joi.boolean().optional(),
  description: Joi.string().max(500).optional(),
  website: Joi.string().uri().optional(),
  email: Joi.string().email().optional()
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

// Get resolver status and information
router.get('/status', async (req, res) => {
  try {
    const { services, logger } = req;

    logger.info('Resolver status request');

    // Get resolver bot status
    let resolverStatus = {
      isRunning: false,
      enabled: false,
      error: 'Resolver bot not available'
    };

    if (services.resolverBot) {
      resolverStatus = services.resolverBot.getStatus();
    }

    // Get Sui resolver registry information
    let suiResolverInfo = null;
    if (services.sui && services.sui.address) {
      try {
        // This would query the Sui resolver registry
        // const registryId = process.env.SUI_RESOLVER_REGISTRY_ID;
        // if (registryId) {
        //   suiResolverInfo = await services.sui.getResolverInfo(registryId, services.sui.address);
        // }
        suiResolverInfo = {
          address: services.sui.address,
          isRegistered: false,
          message: 'Registry integration pending deployment'
        };
      } catch (error) {
        logger.warn('Error getting Sui resolver info:', error);
      }
    }

    // Combine all resolver information
    const status = {
      resolver: {
        address: services.sui?.address || 'Not configured',
        ...resolverStatus
      },
      sui: suiResolverInfo,
      performance: resolverStatus.metrics || {},
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      status,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Resolver status error:', error);
    res.status(500).json({
      error: 'Failed to get resolver status',
      message: error.message,
      requestId: req.id
    });
  }
});

// Register as resolver on Sui
router.post('/register', resolverRateLimiter, validateRequest(resolverRegistrationSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const { resolverAddress, name, feeBps, description, website, email } = req.validatedData;

    logger.info('Resolver registration request', { resolverAddress, name, feeBps });

    // Check if Sui service is available
    if (!services.sui) {
      return res.status(503).json({
        error: 'Sui service not available',
        requestId: req.id
      });
    }

    // Validate that the resolver address matches the configured address
    if (resolverAddress !== services.sui.address) {
      return res.status(400).json({
        error: 'Resolver address mismatch',
        message: 'Address must match configured Sui address',
        requestId: req.id
      });
    }

    // Register resolver on Sui
    const registryId = process.env.SUI_RESOLVER_REGISTRY_ID;
    if (!registryId) {
      return res.status(500).json({
        error: 'Resolver registry not configured',
        message: 'SUI_RESOLVER_REGISTRY_ID environment variable not set',
        requestId: req.id
      });
    }

    const registrationResult = await services.sui.registerResolver({
      registryId,
      resolverAddress,
      name,
      feeBps
    });

    // Store additional metadata (description, website, email) in local database
    // This would typically be stored in a database for later retrieval
    const resolverInfo = {
      address: resolverAddress,
      name,
      feeBps,
      description,
      website,
      email,
      registeredAt: new Date().toISOString(),
      suiTransactionDigest: registrationResult.digest,
      status: 'registered'
    };

    res.json({
      success: true,
      resolver: resolverInfo,
      transaction: {
        digest: registrationResult.digest,
        status: 'success'
      },
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Resolver registration error:', error);
    res.status(500).json({
      error: 'Failed to register resolver',
      message: error.message,
      requestId: req.id
    });
  }
});

// Update resolver information
router.put('/update', resolverRateLimiter, validateRequest(resolverUpdateSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const updateData = req.validatedData;

    logger.info('Resolver update request', updateData);

    if (!services.sui) {
      return res.status(503).json({
        error: 'Sui service not available',
        requestId: req.id
      });
    }

    const registryId = process.env.SUI_RESOLVER_REGISTRY_ID;
    if (!registryId) {
      return res.status(500).json({
        error: 'Resolver registry not configured',
        requestId: req.id
      });
    }

    // Update resolver on Sui if feeBps or isActive changed
    let suiUpdateResult = null;
    if (updateData.feeBps !== undefined || updateData.isActive !== undefined) {
      // This would call a Sui contract method to update resolver info
      // For now, we'll simulate the update
      suiUpdateResult = {
        digest: 'simulated_update_digest',
        success: true
      };
    }

    // Update local metadata
    const updatedInfo = {
      address: services.sui.address,
      ...updateData,
      updatedAt: new Date().toISOString(),
      suiUpdateDigest: suiUpdateResult?.digest
    };

    res.json({
      success: true,
      resolver: updatedInfo,
      transaction: suiUpdateResult,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Resolver update error:', error);
    res.status(500).json({
      error: 'Failed to update resolver',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get resolver performance metrics
router.get('/metrics', async (req, res) => {
  try {
    const { services, logger } = req;
    const { period = '24h' } = req.query;

    logger.info('Resolver metrics request', { period });

    let metrics = {
      period,
      totalSwaps: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      totalVolume: '0',
      avgExecutionTime: 0,
      successRate: 0,
      profitability: {
        totalFees: '0',
        totalGasCosts: '0',
        netProfit: '0'
      },
      performance: {
        uptimePercentage: 0,
        avgResponseTime: 0,
        errorRate: 0
      },
      timestamp: new Date().toISOString()
    };

    // Get metrics from resolver bot if available
    if (services.resolverBot) {
      const botStatus = services.resolverBot.getStatus();
      if (botStatus.metrics) {
        metrics = {
          ...metrics,
          totalSwaps: botStatus.metrics.totalSwapsProcessed || 0,
          successfulSwaps: botStatus.metrics.successfulSwaps || 0,
          failedSwaps: botStatus.metrics.failedSwaps || 0,
          totalVolume: botStatus.metrics.totalVolume?.toString() || '0',
          avgExecutionTime: botStatus.metrics.averageExecutionTime || 0,
          successRate: botStatus.metrics.totalSwapsProcessed > 0
            ? (botStatus.metrics.successfulSwaps / botStatus.metrics.totalSwapsProcessed) * 100
            : 0
        };
      }
    }

    // Get Sui-specific metrics
    if (services.sui) {
      try {
        const suiHealth = await services.sui.healthCheck();
        metrics.suiNetwork = {
          status: suiHealth.status,
          latestCheckpoint: suiHealth.latestCheckpoint,
          address: suiHealth.address
        };
      } catch (error) {
        logger.warn('Error getting Sui metrics:', error);
      }
    }

    res.json({
      success: true,
      metrics,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Resolver metrics error:', error);
    res.status(500).json({
      error: 'Failed to get resolver metrics',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get resolver swaps history
router.get('/swaps', async (req, res) => {
  try {
    const { services, logger } = req;
    const {
      page = 1,
      limit = 20,
      status,
      fromChain,
      toChain,
      startDate,
      endDate
    } = req.query;

    logger.info('Resolver swaps history request', {
      page,
      limit,
      status,
      fromChain,
      toChain
    });

    let swaps = [];

    // Get swaps from resolver bot
    if (services.resolverBot) {
      const activeSwaps = services.resolverBot.getActiveSwaps();
      const completedSwaps = services.resolverBot.getCompletedSwaps(100);
      const failedSwaps = services.resolverBot.getFailedSwaps(100);

      swaps = [
        ...activeSwaps.map(swap => ({ ...swap, status: 'active' })),
        ...completedSwaps,
        ...failedSwaps
      ];

      // Apply filters
      if (status) {
        swaps = swaps.filter(swap => swap.status === status);
      }
      if (fromChain) {
        swaps = swaps.filter(swap =>
          swap.type?.includes(fromChain.toUpperCase()) ||
          swap.srcChainId?.toString() === fromChain
        );
      }
      if (toChain) {
        swaps = swaps.filter(swap =>
          swap.type?.includes(toChain.toUpperCase()) ||
          swap.dstChainId?.toString() === toChain
        );
      }
      if (startDate) {
        const start = new Date(startDate).getTime();
        swaps = swaps.filter(swap =>
          new Date(swap.createdAt || swap.timestamp || 0).getTime() >= start
        );
      }
      if (endDate) {
        const end = new Date(endDate).getTime();
        swaps = swaps.filter(swap =>
          new Date(swap.createdAt || swap.timestamp || 0).getTime() <= end
        );
      }

      // Sort by creation date (newest first)
      swaps.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const dateB = new Date(b.createdAt || b.timestamp || 0).getTime();
        return dateB - dateA;
      });
    }

    // Paginate results
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedSwaps = swaps.slice(startIndex, endIndex);

    res.json({
      success: true,
      swaps: paginatedSwaps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: swaps.length,
        totalPages: Math.ceil(swaps.length / parseInt(limit))
      },
      filters: { status, fromChain, toChain, startDate, endDate },
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Resolver swaps history error:', error);
    res.status(500).json({
      error: 'Failed to get resolver swaps',
      message: error.message,
      requestId: req.id
    });
  }
});

// Start/stop resolver bot
router.post('/control/:action', resolverRateLimiter, async (req, res) => {
  try {
    const { services, logger } = req;
    const { action } = req.params; // 'start' or 'stop'

    if (!['start', 'stop'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        validActions: ['start', 'stop'],
        requestId: req.id
      });
    }

    logger.info(`Resolver bot ${action} request`);

    if (!services.resolverBot) {
      return res.status(503).json({
        error: 'Resolver bot not available',
        requestId: req.id
      });
    }

    let result;
    if (action === 'start') {
      await services.resolverBot.start();
      result = { action: 'start', status: 'started' };
    } else {
      await services.resolverBot.stop();
      result = { action: 'stop', status: 'stopped' };
    }

    // Get updated status
    const currentStatus = services.resolverBot.getStatus();

    res.json({
      success: true,
      result,
      status: currentStatus,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

  } catch (error) {
    req.logger.error(`Resolver bot ${req.params.action} error:`, error);
    res.status(500).json({
      error: `Failed to ${req.params.action} resolver bot`,
      message: error.message,
      requestId: req.id
    });
  }
});

// Update resolver configuration
router.post('/config', resolverRateLimiter, async (req, res) => {
  try {
    const { services, logger } = req;
    const { config } = req.body;

    logger.info('Resolver config update request', config);

    if (!services.resolverBot) {
      return res.status(503).json({
        error: 'Resolver bot not available',
        requestId: req.id
      });
    }

    // Validate config
    const validConfigKeys = [
      'minProfitMargin',
      'maxSlippage',
      'timeoutMinutes',
      'maxConcurrentSwaps',
      'retryAttempts',
      'retryDelayMs'
    ];

    const invalidKeys = Object.keys(config).filter(key => !validConfigKeys.includes(key));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        error: 'Invalid configuration keys',
        invalidKeys,
        validKeys: validConfigKeys,
        requestId: req.id
      });
    }

    // Update configuration
    services.resolverBot.updateConfig(config);

    const updatedStatus = services.resolverBot.getStatus();

    res.json({
      success: true,
      config: updatedStatus.config,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Resolver config update error:', error);
    res.status(500).json({
      error: 'Failed to update resolver config',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get all registered resolvers
router.get('/all', async (req, res) => {
  try {
    const { services, logger } = req;
    const { page = 1, limit = 20, active = 'all' } = req.query;

    logger.info('All resolvers request', { page, limit, active });

    // This would query the Sui resolver registry
    // For now, return mock data
    const resolvers = [
      {
        address: services.sui?.address || '0x123...',
        name: 'Manteia Resolver',
        feeBps: 50, // 0.5%
        isActive: true,
        totalVolume: '1000000',
        successfulSwaps: 150,
        totalSwaps: 160,
        successRate: 93.75,
        registeredAt: new Date().toISOString()
      }
    ];

    // Filter by active status
    let filteredResolvers = resolvers;
    if (active !== 'all') {
      const isActiveFilter = active === 'true';
      filteredResolvers = resolvers.filter(resolver => resolver.isActive === isActiveFilter);
    }

    // Paginate
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedResolvers = filteredResolvers.slice(startIndex, endIndex);

    res.json({
      success: true,
      resolvers: paginatedResolvers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredResolvers.length,
        totalPages: Math.ceil(filteredResolvers.length / parseInt(limit))
      },
      filters: { active },
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('All resolvers error:', error);
    res.status(500).json({
      error: 'Failed to get resolvers',
      message: error.message,
      requestId: req.id
    });
  }
});

export default router;