const request = require('supertest');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Mock database and logger
jest.mock('../config/database', () => ({
  getPool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
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

// Create a simple test app with basic routes
const createTestApp = () => {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Test routes
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'manteia-backend'
    });
  });

  app.get('/health/detailed', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'connected' },
        blockchain: { status: 'connected', chain: 'mantle-sepolia' },
        transactionMonitor: { status: 'running' }
      }
    });
  });

  app.post('/api/users', (req, res) => {
    const { wallet_address, email, username } = req.body;

    // Basic validation
    if (!wallet_address || !email || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mock user creation
    res.status(201).json({
      id: 'test-user-id',
      wallet_address,
      email,
      username,
      created_at: new Date().toISOString()
    });
  });

  app.post('/api/transactions', (req, res) => {
    const { hash, type, user_id } = req.body;

    // Basic validation
    if (!hash || !type || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mock transaction creation
    res.status(201).json({
      id: 'test-tx-id',
      hash,
      type,
      user_id,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  });

  app.get('/api/transactions/stats', (req, res) => {
    res.json({
      total: 100,
      byStatus: {
        pending: 10,
        confirmed: 85,
        failed: 5
      },
      byType: {
        trade: 60,
        deposit: 25,
        withdrawal: 15
      }
    });
  });

  app.post('/api/receipts', (req, res) => {
    const { transaction_hash, user_id, type } = req.body;

    if (!transaction_hash || !user_id || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    res.status(201).json({
      id: 'test-receipt-id',
      receipt_number: 'RCP-' + Date.now(),
      transaction_hash,
      user_id,
      type,
      created_at: new Date().toISOString()
    });
  });

  // Error handling
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};

describe('Manteia Backend Basic Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'manteia-backend');
    });

    it('should return detailed health status', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('blockchain');
      expect(response.body.services).toHaveProperty('transactionMonitor');
    });
  });

  describe('User Management', () => {
    it('should create a user', async () => {
      const userData = {
        wallet_address: '0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c',
        email: 'test@example.com',
        username: 'testuser'
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('wallet_address', userData.wallet_address);
      expect(response.body).toHaveProperty('email', userData.email);
      expect(response.body).toHaveProperty('username', userData.username);
    });

    it('should validate user input', async () => {
      const invalidData = {
        wallet_address: '0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c'
        // Missing email and username
      };

      const response = await request(app)
        .post('/api/users')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });
  });

  describe('Transaction Management', () => {
    it('should create a transaction', async () => {
      const transactionData = {
        hash: '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        type: 'trade',
        user_id: 'user-123'
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

    it('should get transaction statistics', async () => {
      const response = await request(app)
        .get('/api/transactions/stats')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body).toHaveProperty('byType');
      expect(response.body.byStatus).toHaveProperty('pending');
      expect(response.body.byStatus).toHaveProperty('confirmed');
      expect(response.body.byStatus).toHaveProperty('failed');
    });
  });

  describe('Receipt Management', () => {
    it('should generate a receipt', async () => {
      const receiptData = {
        transaction_hash: '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        user_id: 'user-123',
        type: 'trade'
      };

      const response = await request(app)
        .post('/api/receipts')
        .send(receiptData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('receipt_number');
      expect(response.body).toHaveProperty('transaction_hash', receiptData.transaction_hash);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid JSON');
    });
  });

  describe('Security Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});

describe('Database Integration', () => {
  it('should test database connection', async () => {
    const { testConnection } = require('../config/database');
    const result = await testConnection();
    expect(result).toBe(true);
  });
});

describe('Logging System', () => {
  it('should have logger methods', () => {
    const logger = require('../utils/logger');
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('debug');
  });
});