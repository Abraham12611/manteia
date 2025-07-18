import axios from 'axios';
import BackendService from './backendService';

// Mock axios to prevent actual API calls during testing
jest.mock('axios');
const mockedAxios = axios;

describe('BackendService', () => {
  let backendService;

  beforeEach(() => {
    backendService = new BackendService();
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('User Management', () => {
    it('should create a user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        walletAddress: '0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c',
        email: 'test@example.com',
        username: 'testuser',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockUser }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await backendService.createUser(
        '0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c',
        'test@example.com',
        'testuser'
      );

      expect(result).toEqual(mockUser);
    });

    it('should get user by wallet address', async () => {
      const mockUser = {
        id: 'user-123',
        walletAddress: '0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c',
        email: 'test@example.com',
        username: 'testuser'
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockUser }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await backendService.getUserByWallet('0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c');

      expect(result).toEqual(mockUser);
    });
  });

  describe('Transaction Management', () => {
    it('should create a transaction successfully', async () => {
      const mockTransaction = {
        id: 'tx-123',
        hash: '0x123456789abcdef',
        type: 'trade',
        user_id: 'user-123',
        status: 'pending',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockTransaction }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await backendService.createTransaction({
        hash: '0x123456789abcdef',
        type: 'trade',
        user_id: 'user-123',
        amount: '100.00',
        chain_id: 5003
      });

      expect(result).toEqual(mockTransaction);
    });

    it('should get transaction statistics', async () => {
      const mockStats = {
        total: 150,
        byStatus: {
          pending: 10,
          confirmed: 130,
          failed: 10
        },
        byType: {
          trade: 90,
          deposit: 30,
          withdrawal: 30
        }
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockStats }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await backendService.getTransactionStats();

      expect(result).toEqual(mockStats);
    });
  });

  describe('Receipt Management', () => {
    it('should generate a receipt successfully', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        receipt_number: 'RCP-1234567890',
        transaction_hash: '0x123456789abcdef',
        user_id: 'user-123',
        type: 'trade',
        created_at: '2024-01-01T00:00:00.000Z'
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockReceipt }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await backendService.createReceipt({
        transaction_hash: '0x123456789abcdef',
        user_id: 'user-123',
        type: 'trade',
        amount: '100.00'
      });

      expect(result).toEqual(mockReceipt);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Network error')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      await expect(backendService.createUser('0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c'))
        .rejects
        .toThrow('Failed to create user');
    });

    it('should handle timeout errors', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('timeout of 10000ms exceeded')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      await expect(backendService.getTransactionStats())
        .rejects
        .toThrow('Failed to get transaction statistics');
    });
  });

  describe('Configuration', () => {
    it('should use correct base URL', () => {
      // Test that the service creates axios instance with correct config
      const originalEnv = process.env.REACT_APP_BACKEND_URL;
      process.env.REACT_APP_BACKEND_URL = 'https://api.manteia.com';

      new BackendService();

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.manteia.com'
        })
      );

      // Restore original environment
      process.env.REACT_APP_BACKEND_URL = originalEnv;
    });

    it('should have proper timeout configuration', () => {
      new BackendService();

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000
        })
      );
    });
  });
});