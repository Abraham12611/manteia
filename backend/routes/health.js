const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Import backend for health check method
let backend = null;
try {
  backend = require('../server');
} catch (error) {
  // Backend might not be available during initialization
  logger.warn('Backend not available for health checks');
}

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    if (backend && typeof backend.getHealthStatus === 'function') {
      const healthStatus = await backend.getHealthStatus();

      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    } else {
      // Fallback health check
      res.json({
        status: 'healthy',
        message: 'Service is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      });
    }
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/database
 * Database-specific health check
 */
router.get('/database', async (req, res) => {
  try {
    const databaseService = require('../config/database');
    const dbHealth = await databaseService.healthCheck();

    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(dbHealth);
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Database health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/transaction-monitor
 * Transaction monitoring service health check
 */
router.get('/transaction-monitor', async (req, res) => {
  try {
    const transactionMonitorService = require('../services/transactionMonitorService');
    const monitorHealth = await transactionMonitorService.getHealthStatus();

    const statusCode = monitorHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(monitorHealth);
  } catch (error) {
    logger.error('Transaction monitor health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Transaction monitor health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/blockchain
 * Blockchain connectivity health check
 */
router.get('/blockchain', async (req, res) => {
  try {
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);

    const [network, blockNumber] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber()
    ]);

    res.json({
      status: 'healthy',
      message: 'Blockchain connection is active',
      network: {
        name: network.name,
        chainId: network.chainId.toString()
      },
      latestBlock: blockNumber,
      rpcUrl: process.env.MANTLE_SEPOLIA_RPC_URL,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Blockchain health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Blockchain connection failed',
      error: error.message,
      rpcUrl: process.env.MANTLE_SEPOLIA_RPC_URL,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/services
 * Comprehensive health check for all services
 */
router.get('/services', async (req, res) => {
  try {
    const results = {};
    let overallStatus = 'healthy';

    // Check database
    try {
      const databaseService = require('../config/database');
      results.database = await databaseService.healthCheck();
      if (results.database.status !== 'healthy') {
        overallStatus = 'unhealthy';
      }
    } catch (error) {
      results.database = { status: 'error', error: error.message };
      overallStatus = 'unhealthy';
    }

    // Check transaction monitor
    try {
      const transactionMonitorService = require('../services/transactionMonitorService');
      results.transactionMonitor = await transactionMonitorService.getHealthStatus();
      if (results.transactionMonitor.status !== 'healthy') {
        overallStatus = 'unhealthy';
      }
    } catch (error) {
      results.transactionMonitor = { status: 'error', error: error.message };
      overallStatus = 'unhealthy';
    }

    // Check blockchain connectivity
    try {
      const { ethers } = require('ethers');
      const provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);
      const blockNumber = await provider.getBlockNumber();

      results.blockchain = {
        status: 'healthy',
        latestBlock: blockNumber,
        chainId: process.env.MANTLE_SEPOLIA_CHAIN_ID
      };
    } catch (error) {
      results.blockchain = { status: 'error', error: error.message };
      overallStatus = 'unhealthy';
    }

    // Check receipt service
    try {
      const receiptService = require('../services/receiptService');
      results.receiptService = {
        status: 'healthy',
        pdfEnabled: receiptService.pdfGenerationEnabled
      };
    } catch (error) {
      results.receiptService = { status: 'error', error: error.message };
      overallStatus = 'unhealthy';
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: results,
      summary: {
        healthy: Object.values(results).filter(r => r.status === 'healthy').length,
        unhealthy: Object.values(results).filter(r => r.status !== 'healthy').length,
        total: Object.keys(results).length
      }
    });
  } catch (error) {
    logger.error('Services health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Services health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/metrics
 * System metrics endpoint
 */
router.get('/metrics', (req, res) => {
  try {
    const memUsage = process.memoryUsage();

    res.json({
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      },
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        chainId: process.env.MANTLE_SEPOLIA_CHAIN_ID
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics endpoint failed:', error);
    res.status(500).json({
      error: 'Failed to get system metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;