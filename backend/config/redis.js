const redis = require('redis');
const logger = require('../utils/logger');

class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
  }

  async initialize() {
    try {
      // Redis configuration based on environment variables
      const redisConfig = this.getRedisConfig();

      logger.info('Initializing Redis connection...', {
        host: redisConfig.host,
        port: redisConfig.port,
        database: redisConfig.database
      });

      // Create Redis client
      this.client = redis.createClient(redisConfig);

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to Redis
      await this.client.connect();

      this.isConnected = true;
      this.retryAttempts = 0;

      logger.info('Redis connection established successfully');

      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  getRedisConfig() {
    // Check if REDIS_URL is provided (for services like Heroku)
    if (process.env.REDIS_URL) {
      return {
        url: process.env.REDIS_URL
      };
    }

    // For Redis Cloud or custom configuration
    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      database: parseInt(process.env.REDIS_DB) || 0
    };

    // Add authentication if provided
    if (process.env.REDIS_PASSWORD) {
      config.password = process.env.REDIS_PASSWORD;
    }

    // Add username if provided (Redis 6.0+)
    if (process.env.REDIS_USERNAME) {
      config.username = process.env.REDIS_USERNAME;
    }

    // Add TLS configuration for Redis Cloud
    if (process.env.REDIS_TLS === 'true') {
      config.tls = {
        rejectUnauthorized: false
      };
    }

    return config;
  }

  setupEventHandlers() {
    this.client.on('error', (error) => {
      logger.error('Redis error:', error);
      this.isConnected = false;
      this.handleConnectionError(error);
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
      this.retryAttempts = 0;
    });

    this.client.on('end', () => {
      logger.info('Redis connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  async handleConnectionError(error) {
    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);

      logger.warn(`Redis connection failed, retrying in ${delay}ms (attempt ${this.retryAttempts}/${this.maxRetries})`);

      setTimeout(() => {
        this.initialize().catch(err => {
          logger.error('Redis retry failed:', err);
        });
      }, delay);
    } else {
      logger.error('Max Redis retry attempts reached, giving up');
    }
  }

  async testConnection() {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Redis client not connected');
      }

      const result = await this.client.ping();
      logger.info('Redis ping successful:', result);
      return true;
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }

  async set(key, value, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;

      if (options.expiry) {
        await this.client.setEx(key, options.expiry, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      logger.error('Redis SET failed:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const value = await this.client.get(key);

      if (value === null) {
        return null;
      }

      // Try to parse as JSON, fall back to string
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error('Redis GET failed:', error);
      throw error;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.del(key);
      return result;
    } catch (error) {
      logger.error('Redis DEL failed:', error);
      throw error;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS failed:', error);
      throw error;
    }
  }

  async flushDB() {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      await this.client.flushDb();
      logger.info('Redis database flushed');
      return true;
    } catch (error) {
      logger.error('Redis FLUSHDB failed:', error);
      throw error;
    }
  }

  async getInfo() {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      const info = await this.client.info();
      return info;
    } catch (error) {
      logger.error('Redis INFO failed:', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client && this.client.isOpen;
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      client: !!this.client,
      retryAttempts: this.retryAttempts,
      maxRetries: this.maxRetries
    };
  }
}

// Export singleton instance
module.exports = new RedisConfig();