require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import services
const logger = require('./utils/logger');
const databaseService = require('./config/database');
const transactionMonitorService = require('./services/transactionMonitorService');
const receiptService = require('./services/receiptService');
const bridgeManagerService = require('./services/bridgeManagerService');

// Import routes
const transactionRoutes = require('./routes/transactions');
const receiptRoutes = require('./routes/receipts');
const healthRoutes = require('./routes/health');
const userRoutes = require('./routes/users');
const bridgeRoutes = require('./routes/bridge');

class ManteiaBackend {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;
    this.port = process.env.PORT || 3001;
  }

  async initialize() {
    try {
      // Set up middleware
      this.setupMiddleware();

      // Set up routes
      this.setupRoutes();

      // Set up error handling
      this.setupErrorHandling();

      // Initialize services
      await this.initializeServices();

      // Set up Socket.IO for real-time updates
      this.setupSocketIO();

      logger.info('Manteia backend initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize backend:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }));

    // CORS middleware
    this.app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    }));
  }

  setupRoutes() {
    // Health check routes
    this.app.use('/health', healthRoutes);

    // API routes
    this.app.use('/api/transactions', transactionRoutes);
    this.app.use('/api/receipts', receiptRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/bridge', bridgeRoutes);

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Manteia Backend API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        },
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV !== 'production';

      res.status(err.status || 500).json({
        success: false,
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Internal server error',
          details: isDevelopment ? err.stack : undefined
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  async initializeServices() {
    try {
      // Initialize database
      logger.info('Initializing database connection...');
      await databaseService.initialize();

      // Initialize receipt service
      logger.info('Initializing receipt service...');
      await receiptService.initialize();

      // Initialize transaction monitor
      logger.info('Initializing transaction monitor...');
      await transactionMonitorService.initialize();

      // Initialize bridge manager
      logger.info('Initializing bridge manager...');
      await bridgeManagerService.initialize();

      // Start transaction monitoring if enabled
      if (process.env.TRANSACTION_MONITOR_ENABLED === 'true') {
        logger.info('Starting transaction monitoring...');
        await transactionMonitorService.start();
      }

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  setupSocketIO() {
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });

      // Handle user room joining for personalized updates
      socket.on('join_user_room', (userId) => {
        socket.join(`user_${userId}`);
        logger.info(`User ${userId} joined room via socket ${socket.id}`);
      });

      // Handle bridge updates subscription
      socket.on('subscribe_bridge_updates', (bridgeId) => {
        socket.join(`bridge_${bridgeId}`);
        logger.info(`Socket ${socket.id} subscribed to bridge ${bridgeId} updates`);
      });
    });

    // Set up real-time event handlers
    this.setupRealtimeEvents();
  }

  setupRealtimeEvents() {
    // Transaction status updates
    transactionMonitorService.on('transactionUpdate', (data) => {
      this.io.to(`user_${data.userId}`).emit('transaction_update', data);
    });

    // Receipt generation events
    receiptService.on('receiptGenerated', (data) => {
      this.io.to(`user_${data.userId}`).emit('receipt_generated', data);
    });

    // Bridge status updates
    bridgeManagerService.on('bridgeUpdate', (data) => {
      this.io.to(`bridge_${data.bridgeId}`).emit('bridge_update', data);
      if (data.userId) {
        this.io.to(`user_${data.userId}`).emit('bridge_update', data);
      }
    });

    // System status updates
    this.io.on('connection', (socket) => {
      socket.on('request_system_status', async () => {
        try {
          const status = await this.getSystemStatus();
          socket.emit('system_status', status);
        } catch (error) {
          logger.error('Failed to get system status:', error);
          socket.emit('system_error', { message: 'Failed to get system status' });
        }
      });
    });
  }

  async start() {
    try {
      await this.initialize();

      this.server.listen(this.port, () => {
        logger.info(`Manteia backend server running on port ${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Health check: http://localhost:${this.port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('Shutting down server...');

    try {
      // Stop services
      await transactionMonitorService.stop();
      await bridgeManagerService.stop();

      // Close database connections
      await databaseService.close();

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      }
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  async getSystemStatus() {
    try {
      const dbStatus = await databaseService.testConnection();
      const transactionMonitorStatus = transactionMonitorService.getStatus();
      const bridgeStatus = await bridgeManagerService.getHealthStatus();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          database: {
            status: dbStatus ? 'connected' : 'disconnected',
            responseTime: Date.now() // This would be calculated properly
          },
          transactionMonitor: {
            status: transactionMonitorStatus.isRunning ? 'running' : 'stopped',
            lastProcessedBlock: transactionMonitorStatus.lastProcessedBlock,
            pendingTransactions: transactionMonitorStatus.pendingTransactions || 0
          },
          bridgeManager: {
            status: bridgeStatus.bridgeManager.initialized ? 'initialized' : 'not_initialized',
            providersCount: bridgeStatus.bridgeManager.providersCount,
            providers: bridgeStatus.providers
          }
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          pid: process.pid
        }
      };
    } catch (error) {
      logger.error('Failed to get system status:', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          pid: process.pid
        }
      };
    }
  }
}

// Create and export the backend instance
const backend = new ManteiaBackend();

// Start the server if this file is run directly
if (require.main === module) {
  backend.start().catch((error) => {
    logger.error('Failed to start backend:', error);
    process.exit(1);
  });
}

module.exports = backend;