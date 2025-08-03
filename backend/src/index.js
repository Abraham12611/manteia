import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';

// Import services
import { OneInchService } from './services/oneInchService.js';
import { SuiService } from './services/suiService.js';
import { ResolverBot } from './services/resolverBot.js';
import { WebSocketService } from './services/websocketService.js';

// Import routes
import swapRoutes from './routes/swap.js';
import orderRoutes from './routes/orders.js';
import resolverRoutes from './routes/resolver.js';
import healthRoutes from './routes/health.js';
import crossChainSwapRoutes from './routes/crossChainSwap.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';

dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'manteia-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

class ManteiaServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.logger = logger;
    this.services = {};
  }

  async initialize() {
    try {
      // Initialize services
      await this.initializeServices();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      this.logger.info('Manteia server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  async initializeServices() {
    this.logger.info('Initializing services...');

    // Initialize 1inch service
    this.services.oneInch = new OneInchService({
      apiKey: process.env.ONEINCH_API_KEY,
      baseUrl: process.env.ONEINCH_API_BASE_URL || 'https://api.1inch.dev',
      logger: this.logger
    });

    // Initialize Sui service
    this.services.sui = new SuiService({
      rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
      privateKey: process.env.SUI_PRIVATE_KEY,
      packageId: process.env.SUI_PACKAGE_ID || '0x468edb99a7d83ed2464eb25feb229e6d21d47b0f382c90ac5b57a393e26084fe',
      logger: this.logger
    });

    // Initialize cross-chain SDK if required environment variables are available
    if (process.env.RESOLVER_PRIVATE_KEY && process.env.ETH_RPC_URL) {
      try {
        const Web3 = (await import('web3')).default;
        const web3Provider = new Web3(process.env.ETH_RPC_URL);

        const success = this.services.oneInch.initializeCrossChainSDK(
          process.env.RESOLVER_PRIVATE_KEY,
          web3Provider
        );

        if (success) {
          // Setup WebSocket event handlers
          this.services.oneInch.setupWebSocketSubscriptions({
            onOrderCreated: (data) => {
              this.services.websocket?.broadcastOrderCreated(data);
            },
            onOrderFilled: (data) => {
              this.services.websocket?.broadcastOrderFilled(data);
            },
            onOrderCancelled: (data) => {
              this.services.websocket?.broadcastOrderCancelled(data);
            }
          });
        }
      } catch (error) {
        this.logger.warn('Failed to initialize cross-chain SDK:', error.message);
      }
    } else {
      this.logger.warn('Cross-chain SDK not initialized: missing RESOLVER_PRIVATE_KEY or ETH_RPC_URL');
    }

    // Initialize WebSocket service
    this.services.websocket = new WebSocketService({
      oneInchService: this.services.oneInch,
      suiService: this.services.sui,
      logger: this.logger
    });

    // Initialize Resolver Bot
    this.services.resolverBot = new ResolverBot({
      oneInchService: this.services.oneInch,
      suiService: this.services.sui,
      websocketService: this.services.websocket,
      logger: this.logger,
      enabled: process.env.RESOLVER_BOT_ENABLED === 'true'
    });

    // Start resolver bot if enabled
    if (process.env.RESOLVER_BOT_ENABLED === 'true') {
      await this.services.resolverBot.start();
    }

    this.logger.info('All services initialized');
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());

    // CORS configuration - Allow all localhost ports during development
    this.app.use(cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Allow all localhost ports during development
        if (origin.match(/^http:\/\/localhost:\d+$/)) {
          return callback(null, true);
        }

        // Allow remote server IP and ports
        if (origin.match(/^http:\/\/84\.32\.100\.59:\d+$/)) {
          return callback(null, true);
        }

        // Allow specific origins from environment
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://84.32.100.59:3000',
          'http://84.32.100.59:52357'
        ];
        if (allowedOrigins.indexOf(origin) !== -1) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger(this.logger));

    // Make services available to routes
    this.app.use((req, res, next) => {
      req.services = this.services;
      req.logger = this.logger;
      next();
    });
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/v1/health', healthRoutes);
    this.app.use('/api/v1/swap', swapRoutes);
    this.app.use('/api/v1/orders', orderRoutes);
    this.app.use('/api/v1/resolver', resolverRoutes);

    // New cross-chain swap routes
    this.app.use('/api/swap', crossChainSwapRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Manteia Backend',
        version: '1.0.0',
        description: 'Cross-chain DEX aggregator backend',
        endpoints: {
          health: '/api/v1/health',
          swap: '/api/v1/swap',
          orders: '/api/v1/orders',
          resolver: '/api/v1/resolver',
          crossChainSwap: '/api/swap'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  setupErrorHandling() {
    this.app.use(errorHandler(this.logger));
  }

  async start() {
    try {
      await this.initialize();

      const server = this.app.listen(this.port, () => {
        this.logger.info(`Manteia backend server running on port ${this.port}`);
        console.log(`🚀 Server ready at http://localhost:${this.port}`);
      });

      // Setup WebSocket server
      this.services.websocket.setupServer(server);

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown(server));
      process.on('SIGINT', () => this.gracefulShutdown(server));

      return server;
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async gracefulShutdown(server) {
    this.logger.info('Starting graceful shutdown...');

    // Stop accepting new connections
    server.close(async () => {
      try {
        // Stop resolver bot
        if (this.services.resolverBot) {
          await this.services.resolverBot.stop();
        }

        // Close WebSocket connections
        if (this.services.websocket) {
          this.services.websocket.close();
        }

        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      this.logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  }
}

// Start the server
const server = new ManteiaServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default ManteiaServer;