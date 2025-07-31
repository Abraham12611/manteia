import axios from 'axios';
import { ethers } from 'ethers';
// Use dynamic import to handle module compatibility
let CrossChainSDK, HashLock, NetworkEnum, PresetEnum, OrderStatus, PrivateKeyProviderConnector, WebSocketApi;

// Initialize SDK components
const initializeSDK = async () => {
  try {
    const sdkModule = await import('@1inch/cross-chain-sdk');

    // Extract components - handle both default and named exports
    const sdk = sdkModule.default || sdkModule;

    CrossChainSDK = sdk.SDK || sdkModule.SDK;
    HashLock = sdk.HashLock || sdkModule.HashLock;
    NetworkEnum = sdk.NetworkEnum || sdkModule.NetworkEnum;
    PresetEnum = sdk.PresetEnum || sdkModule.PresetEnum;
    OrderStatus = sdk.OrderStatus || sdkModule.OrderStatus;
    PrivateKeyProviderConnector = sdk.PrivateKeyProviderConnector || sdkModule.PrivateKeyProviderConnector;
    WebSocketApi = sdk.WebSocketApi || sdkModule.WebSocketApi;

    return true;
  } catch (error) {
    console.error('Failed to initialize 1inch SDK:', error);
    return false;
  }
};
import { randomBytes } from 'crypto';

export class OneInchService {
  constructor({ apiKey, baseUrl, logger }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.sdkInitialized = false;

    // Create axios instance for classic/fusion operations
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Initialize Cross-Chain SDK
    this.crossChainSDK = null;
    this.websocketApi = null;

    // Initialize SDK components asynchronously
    this.initializeSDKComponents();
  }

  async initializeSDKComponents() {
    const success = await initializeSDK();
    if (success) {
      this.sdkInitialized = true;

      // Supported chains mapping (now available after SDK init)
      this.supportedChains = {
        1: NetworkEnum.ETHEREUM,
        137: NetworkEnum.POLYGON,
        56: NetworkEnum.BINANCE,
        42161: NetworkEnum.ARBITRUM,
        10: NetworkEnum.OPTIMISM,
        43114: NetworkEnum.AVALANCHE,
        8453: NetworkEnum.BASE
      };

      this.logger.info('1inch SDK initialized successfully');
    } else {
      this.logger.error('Failed to initialize 1inch SDK');
    }
  }

  // Helper method to ensure SDK is ready
  async ensureSDKReady() {
    if (!this.sdkInitialized) {
      await this.initializeSDKComponents();
    }
    if (!this.sdkInitialized) {
      throw new Error('1inch SDK not available');
    }
  }

  // Initialize cross-chain SDK with blockchain provider
  async initializeCrossChainSDK(privateKey, web3Provider) {
    try {
      await this.ensureSDKReady();

      const blockchainProvider = new PrivateKeyProviderConnector(privateKey, web3Provider);

      this.crossChainSDK = new CrossChainSDK({
        url: 'https://api.1inch.dev/fusion-plus',
        authKey: this.apiKey,
        blockchainProvider
      });

      // Initialize WebSocket API for real-time updates
      this.websocketApi = new WebSocketApi({
        url: 'wss://api.1inch.dev/fusion-plus/ws',
        authKey: this.apiKey
      });

      this.logger.info('Cross-chain SDK initialized');
      return true;
    } catch (error) {
      this.logger.error('Error initializing cross-chain SDK:', error);
      return false;
    }
  }

  // Cross-Chain Swap Methods using proper SDK
  async getCrossChainQuote(params) {
    try {
      if (!this.crossChainSDK) {
        throw new Error('Cross-chain SDK not initialized. Call initializeCrossChainSDK first.');
      }

      const { srcChainId, dstChainId, srcTokenAddress, dstTokenAddress, amount, walletAddress } = params;

      const quote = await this.crossChainSDK.getQuote({
        amount,
        srcChainId: this.supportedChains[srcChainId] || srcChainId,
        dstChainId: this.supportedChains[dstChainId] || dstChainId,
        srcTokenAddress,
        dstTokenAddress,
        walletAddress,
        enableEstimate: true
      });

      this.logger.info('Cross-chain quote retrieved', {
        srcChain: srcChainId,
        dstChain: dstChainId,
        amount
      });

      return quote;
    } catch (error) {
      this.logger.error('Error getting cross-chain quote:', error);
      throw new Error(`Failed to get cross-chain quote: ${error.message}`);
    }
  }

