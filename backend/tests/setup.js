// Test setup file
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Mock environment variables for testing
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'manteia_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.MANTLE_SEPOLIA_RPC = 'https://test-rpc.mantle.xyz';
process.env.JWT_SECRET = 'test-jwt-secret';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};