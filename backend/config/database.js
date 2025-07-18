const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      const config = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.DATABASE_MAX_CONNECTIONS) || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };

      this.pool = new Pool(config);

      // Test the connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connected successfully', {
        timestamp: result.rows[0].now,
        database: 'NeonDB',
        ssl: config.ssl ? 'enabled' : 'disabled'
      });

      // Set up connection error handling
      this.pool.on('error', (err) => {
        logger.error('Database pool error:', err);
        this.isConnected = false;
      });

      return this.pool;
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get the database pool instance
   * @returns {Pool} The database pool instance
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool;
  }

  async getClient() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.pool.connect();
  }

  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'error', message: 'Database not connected' };
      }

      const result = await this.query('SELECT 1 as health_check');
      return {
        status: 'healthy',
        message: 'Database connection is active',
        timestamp: new Date().toISOString(),
        rowCount: result.rowCount
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;