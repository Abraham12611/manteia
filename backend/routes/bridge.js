const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const nativeBridgeService = require('../services/nativeBridgeService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array()
      }
    });
  }
  next();
};

// Get bridge quote
router.post('/quote',
  [
    body('sourceChain').isIn(['ethereum-sepolia', 'mantle-sepolia']).withMessage('Invalid source chain'),
    body('destinationChain').isIn(['ethereum-sepolia', 'mantle-sepolia']).withMessage('Invalid destination chain'),
    body('amount').isDecimal().withMessage('Invalid amount format'),
    body('token').isString().withMessage('Token must be a string'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { sourceChain, destinationChain, amount, token } = req.body;

      // Validate chains are different
      if (sourceChain === destinationChain) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BRIDGE_PARAMS',
            message: 'Source and destination chains must be different'
          }
        });
      }

      const quote = await nativeBridgeService.getBridgeQuote({
        sourceChain,
        destinationChain,
        amount,
        token
      });

      res.json({
        success: true,
        data: quote,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get bridge quote:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BRIDGE_QUOTE_ERROR',
          message: 'Failed to get bridge quote',
          details: error.message
        }
      });
    }
  }
);

// Initiate bridge to Mantle
router.post('/to-mantle',
  [
    body('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
    body('amount').isDecimal().withMessage('Invalid amount format'),
    body('token').optional().isString().withMessage('Token must be a string'),
    body('minGasLimit').optional().isInt({ min: 100000 }).withMessage('Invalid gas limit'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { userAddress, amount, token = 'ETH', minGasLimit = 200000 } = req.body;

      const bridgeResult = await nativeBridgeService.bridgeToMantle({
        userAddress,
        amount,
        token,
        minGasLimit
      });

      res.status(201).json({
        success: true,
        data: bridgeResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to initiate bridge to Mantle:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BRIDGE_TO_MANTLE_ERROR',
          message: 'Failed to initiate bridge to Mantle',
          details: error.message
        }
      });
    }
  }
);

// Initiate bridge from Mantle
router.post('/from-mantle',
  [
    body('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
    body('amount').isDecimal().withMessage('Invalid amount format'),
    body('token').optional().isString().withMessage('Token must be a string'),
    body('minGasLimit').optional().isInt({ min: 100000 }).withMessage('Invalid gas limit'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { userAddress, amount, token = 'ETH', minGasLimit = 200000 } = req.body;

      const bridgeResult = await nativeBridgeService.bridgeFromMantle({
        userAddress,
        amount,
        token,
        minGasLimit
      });

      res.status(201).json({
        success: true,
        data: bridgeResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to initiate bridge from Mantle:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BRIDGE_FROM_MANTLE_ERROR',
          message: 'Failed to initiate bridge from Mantle',
          details: error.message
        }
      });
    }
  }
);

// Get bridge status
router.get('/status/:bridgeId',
  [
    param('bridgeId').isUUID().withMessage('Invalid bridge ID format'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { bridgeId } = req.params;

      const bridgeStatus = await nativeBridgeService.getBridgeStatus(bridgeId);

      res.json({
        success: true,
        data: bridgeStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get bridge status:', error);

      if (error.message === 'Bridge transaction not found') {
        res.status(404).json({
          success: false,
          error: {
            code: 'BRIDGE_NOT_FOUND',
            message: 'Bridge transaction not found'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'BRIDGE_STATUS_ERROR',
            message: 'Failed to get bridge status',
            details: error.message
          }
        });
      }
    }
  }
);

// Get user bridge history
router.get('/history/:userAddress',
  [
    param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { userAddress } = req.params;
      const { limit = 50 } = req.query;

      const bridgeHistory = await nativeBridgeService.getUserBridgeHistory(
        userAddress,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: {
          bridges: bridgeHistory,
          count: bridgeHistory.length,
          userAddress
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get user bridge history:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BRIDGE_HISTORY_ERROR',
          message: 'Failed to get user bridge history',
          details: error.message
        }
      });
    }
  }
);

// Get supported chains
router.get('/chains', async (req, res) => {
  try {
    const supportedChains = [
      {
        id: 'ethereum-sepolia',
        chainId: 11155111,
        name: 'Ethereum Sepolia',
        symbol: 'ETH',
        rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL,
        blockExplorer: 'https://sepolia.etherscan.io',
        bridgeDirection: 'to-mantle'
      },
      {
        id: 'mantle-sepolia',
        chainId: 5003,
        name: 'Mantle Sepolia',
        symbol: 'MNT',
        rpcUrl: process.env.MANTLE_SEPOLIA_RPC_URL,
        blockExplorer: 'https://sepolia.mantlescan.xyz',
        bridgeDirection: 'from-mantle'
      }
    ];

    res.json({
      success: true,
      data: {
        chains: supportedChains,
        count: supportedChains.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get supported chains:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAINS_ERROR',
        message: 'Failed to get supported chains',
        details: error.message
      }
    });
  }
});

// Get bridge statistics
router.get('/stats', async (req, res) => {
  try {
    const pool = require('../config/database').getPool();

    const statsQuery = `
      SELECT
        COUNT(*) as total_bridges,
        COUNT(CASE WHEN bridge_status = 'completed' THEN 1 END) as completed_bridges,
        COUNT(CASE WHEN bridge_status = 'pending' THEN 1 END) as pending_bridges,
        COUNT(CASE WHEN bridge_status = 'failed' THEN 1 END) as failed_bridges,
        SUM(CASE WHEN bridge_status = 'completed' THEN source_amount::numeric ELSE 0 END) as total_volume,
        AVG(CASE WHEN bridge_status = 'completed' AND completed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 60 ELSE NULL END) as avg_completion_time_minutes
      FROM cross_chain_bridges
      WHERE bridge_provider = 'native-mantle'
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        totalBridges: parseInt(stats.total_bridges),
        completedBridges: parseInt(stats.completed_bridges),
        pendingBridges: parseInt(stats.pending_bridges),
        failedBridges: parseInt(stats.failed_bridges),
        totalVolume: stats.total_volume || '0',
        avgCompletionTimeMinutes: stats.avg_completion_time_minutes || 0,
        successRate: stats.total_bridges > 0 ?
          (stats.completed_bridges / stats.total_bridges * 100).toFixed(2) : 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get bridge statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BRIDGE_STATS_ERROR',
        message: 'Failed to get bridge statistics',
        details: error.message
      }
    });
  }
});

// Bridge service health check
router.get('/health', async (req, res) => {
  try {
    const status = await nativeBridgeService.getStatus();

    res.json({
      success: true,
      data: {
        service: 'native-bridge',
        status: status.initialized ? 'healthy' : 'unhealthy',
        details: status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get bridge health status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BRIDGE_HEALTH_ERROR',
        message: 'Failed to get bridge health status',
        details: error.message
      }
    });
  }
});

module.exports = router;