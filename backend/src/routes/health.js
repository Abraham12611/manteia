import { Router } from 'express';

const router = Router();

// Basic health check
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100,
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100
      },
      pid: process.pid
    };

    res.json(health);
  } catch (error) {
    req.logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed health check with service status
router.get('/detailed', async (req, res) => {
  try {
    const { services } = req;
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {}
    };

    // Check 1inch service
    if (services.oneInch) {
      try {
        // Test a simple API call
        await services.oneInch.getTokens(1); // Ethereum mainnet
        health.services.oneInch = { status: 'healthy', message: 'API accessible' };
      } catch (error) {
        health.services.oneInch = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    // Check Sui service
    if (services.sui) {
      try {
        const suiHealth = await services.sui.healthCheck();
        health.services.sui = suiHealth;
        if (suiHealth.status !== 'healthy') {
          health.status = 'degraded';
        }
      } catch (error) {
        health.services.sui = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    // Check WebSocket service
    if (services.websocket) {
      try {
        const wsStatus = {
          status: 'healthy',
          connectedClients: services.websocket.getClientCount(),
          clients: services.websocket.getConnectedClients()
        };
        health.services.websocket = wsStatus;
      } catch (error) {
        health.services.websocket = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    // Check Resolver Bot
    if (services.resolverBot) {
      try {
        const botStatus = services.resolverBot.getStatus();
        health.services.resolverBot = {
          status: botStatus.isRunning ? 'healthy' : 'stopped',
          ...botStatus
        };
        if (!botStatus.isRunning && botStatus.enabled) {
          health.status = 'degraded';
        }
      } catch (error) {
        health.services.resolverBot = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    res.json(health);
  } catch (error) {
    req.logger.error('Detailed health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    const { services } = req;

    // Check if critical services are ready
    const checks = [];

    if (services.sui) {
      checks.push(services.sui.healthCheck());
    }

    // Wait for all checks
    const results = await Promise.allSettled(checks);

    // Check if any critical service failed
    const hasFailures = results.some(result =>
      result.status === 'rejected' ||
      (result.value && result.value.status !== 'healthy')
    );

    if (hasFailures) {
      return res.status(503).json({
        status: 'not ready',
        checks: results.map(r => r.value || { error: r.reason?.message })
      });
    }

    res.json({ status: 'ready' });
  } catch (error) {
    req.logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const { services } = req;

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      services: {}
    };

    // Add service-specific metrics
    if (services.resolverBot) {
      try {
        const botStatus = services.resolverBot.getStatus();
        metrics.services.resolverBot = {
          isRunning: botStatus.isRunning,
          activeSwaps: botStatus.activeSwaps,
          completedSwaps: botStatus.completedSwaps,
          failedSwaps: botStatus.failedSwaps,
          metrics: botStatus.metrics
        };
      } catch (error) {
        metrics.services.resolverBot = { error: error.message };
      }
    }

    if (services.websocket) {
      try {
        metrics.services.websocket = {
          connectedClients: services.websocket.getClientCount()
        };
      } catch (error) {
        metrics.services.websocket = { error: error.message };
      }
    }

    res.json(metrics);
  } catch (error) {
    req.logger.error('Metrics collection failed:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;