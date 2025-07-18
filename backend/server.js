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

// Import routes
const transactionRoutes = require('./routes/transactions');
const receiptRoutes = require('./routes/receipts');
const healthRoutes = require('./routes/health');
const userRoutes = require('./routes/users');

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
        },
      },
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200,
    };
    this.app.use(cors(corsOptions));

    // Request logging
    this.app.use(morgan('combined', { stream: logger.stream }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Trading rate limiting (more restrictive)
    const tradingLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_TRADING_MAX) || 10,
      message: {
        error: 'Too many trading requests, please wait a moment.',
        code: 'TRADING_RATE_LIMIT_EXCEEDED'
      },
    });
    this.app.use('/api/transactions/trade', tradingLimiter);

    logger.info('Middleware configured successfully');
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/transactions', transactionRoutes);
    this.app.use('/api/receipts', receiptRoutes);
    this.app.use('/api/users', userRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Manteia Backend API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/api/health',
          transactions: '/api/transactions',
          receipts: '/api/receipts',
          users: '/api/users'
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });

    logger.info('Routes configured successfully');
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      // Log error
      logger.error('Global error handler:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';

      res.status(error.status || 500).json({
        error: isDevelopment ? error.message : 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    logger.info('Error handling configured successfully');
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

      // Start transaction monitoring if enabled
      if (process.env.TRANSACTION_MONITOR_ENABLED === 'true') {
        logger.info('Starting transaction monitoring...');
        await transactionMonitorService.startMonitoring();
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
      logger.info('Client connected to Socket.IO', { socketId: socket.id });

      socket.on('subscribe_transactions', (userId) => {
        socket.join(`user_${userId}`);
        logger.info('User subscribed to transaction updates', { userId, socketId: socket.id });
      });

      socket.on('subscribe_receipts', (userId) => {
        socket.join(`receipts_${userId}`);
        logger.info('User subscribed to receipt updates', { userId, socketId: socket.id });
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from Socket.IO', { socketId: socket.id });
      });
    });

    logger.info('Socket.IO configured successfully');
  }

  // Method to emit real-time updates
  emitTransactionUpdate(userId, transactionData) {
    this.io.to(`user_${userId}`).emit('transaction_update', transactionData);
  }

  emitReceiptGenerated(userId, receiptData) {
    this.io.to(`receipts_${userId}`).emit('receipt_generated', receiptData);
  }

  async start() {
    try {
      await this.initialize();

      this.server.listen(this.port, () => {
        logger.info('Server started successfully', {
          port: this.port,
          environment: process.env.NODE_ENV,
          pid: process.pid,
          timestamp: new Date().toISOString()
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));

      return this.server;
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    this.server.close(() => {
      logger.info('HTTP server closed');
    });

    try {
      // Stop transaction monitoring
      if (transactionMonitorService.isMonitoring) {
        await transactionMonitorService.stopMonitoring();
      }

      // Close database connections
      await databaseService.close();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Health check method
  async getHealthStatus() {
    const dbHealth = await databaseService.healthCheck();
    const transactionMonitorHealth = await transactionMonitorService.getHealthStatus();

    return {
      status: dbHealth.status === 'healthy' && transactionMonitorHealth.status === 'healthy'
        ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      services: {
        database: dbHealth,
        transactionMonitor: transactionMonitorHealth,
        receiptService: {
          status: 'healthy',
          pdfEnabled: receiptService.pdfGenerationEnabled
        }
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        pid: process.pid
      }
    };
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