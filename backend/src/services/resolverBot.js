import { EventEmitter } from 'events';
import cron from 'node-cron';

export class ResolverBot extends EventEmitter {
  constructor({ oneInchService, suiService, websocketService, logger, enabled = true }) {
    super();

    this.oneInchService = oneInchService;
    this.suiService = suiService;
    this.websocketService = websocketService;
    this.logger = logger;
    this.enabled = enabled;

    // Bot state
    this.isRunning = false;
    this.activeSwaps = new Map(); // Track ongoing swaps
    this.completedSwaps = new Map(); // Track completed swaps
    this.failedSwaps = new Map(); // Track failed swaps

    // Configuration
    this.config = {
      minProfitMargin: 0.005, // 0.5% minimum profit
      maxSlippage: 0.01, // 1% max slippage
      timeoutMinutes: 30, // 30 minute timeout for swaps
      maxConcurrentSwaps: 10,
      retryAttempts: 3,
      retryDelayMs: 5000
    };

    // Performance metrics
    this.metrics = {
      totalSwapsProcessed: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      totalVolume: 0,
      totalProfit: 0,
      averageExecutionTime: 0
    };

    this.logger.info('Resolver bot initialized', { enabled: this.enabled });
  }

  async start() {
    if (!this.enabled) {
      this.logger.info('Resolver bot is disabled');
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Resolver bot is already running');
      return;
    }

    try {
      this.isRunning = true;
      this.logger.info('Starting resolver bot...');

      // Start monitoring both chains
      await this.startMonitoring();

      // Start periodic cleanup and health checks
      this.startPeriodicTasks();

      this.logger.info('Resolver bot started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start resolver bot:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping resolver bot...');
    this.isRunning = false;

    // Cancel all active swaps
    for (const [swapId, swap] of this.activeSwaps) {
      try {
        await this.cancelSwap(swapId, 'Bot shutdown');
      } catch (error) {
        this.logger.error(`Error cancelling swap ${swapId}:`, error);
      }
    }

    this.logger.info('Resolver bot stopped');
    this.emit('stopped');
  }

  async startMonitoring() {
    try {
      // Monitor Sui escrow events
      await this.suiService.subscribeToEscrowEvents((event) => {
        this.handleSuiEvent(event);
      });
    } catch (error) {
      this.logger.error('Failed to start Sui event monitoring:', error.message);
    }

    try {
      // Monitor 1inch Fusion+ orders
      await this.oneInchService.subscribeToOrders((orders) => {
        this.handleFusionOrders(orders);
      });
    } catch (error) {
      this.logger.error('Failed to start 1inch order monitoring:', error.message);
    }

    this.logger.info('Started monitoring both chains for swap opportunities');
  }

  startPeriodicTasks() {
    // Health check every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.performHealthCheck();
    });

    // Cleanup expired swaps every 10 minutes
    cron.schedule('*/10 * * * *', () => {
      this.cleanupExpiredSwaps();
    });