  async createCrossChainOrder(params) {
    try {
      if (!this.crossChainSDK) {
        throw new Error('Cross-chain SDK not initialized. Call initializeCrossChainSDK first.');
      }

      const {
        quote,
        walletAddress,
        preset = PresetEnum.fast,
        source = 'manteia-dex'
      } = params;

      // Generate secrets for the order
      const secretsCount = quote.presets[preset].secretsCount;
      const secrets = Array.from({ length: secretsCount }).map(() =>
        '0x' + randomBytes(32).toString('hex')
      );

      // Create hash lock
      const hashLock = secrets.length === 1
        ? HashLock.forSingleFill(secrets[0])
        : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets));

      // Generate secret hashes
      const secretHashes = secrets.map(secret => HashLock.hashSecret(secret));

      // Create the order
      const { hash, quoteId, order } = await this.crossChainSDK.createOrder(quote, {
        walletAddress,
        hashLock,
        preset,
        source,
        secretHashes
      });

      this.logger.info('Cross-chain order created', {
        orderHash: hash,
        quoteId
      });

      return {
        orderHash: hash,
        quoteId,
        order,
        secrets,
        secretHashes
      };
    } catch (error) {
      this.logger.error('Error creating cross-chain order:', error);
      throw new Error(`Failed to create cross-chain order: ${error.message}`);
    }
  }

  async submitCrossChainOrder(params) {
    try {
      if (!this.crossChainSDK) {
        throw new Error('Cross-chain SDK not initialized. Call initializeCrossChainSDK first.');
      }

      const { srcChainId, order, quoteId, secretHashes } = params;

      const orderInfo = await this.crossChainSDK.submitOrder(
        this.supportedChains[srcChainId] || srcChainId,
        order,
        quoteId,
        secretHashes
      );

      this.logger.info('Cross-chain order submitted', {
        orderHash: params.orderHash || 'unknown'
      });

      return orderInfo;
    } catch (error) {
      this.logger.error('Error submitting cross-chain order:', error);
      throw new Error(`Failed to submit cross-chain order: ${error.message}`);
    }
  }

  async getCrossChainOrderStatus(orderHash) {
    try {
      if (!this.crossChainSDK) {
        throw new Error('Cross-chain SDK not initialized. Call initializeCrossChainSDK first.');
      }

      const status = await this.crossChainSDK.getOrderStatus(orderHash);
      return status;
    } catch (error) {
      this.logger.error('Error getting cross-chain order status:', error);
      throw new Error(`Failed to get order status: ${error.message}`);
    }
  }

  async getReadyToAcceptSecrets(orderHash) {
    try {
      if (!this.crossChainSDK) {
        throw new Error('Cross-chain SDK not initialized. Call initializeCrossChainSDK first.');
      }

      const secretsToShare = await this.crossChainSDK.getReadyToAcceptSecretFills(orderHash);
      return secretsToShare;
    } catch (error) {
      this.logger.error('Error getting ready secrets:', error);
      throw new Error(`Failed to get ready secrets: ${error.message}`);
    }
  }

  async submitSecret(orderHash, secret) {
    try {
      if (!this.crossChainSDK) {
        throw new Error('Cross-chain SDK not initialized. Call initializeCrossChainSDK first.');
      }

      await this.crossChainSDK.submitSecret(orderHash, secret);

      this.logger.info('Secret submitted for order', { orderHash });
      return true;
    } catch (error) {
      this.logger.error('Error submitting secret:', error);
      throw new Error(`Failed to submit secret: ${error.message}`);
    }
  }

  // Legacy method names for backward compatibility
  async getFusionQuote(params) {
    return this.getCrossChainQuote(params);
  }

  async createFusionOrder(params) {
    // Convert legacy params to new format
    const quote = await this.getCrossChainQuote(params);
    return this.createCrossChainOrder({ quote, ...params });
  }

  async getFusionOrderStatus(orderHash) {
    return this.getCrossChainOrderStatus(orderHash);
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

  // WebSocket Methods for Real-time Updates
  setupWebSocketSubscriptions(eventHandlers = {}) {
    if (!this.websocketApi) {
      this.logger.warn('WebSocket API not initialized');
      return false;
    }

    try {
      // Subscribe to all order events
      this.websocketApi.order.onOrder((data) => {
        this.logger.debug('Received order event', { type: data.event });

        switch (data.event) {
          case 'order_created':
            if (eventHandlers.onOrderCreated) {
              eventHandlers.onOrderCreated(data.data);
            }
            break;
          case 'order_filled':
            if (eventHandlers.onOrderFilled) {
              eventHandlers.onOrderFilled(data.data);
            }
            break;
          case 'order_cancelled':
            if (eventHandlers.onOrderCancelled) {
              eventHandlers.onOrderCancelled(data.data);
            }
            break;
          case 'order_filled_partially':
            if (eventHandlers.onOrderFilledPartially) {
              eventHandlers.onOrderFilledPartially(data.data);
            }
            break;
          case 'secret_shared':
            if (eventHandlers.onSecretShared) {
              eventHandlers.onSecretShared(data.data);
            }
            break;
          default:
            this.logger.debug('Unhandled order event', data.event);
        }
      });

      // Subscribe to specific order events
      this.websocketApi.order.onOrderCreated((data) => {
        this.logger.info('Order created', { orderHash: data.orderHash });
      });

      this.websocketApi.order.onOrderFilled((data) => {
        this.logger.info('Order filled', { orderHash: data.orderHash });
      });

      // Connection event handlers
      this.websocketApi.onOpen(() => {
        this.logger.info('1inch WebSocket connected');
      });

      this.websocketApi.onError((error) => {
        this.logger.error('1inch WebSocket error:', error);
      });

      this.websocketApi.onClose(() => {
        this.logger.warn('1inch WebSocket disconnected');
      });

      this.logger.info('WebSocket subscriptions setup completed');
      return true;
    } catch (error) {
      this.logger.error('Error setting up WebSocket subscriptions:', error);
      return false;
    }
  }

  // Legacy method for backward compatibility
  async subscribeToOrders(callback) {
    try {
      if (!this.websocketApi) {
        // Fallback to polling if WebSocket not available
        this.logger.info('WebSocket not available, falling back to polling');

        setInterval(async () => {
          try {
            const orders = await this.getActiveOrders();
            callback(orders);
          } catch (error) {
            this.logger.error('Error in order polling:', error);
          }
        }, 5000);

        return;
      }

      // Use WebSocket subscription
      this.setupWebSocketSubscriptions({
        onOrderCreated: callback,
        onOrderFilled: callback,
        onOrderCancelled: callback
      });

    } catch (error) {
      this.logger.error('Error subscribing to orders:', error);
      throw error;
    }
  }

  async getActiveOrders(params = {}) {
    try {
      if (this.crossChainSDK) {
        // Get active orders from cross-chain SDK
        const orders = await this.crossChainSDK.getActiveOrders({
          page: params.page || 1,
          limit: params.limit || 20
        });
        return orders;
      } else {
        // Fallback to direct API call
        const response = await this.client.get('/fusion-plus/relayer/v1.0/orders/active', {
          params: {
            page: params.page || 1,
            limit: params.limit || 20
          }
        });
        return response.data;
      }
    } catch (error) {
      this.logger.error('Error getting active orders:', error);
      throw error;
    }
  }

  // Monitor order execution with automatic secret submission
  async monitorAndExecuteOrder(orderHash, secrets) {
    if (!this.crossChainSDK) {
      throw new Error('Cross-chain SDK not initialized');
    }

    this.logger.info('Starting order monitoring', { orderHash });

    while (true) {
      try {
        // Check for secrets ready to be shared
        const secretsToShare = await this.getReadyToAcceptSecrets(orderHash);

        if (secretsToShare.fills && secretsToShare.fills.length > 0) {
          for (const { idx } of secretsToShare.fills) {
            if (secrets[idx]) {
              await this.submitSecret(orderHash, secrets[idx]);
              this.logger.info('Secret submitted', { orderHash, idx });
            }
          }
        }

        // Check order status
        const status = await this.getCrossChainOrderStatus(orderHash);

        if (status.status === OrderStatus.Executed ||
            status.status === OrderStatus.Expired ||
            status.status === OrderStatus.Refunded) {
          this.logger.info('Order monitoring completed', {
            orderHash,
            finalStatus: status.status
          });
          return status;
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        this.logger.error('Error in order monitoring:', error);
        // Continue monitoring despite errors
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}