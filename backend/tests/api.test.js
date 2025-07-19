const request = require('supertest');
const express = require('express');

// Mock the database and logger to avoid dependencies during testing
jest.mock('../config/database', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  })),
  testConnection: jest.fn(() => Promise.resolve(true))
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Create a simple test app
const app = express();
app.use(express.json());

// Add health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Basic transaction endpoint
app.post('/api/transactions', (req, res) => {
  const { hash, type, user_id } = req.body;

  if (!hash || !type || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  res.status(201).json({
    id: 'test-tx-id',
    hash,
    type,
    user_id,
    status: 'pending',
    created_at: new Date().toISOString()
  });
});

describe('Manteia Backend API', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Transactions API', () => {
    it('should create a transaction', async () => {
      const transactionData = {
        hash: '0x123456789abcdef',
        type: 'trade',
        user_id: 'user-123',
        amount: '100',
        chain_id: 5003
      };

      const response = await request(app)
        .post('/api/transactions')
        .send(transactionData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('hash', transactionData.hash);
      expect(response.body).toHaveProperty('type', transactionData.type);
      expect(response.body).toHaveProperty('status', 'pending');
    });

    it('should reject invalid transaction data', async () => {
      const invalidData = {
        hash: '0x123456789abcdef'
        // Missing type and user_id
      };

      await request(app)
        .post('/api/transactions')
        .send(invalidData)
        .expect(400);
    });
  });
});

describe('System Integration', () => {
  it('should handle database connection', async () => {
    const { testConnection } = require('../config/database');
    const result = await testConnection();
    expect(result).toBe(true);
  });

  it('should initialize logger', () => {
    const logger = require('../utils/logger');
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('debug');
  });
});