    // Log metrics every hour
    cron.schedule('0 * * * *', () => {
      this.logMetrics();
    });
  }

  async handleSuiEvent(event) {
    try {
      if (event.type === 'escrow_created') {
        await this.handleSuiEscrowCreated(event);
      } else if (event.type === 'escrow_claimed') {
        await this.handleSuiEscrowClaimed(event);
      }
    } catch (error) {
      this.logger.error('Error handling Sui event:', error);
    }
  }

  async handleSuiEscrowCreated(event) {
    const {
      escrowId,
      sender,
      recipient,
      amount,
      hash,
      expiry,
      crossChainId
    } = event;

    this.logger.info('New Sui escrow detected', {
      escrowId,
      amount,
      crossChainId
    });

    // Check if this is a cross-chain swap we should handle
    if (await this.shouldHandleSwap(event)) {
      const swapId = this.generateSwapId(crossChainId);

      const swap = {
        id: swapId,
        type: 'SUI_TO_ETH',
        status: 'PENDING',
        suiEscrowId: escrowId,
        sender,
        recipient,
        amount,
        hash,
        expiry,
        crossChainId,
        createdAt: Date.now(),
        attempts: 0
      };

      this.activeSwaps.set(swapId, swap);

      // Execute the cross-chain swap
      await this.executeCrossChainSwap(swap);
    }
  }

  async handleSuiEscrowClaimed(event) {
    const { escrowId, secret } = event;

    // Find any active swap that was waiting for this secret
    for (const [swapId, swap] of this.activeSwaps) {
      if (swap.suiEscrowId === escrowId) {
        this.logger.info('Secret revealed for swap', { swapId, escrowId });

        // Use the secret to claim on Ethereum side
        if (swap.status === 'WAITING_FOR_SECRET') {
          swap.secret = secret;
          await this.claimEthereumEscrow(swap);
        }
        break;
      }
    }
  }

  async handleFusionOrders(orders) {
    for (const order of orders) {
      if (this.isCrossChainOrder(order)) {
        await this.handleFusionCrossChainOrder(order);
      }
    }
  }

  async handleFusionCrossChainOrder(order) {
    // Check if this order is for ETH -> SUI swap
    if (order.dstChainId === 'sui' || order.customData?.protocol === 'manteia') {
      const swapId = this.generateSwapId(order.customData?.crossChainId || order.id);

      const swap = {
        id: swapId,
        type: 'ETH_TO_SUI',
        status: 'PENDING',
        fusionOrderId: order.id,
        srcChainId: order.srcChainId,
        amount: order.amount,
        hashLock: order.customData?.hashLock,
        timelock: order.customData?.timelock,
        crossChainId: order.customData?.crossChainId,
        createdAt: Date.now(),
        attempts: 0
      };

      this.activeSwaps.set(swapId, swap);

      // Execute the cross-chain swap
      await this.executeCrossChainSwap(swap);
    }
  }

  async executeCrossChainSwap(swap) {
    try {
      this.logger.info('Executing cross-chain swap', {
        swapId: swap.id,
        type: swap.type
      });

      swap.status = 'EXECUTING';
      swap.attempts += 1;

      if (swap.type === 'ETH_TO_SUI') {
        await this.executeEthToSuiSwap(swap);
      } else if (swap.type === 'SUI_TO_ETH') {
        await this.executeSuiToEthSwap(swap);
      }

    } catch (error) {
      this.logger.error('Error executing cross-chain swap:', error);
      await this.handleSwapError(swap, error);
    }
  }

  async executeEthToSuiSwap(swap) {
    const startTime = Date.now();

    try {
      // 1. Check profitability
      const profitable = await this.checkSwapProfitability(swap);
      if (!profitable) {
        throw new Error('Swap not profitable');
      }

      // 2. Create Sui escrow with same hash and timelock
      const suiEscrow = await this.suiService.createEscrow({
        coin: await this.getSuiCoin(swap.amount),
        recipient: swap.recipient || swap.sender,
        resolver: this.suiService.address,
        secret: swap.secret || this.suiService.generateSecret(),
        duration: swap.timelock || (30 * 60 * 1000), // 30 minutes
        crossChainId: swap.crossChainId
      });

      swap.suiEscrowId = suiEscrow.escrowId;
      swap.secret = suiEscrow.secret || swap.secret;

      // 3. Execute the Fusion+ order
      // This would involve calling 1inch contracts to fulfill the order
      await this.fulfillFusionOrder(swap);

      swap.status = 'COMPLETED';
      swap.completedAt = Date.now();
      swap.executionTime = Date.now() - startTime;

      // Move to completed swaps
      this.completedSwaps.set(swap.id, swap);
      this.activeSwaps.delete(swap.id);

      this.updateMetrics(swap, true);

      this.logger.info('ETH to SUI swap completed', {
        swapId: swap.id,
        executionTime: swap.executionTime
      });

    } catch (error) {
      throw error;
    }
  }

  async executeSuiToEthSwap(swap) {
    const startTime = Date.now();

    try {
      // 1. Check profitability
      const profitable = await this.checkSwapProfitability(swap);
      if (!profitable) {
        throw new Error('Swap not profitable');
      }

      // 2. Create Ethereum escrow (via 1inch Fusion+)
      const ethEscrow = await this.createEthereumEscrow(swap);

      swap.ethEscrowId = ethEscrow.escrowId;
      swap.status = 'WAITING_FOR_SECRET';

      // 3. Wait for user to claim on Sui and reveal secret
      // This will be handled by handleSuiEscrowClaimed

      this.logger.info('SUI to ETH swap prepared, waiting for secret reveal', {
        swapId: swap.id
      });

    } catch (error) {
      throw error;
    }
  }

  async claimEthereumEscrow(swap) {
    try {
      // Use the revealed secret to claim the Ethereum escrow
      const result = await this.oneInchService.claimEscrow({
        escrowId: swap.ethEscrowId,
        secret: swap.secret
      });

      swap.status = 'COMPLETED';
      swap.completedAt = Date.now();
      swap.executionTime = Date.now() - swap.createdAt;

      // Move to completed swaps
      this.completedSwaps.set(swap.id, swap);
      this.activeSwaps.delete(swap.id);

      this.updateMetrics(swap, true);

      this.logger.info('SUI to ETH swap completed', {
        swapId: swap.id,
        secret: swap.secret,
        executionTime: swap.executionTime
      });

    } catch (error) {
      this.logger.error('Error claiming Ethereum escrow:', error);
      await this.handleSwapError(swap, error);
    }
  }

  async checkSwapProfitability(swap) {
    try {
      // Get current market rates
      const srcPrice = await this.getTokenPrice(swap.srcToken, swap.srcChainId);
      const dstPrice = await this.getTokenPrice(swap.dstToken, swap.dstChainId);

      // Calculate expected profit
      const marketRate = srcPrice / dstPrice;
      const swapRate = swap.dstAmount / swap.srcAmount;
      const profitMargin = (swapRate - marketRate) / marketRate;

      const isProfitable = profitMargin >= this.config.minProfitMargin;

      this.logger.debug('Profitability check', {
        swapId: swap.id,
        marketRate,
        swapRate,
        profitMargin,
        isProfitable
      });

      return isProfitable;
    } catch (error) {
      this.logger.error('Error checking profitability:', error);
      return false;
    }
  }

  async fulfillFusionOrder(swap) {
    // Implementation would call 1inch Fusion+ resolver contracts
    // For demo purposes, we'll simulate the fulfillment
    this.logger.info('Fulfilling Fusion+ order', { swapId: swap.id });

    // In practice, this would:
    // 1. Call the Fusion+ smart contract
    // 2. Provide proof of Sui escrow creation
    // 3. Execute the cross-chain transfer

    return { success: true, txHash: 'mock_tx_hash' };
  }

  async createEthereumEscrow(swap) {
    // Implementation would create escrow on Ethereum via 1inch
    // For demo purposes, we'll simulate
    this.logger.info('Creating Ethereum escrow', { swapId: swap.id });

    return {
      escrowId: 'mock_eth_escrow_id',
      hash: swap.hash,
      timelock: swap.timelock
    };
  }

  async handleSwapError(swap, error) {
    swap.status = 'FAILED';
    swap.error = error.message;
    swap.failedAt = Date.now();

    if (swap.attempts < this.config.retryAttempts) {
      // Retry after delay
      setTimeout(() => {
        this.executeCrossChainSwap(swap);
      }, this.config.retryDelayMs * swap.attempts);
    } else {
      // Move to failed swaps
      this.failedSwaps.set(swap.id, swap);
      this.activeSwaps.delete(swap.id);

      this.updateMetrics(swap, false);

      this.logger.error('Swap failed permanently', {
        swapId: swap.id,
        attempts: swap.attempts,
        error: error.message
      });
    }
  }

  async shouldHandleSwap(event) {
    // Check if we're the designated resolver
    // Check if we have sufficient liquidity
    // Check if the swap is profitable
    return true; // Simplified for demo
  }

  isCrossChainOrder(order) {
    return order.customData?.protocol === 'manteia' ||
           order.dstChainId === 'sui';
  }

  generateSwapId(crossChainId) {
    return `swap_${crossChainId}_${Date.now()}`;
  }

  async getSuiCoin(amount) {
    // Get a Sui coin object with sufficient balance
    const coins = await this.suiService.getCoins(this.suiService.address);
    const suitableCoin = coins.find(coin => BigInt(coin.balance) >= BigInt(amount));

    if (!suitableCoin) {
      throw new Error('Insufficient Sui balance for swap');
    }

    return suitableCoin.coinObjectId;
  }

  async getTokenPrice(token, chainId) {
    // Get token price from 1inch or external price oracle
    try {
      const price = await this.oneInchService.getTokenPrice(chainId, [token]);
      return price[token] || 1;
    } catch (error) {
      this.logger.error('Error getting token price:', error);
      return 1; // Fallback price
    }
  }

  updateMetrics(swap, success) {
    this.metrics.totalSwapsProcessed += 1;

    if (success) {
      this.metrics.successfulSwaps += 1;
      this.metrics.totalVolume += parseFloat(swap.amount || 0);

      if (swap.executionTime) {
        this.metrics.averageExecutionTime =
          (this.metrics.averageExecutionTime + swap.executionTime) / 2;
      }
    } else {
      this.metrics.failedSwaps += 1;
    }
  }

  async performHealthCheck() {
    try {
      const suiHealth = await this.suiService.healthCheck();
      const activeSwapsCount = this.activeSwaps.size;

      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        activeSwaps: activeSwapsCount,
        metrics: this.metrics,
        sui: suiHealth
      };

      this.logger.debug('Resolver bot health check', health);
      this.emit('health_check', health);

      return health;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  async cleanupExpiredSwaps() {
    const now = Date.now();
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000;

    for (const [swapId, swap] of this.activeSwaps) {
      if (now - swap.createdAt > timeoutMs) {
        this.logger.warn('Cleaning up expired swap', { swapId });
        await this.cancelSwap(swapId, 'Timeout');
      }
    }
  }

  async cancelSwap(swapId, reason) {
    const swap = this.activeSwaps.get(swapId);
    if (!swap) return;

    try {
      // Cancel any pending operations
      if (swap.suiEscrowId) {
        await this.suiService.cancelEscrow({ escrowId: swap.suiEscrowId });
      }

      swap.status = 'CANCELLED';
      swap.cancelReason = reason;
      swap.cancelledAt = Date.now();

      this.failedSwaps.set(swapId, swap);
      this.activeSwaps.delete(swapId);

      this.logger.info('Swap cancelled', { swapId, reason });
    } catch (error) {
      this.logger.error('Error cancelling swap:', error);
    }
  }

  logMetrics() {
    this.logger.info('Resolver bot metrics', this.metrics);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      enabled: this.enabled,
      activeSwaps: this.activeSwaps.size,
      completedSwaps: this.completedSwaps.size,
      failedSwaps: this.failedSwaps.size,
      metrics: this.metrics,
      config: this.config
    };
  }

  // Admin methods
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Resolver bot config updated', this.config);
  }

  getActiveSwaps() {
    return Array.from(this.activeSwaps.values());
  }

  getCompletedSwaps(limit = 100) {
    return Array.from(this.completedSwaps.values()).slice(-limit);
  }

  getFailedSwaps(limit = 100) {
    return Array.from(this.failedSwaps.values()).slice(-limit);
  }
}