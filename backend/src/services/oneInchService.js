import axios from 'axios';
import { ethers } from 'ethers';

export class OneInchService {
  constructor({ apiKey, baseUrl, logger }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.logger = logger;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Supported chains for cross-chain swaps
    this.supportedChains = {
      1: 'ethereum',
      137: 'polygon',
      56: 'bsc',
      42161: 'arbitrum',
      10: 'optimism',
      43114: 'avalanche',
      8453: 'base'
    };

    this.logger.info('1inch service initialized');
  }

  // Fusion+ Cross-Chain Swap Methods
  async getFusionQuote(params) {
    try {
      const { srcChainId, dstChainId, srcTokenAddress, dstTokenAddress, amount } = params;

      const response = await this.client.get('/fusion-plus/quoter/v1.0/quote', {
        params: {
          srcChainId,
          dstChainId,
          srcTokenAddress,
          dstTokenAddress,
          amount
        }
      });

      this.logger.info('Fusion+ quote retrieved', {
        srcChain: srcChainId,
        dstChain: dstChainId,
        amount
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting Fusion+ quote:', error);
      throw new Error(`Failed to get Fusion+ quote: ${error.message}`);
    }
  }

  async createFusionOrder(params) {
    try {
      const {
        srcChainId,
        dstChainId,
        srcTokenAddress,
        dstTokenAddress,
        amount,
        userAddress,
        hashLock,
        timelock,
        crossChainId
      } = params;

      // Create order with atomic swap parameters
      const orderData = {
        srcChainId,
        dstChainId,
        srcTokenAddress,
        dstTokenAddress,
        amount,
        userAddress,
        // Custom data for our atomic swap
        customData: {
          hashLock,
          timelock,
          crossChainId,
          protocol: 'manteia'
        }
      };

      const response = await this.client.post('/fusion-plus/quoter/v1.0/orders', orderData);

      this.logger.info('Fusion+ order created', {
        orderId: response.data.orderId,
        crossChainId
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error creating Fusion+ order:', error);
      throw new Error(`Failed to create Fusion+ order: ${error.message}`);
    }
  }

  async getFusionOrderStatus(orderId) {
    try {
      const response = await this.client.get(`/fusion-plus/relayer/v1.0/orders/${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error getting Fusion+ order status:', error);
      throw new Error(`Failed to get order status: ${error.message}`);
    }
  }

  // Limit Order Protocol Methods for Advanced Strategies
  async createLimitOrder(params) {
    try {
      const {
        chainId,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        maker,
        predicate,
        permit,
        interaction
      } = params;

      const orderData = {
        salt: Date.now(),
        makerAsset,
        takerAsset,
        maker,
        receiver: maker,
        allowedSender: '0x0000000000000000000000000000000000000000',
        makingAmount,
        takingAmount,
        predicate,
        permit,
        interaction
      };

      const response = await this.client.post(`/orderbook/v3.0/${chainId}/order`, orderData);

      this.logger.info('Limit order created', {
        chainId,
        makerAsset,
        takerAsset
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error creating limit order:', error);
      throw new Error(`Failed to create limit order: ${error.message}`);
    }
  }

  // TWAP (Time-Weighted Average Price) Implementation
  async createTWAPOrder(params) {
    try {
      const {
        chainId,
        makerAsset,
        takerAsset,
        totalAmount,
        intervals,
        duration,
        maker
      } = params;

      const orders = [];
      const amountPerInterval = Math.floor(totalAmount / intervals);
      const intervalDuration = Math.floor(duration / intervals);

      for (let i = 0; i < intervals; i++) {
        const startTime = Date.now() + (i * intervalDuration * 1000);
        const endTime = startTime + (intervalDuration * 1000);

        // Create predicate for time-based execution
        const predicate = this.createTimePredicate(startTime, endTime);

        const order = await this.createLimitOrder({
          chainId,
          makerAsset,
          takerAsset,
          makingAmount: amountPerInterval.toString(),
          takingAmount: '0', // Will be filled by market
          maker,
          predicate
        });

        orders.push(order);
      }

      this.logger.info('TWAP orders created', {
        intervals: orders.length,
        totalAmount
      });

      return { orders, strategy: 'TWAP' };
    } catch (error) {
      this.logger.error('Error creating TWAP orders:', error);
      throw new Error(`Failed to create TWAP orders: ${error.message}`);
    }
  }

  // Options-like Orders using Predicates
  async createOptionsOrder(params) {
    try {
      const {
        chainId,
        makerAsset,
        takerAsset,
        makingAmount,
        strikePrice,
        expiry,
        maker,
        optionType = 'call'
      } = params;

      // Create predicate that checks oracle price
      const predicate = this.createPricePredicate(takerAsset, strikePrice, optionType, expiry);

      const order = await this.createLimitOrder({
        chainId,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount: strikePrice.toString(),
        maker,
        predicate
      });

      this.logger.info('Options order created', {
        optionType,
        strikePrice,
        expiry
      });

      return { ...order, strategy: 'options', optionType };
    } catch (error) {
      this.logger.error('Error creating options order:', error);
      throw new Error(`Failed to create options order: ${error.message}`);
    }
  }

  // Classic Swap Methods
  async getClassicQuote(params) {
    try {
      const { chainId, src, dst, amount, from } = params;

      const response = await this.client.get(`/swap/v5.2/${chainId}/quote`, {
        params: { src, dst, amount, from }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting classic quote:', error);
      throw new Error(`Failed to get classic quote: ${error.message}`);
    }
  }

  async getClassicSwap(params) {
    try {
      const { chainId, src, dst, amount, from, slippage } = params;

      const response = await this.client.get(`/swap/v5.2/${chainId}/swap`, {
        params: { src, dst, amount, from, slippage }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error getting classic swap:', error);
      throw new Error(`Failed to get classic swap: ${error.message}`);
    }
  }

  // Token Information
  async getTokens(chainId) {
    try {
      const response = await this.client.get(`/swap/v5.2/${chainId}/tokens`);
      return response.data;
    } catch (error) {
      this.logger.error('Error getting tokens:', error);
      throw new Error(`Failed to get tokens: ${error.message}`);
    }
  }

  async getTokenPrice(chainId, addresses) {
    try {
      const response = await this.client.get(`/price/v1.1/${chainId}`, {
        params: { tokens: addresses.join(',') }
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error getting token prices:', error);
      throw new Error(`Failed to get token prices: ${error.message}`);
    }
  }

  // Portfolio and Balance APIs
  async getPortfolio(address, chainIds) {
    try {
      const response = await this.client.get('/portfolio/portfolio/v4/overview/erc20', {
        params: {
          addresses: address,
          'chain_ids': chainIds.join(',')
        }
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error getting portfolio:', error);
      throw new Error(`Failed to get portfolio: ${error.message}`);
    }
  }

  async getBalances(address, chainIds) {
    try {
      const response = await this.client.get('/balance/v1.2/balances', {
        params: {
          addresses: address,
          'chain_ids': chainIds.join(',')
        }
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error getting balances:', error);
      throw new Error(`Failed to get balances: ${error.message}`);
    }
  }

  // Transaction History
  async getTransactionHistory(address, chainId, limit = 100) {
    try {
      const response = await this.client.get('/history/v2.0/history', {
        params: {
          address,
          chainId,
          limit
        }
      });
      return response.data;
    } catch (error) {
      this.logger.error('Error getting transaction history:', error);
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

  // Gas Price API
  async getGasPrice(chainId) {
    try {
      const response = await this.client.get(`/gas-price/v1.4/${chainId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error getting gas price:', error);
      throw new Error(`Failed to get gas price: ${error.message}`);
    }
  }

  // Helper Methods for Predicates
  createTimePredicate(startTime, endTime) {
    // This would be the actual predicate bytecode for time-based orders
    // For demo purposes, returning a placeholder
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256'],
      [startTime, endTime]
    );
  }

  createPricePredicate(token, strikePrice, optionType, expiry) {
    // This would be the actual predicate bytecode for price-based orders
    // For demo purposes, returning a placeholder
    return ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint8', 'uint256'],
      [token, strikePrice, optionType === 'call' ? 1 : 0, expiry]
    );
  }

  // WebSocket connection for real-time updates
  async subscribeToOrders(callback) {
    try {
      // Implementation would use 1inch WebSocket API
      this.logger.info('Subscribing to order updates via WebSocket');

      // For demo purposes, we'll simulate with polling
      setInterval(async () => {
        try {
          // Poll for order updates
          const orders = await this.getActiveOrders();
          callback(orders);
        } catch (error) {
          this.logger.error('Error in order subscription:', error);
        }
      }, 5000);

    } catch (error) {
      this.logger.error('Error subscribing to orders:', error);
      throw error;
    }
  }

  async getActiveOrders() {
    try {
      // This would get active orders from 1inch
      // For demo purposes, returning empty array
      return [];
    } catch (error) {
      this.logger.error('Error getting active orders:', error);
      throw error;
    }
  }
}