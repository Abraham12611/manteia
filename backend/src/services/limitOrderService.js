import { ethers } from 'ethers';
import axios from 'axios';
import {
  EnhancedTWAPStrategy,
  BarrierOptionsStrategy,
  DynamicDeltaHedgingStrategy,
  CustomStrategyBuilder
} from './enhancedStrategies.js';

// Enhanced predicate types for advanced strategies
export class PredicateBuilder {
  constructor() {
    this.abiCoder = ethers.AbiCoder.defaultAbiCoder();
  }

  // Time-based predicates (already implemented, enhanced)
  createTimePredicate(startTime, endTime) {
    return this.abiCoder.encode(
      ['uint256', 'uint256'],
      [startTime, endTime]
    );
  }

  // Price-based predicates (already implemented, enhanced)
  createPricePredicate(token, strikePrice, optionType, expiry) {
    return this.abiCoder.encode(
      ['address', 'uint256', 'uint8', 'uint256'],
      [token, strikePrice, optionType === 'call' ? 1 : 0, expiry]
    );
  }

  // NEW: Volume-based predicates
  createVolumePredicate(token, minVolume, maxVolume, timeframe) {
    return this.abiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [token, minVolume, maxVolume, timeframe]
    );
  }

  // NEW: Compound predicates (combining multiple conditions)
  createCompoundPredicate(predicates, logicOperator = 'AND') {
    const encodedPredicates = predicates.map(p => p.predicate);
    const operators = predicates.map(p => p.operator || 0); // 0 = AND, 1 = OR

    return this.abiCoder.encode(
      ['bytes[]', 'uint8[]', 'uint8'],
      [encodedPredicates, operators, logicOperator === 'AND' ? 0 : 1]
    );
  }

  // NEW: Custom logic predicates
  createCustomLogicPredicate(conditions, customLogic) {
    return this.abiCoder.encode(
      ['bytes', 'bytes'],
      [conditions, customLogic]
    );
  }

  // NEW: Range-based predicates for concentrated liquidity
  createRangePredicate(token, lowerPrice, upperPrice, rebalanceThreshold) {
    return this.abiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint256'],
      [token, lowerPrice, upperPrice, rebalanceThreshold]
    );
  }
}

// Advanced strategy base class
export class AdvancedStrategy {
  constructor(params) {
    this.type = params.type; // 'twap', 'options', 'concentrated', 'custom'
    this.conditions = params.conditions;
    this.execution = params.execution;
    this.monitoring = params.monitoring;
    this.riskManagement = params.riskManagement;
  }

  async execute() {
    throw new Error('execute() must be implemented by subclass');
  }

  async monitor() {
    throw new Error('monitor() must be implemented by subclass');
  }

  async adjust() {
    throw new Error('adjust() must be implemented by subclass');
  }

  async cancel() {
    throw new Error('cancel() must be implemented by subclass');
  }
}

// Concentrated liquidity strategy implementation
export class ConcentratedLiquidityStrategy extends AdvancedStrategy {
  constructor(params, limitOrderService) {
    super({
      type: 'concentrated',
      ...params
    });

    this.priceRange = params.priceRange;
    this.liquidityDistribution = params.liquidityDistribution;
    this.rebalanceThreshold = params.rebalanceThreshold;
    this.impermanentLossProtection = params.impermanentLossProtection;
    this.limitOrderService = limitOrderService;
  }

  async execute() {
    // Create multiple limit orders across price ranges
    const orders = [];

    for (const range of this.priceRange.ranges) {
      const predicate = new PredicateBuilder().createRangePredicate(
        this.conditions.makerAsset, // Use makerAsset instead of token
        range.lowerPrice,
        range.upperPrice,
        this.rebalanceThreshold
      );

      const order = await this.limitOrderService.createLimitOrder({
        chainId: this.execution.chainId,
        makerAsset: this.conditions.makerAsset,
        takerAsset: this.conditions.takerAsset,
        makingAmount: range.liquidityAmount,
        takingAmount: '0', // Market will determine
        maker: this.execution.maker,
        predicate,
        interaction: this.createRebalanceInteraction(range)
      });

      orders.push(order);
    }

    return { orders, strategy: 'concentrated_liquidity' };
  }

  createRebalanceInteraction(range) {
    // Interaction data for automatic rebalancing
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [range.lowerPrice, range.upperPrice, this.rebalanceThreshold]
    );
  }

  async monitor() {
    // Monitor price movements and liquidity distribution
    // Trigger rebalancing when thresholds are met
  }

  async adjust() {
    // Adjust liquidity distribution based on market conditions
  }
}





// Main Limit Order Service
export class LimitOrderService {
  constructor({ apiKey, baseUrl, logger, oneInchService }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.logger = logger;
    this.oneInchService = oneInchService;
    this.predicateBuilder = new PredicateBuilder();

    // Strategy registry
    this.strategies = new Map();
    this.activeOrders = new Map();
  }

  // Register a new strategy
  registerStrategy(strategyId, strategy) {
    this.strategies.set(strategyId, strategy);
    this.logger.info('Strategy registered', { strategyId, type: strategy.type });
  }

  // Create concentrated liquidity order
  async createConcentratedLiquidityOrder(params) {
    try {
      // Map params to strategy format
      const strategyParams = {
        conditions: {
          makerAsset: params.makerAsset,
          takerAsset: params.takerAsset
        },
        execution: {
          chainId: params.chainId,
          maker: params.maker
        },
        priceRange: params.priceRange,
        rebalanceThreshold: params.rebalanceThreshold,
        impermanentLossProtection: params.impermanentLossProtection
      };

      const strategy = new ConcentratedLiquidityStrategy(strategyParams, this);
      const result = await strategy.execute();

      // Store strategy for monitoring
      this.registerStrategy(result.orders[0].orderHash, strategy);

      this.logger.info('Concentrated liquidity order created', {
        orderCount: result.orders.length,
        priceRanges: params.priceRange.ranges.length
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating concentrated liquidity order:', error);
      throw new Error(`Failed to create concentrated liquidity order: ${error.message}`);
    }
  }

    // Create multi-leg options order (placeholder for future implementation)
  async createMultiLegOptionsOrder(params) {
    try {
      this.logger.info('Multi-leg options order requested (not implemented in Phase 2)', {
        params
      });

      throw new Error('Multi-leg options not implemented in Phase 2. Use barrier options instead.');
    } catch (error) {
      this.logger.error('Error creating multi-leg options order:', error);
      throw new Error(`Failed to create multi-leg options order: ${error.message}`);
    }
  }

    // Create enhanced TWAP order with slippage protection
  async createEnhancedTWAPOrder(params) {
    try {
      const strategy = new EnhancedTWAPStrategy(params);
      const result = await strategy.execute(this);

      // Store strategy for monitoring
      this.registerStrategy(result.orders[0].orderHash, strategy);

      this.logger.info('Enhanced TWAP order created', {
        orderCount: result.orders.length,
        dynamicIntervals: result.dynamicIntervals,
        merkleRoot: result.merkleRoot
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating enhanced TWAP order:', error);
      throw new Error(`Failed to create enhanced TWAP order: ${error.message}`);
    }
  }

  // Create barrier options order
  async createBarrierOptionsOrder(params) {
    try {
      const strategy = new BarrierOptionsStrategy(params);
      const result = await strategy.execute(this);

      // Store strategy for monitoring
      this.registerStrategy(result.orders[0].orderHash, strategy);

      this.logger.info('Barrier options order created', {
        barrierType: result.barrierType,
        barrierLevel: result.barrierLevel,
        orderCount: result.orders.length
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating barrier options order:', error);
      throw new Error(`Failed to create barrier options order: ${error.message}`);
    }
  }

  // Create dynamic delta hedging order
  async createDynamicDeltaHedgingOrder(params) {
    try {
      const strategy = new DynamicDeltaHedgingStrategy(params);
      const result = await strategy.execute(this);

      // Store strategy for monitoring
      this.registerStrategy(result.orders[0].orderHash, strategy);

      this.logger.info('Dynamic delta hedging order created', {
        initialDelta: result.initialDelta,
        targetDelta: result.targetDelta,
        orderCount: result.orders.length
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating dynamic delta hedging order:', error);
      throw new Error(`Failed to create dynamic delta hedging order: ${error.message}`);
    }
  }

  // Create custom strategy order using builder
  async createCustomStrategyOrder(params) {
    try {
      const builder = new CustomStrategyBuilder();
      const strategyConfig = builder.buildStrategy(params.config);

      // Create order with custom predicates and interactions
      const order = await this.createLimitOrder({
        chainId: params.chainId,
        makerAsset: params.makerAsset,
        takerAsset: params.takerAsset,
        makingAmount: params.amount,
        takingAmount: '0',
        maker: params.maker,
        predicate: strategyConfig.predicates[0]?.predicate || '0x',
        interaction: strategyConfig.interactions[0] || '0x',
        salt: ethers.randomBytes(32)
      });

      const result = {
        orderHash: order.orderHash,
        strategy: 'custom',
        config: strategyConfig,
        metadata: params.metadata
      };

      this.registerStrategy(result.orderHash, { type: 'custom', config: strategyConfig });

      this.logger.info('Custom strategy order created', {
        type: params.type,
        orderHash: result.orderHash
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating custom strategy order:', error);
      throw new Error(`Failed to create custom strategy order: ${error.message}`);
    }
  }

  // Monitor order status
  async monitorOrder(orderHash) {
    try {
      const strategy = this.strategies.get(orderHash);
      if (!strategy) {
        throw new Error('Strategy not found for order hash');
      }

      await strategy.monitor();

      this.logger.info('Order monitoring completed', { orderHash });
      return { status: 'monitored', orderHash };
    } catch (error) {
      this.logger.error('Error monitoring order:', error);
      throw new Error(`Failed to monitor order: ${error.message}`);
    }
  }

  // Adjust strategy parameters
  async adjustStrategy(strategyId, adjustments) {
    try {
      const strategy = this.strategies.get(strategyId);
      if (!strategy) {
        throw new Error('Strategy not found');
      }

      // Apply adjustments
      Object.assign(strategy, adjustments);

      // Execute adjustment
      await strategy.adjust();

      this.logger.info('Strategy adjusted', { strategyId, adjustments });
      return { status: 'adjusted', strategyId };
    } catch (error) {
      this.logger.error('Error adjusting strategy:', error);
      throw new Error(`Failed to adjust strategy: ${error.message}`);
    }
  }

  // Cancel order
  async cancelOrder(orderHash) {
    try {
      const strategy = this.strategies.get(orderHash);
      if (!strategy) {
        throw new Error('Strategy not found for order hash');
      }

      await strategy.cancel();

      // Remove from active orders
      this.strategies.delete(orderHash);

      this.logger.info('Order cancelled', { orderHash });
      return { status: 'cancelled', orderHash };
    } catch (error) {
      this.logger.error('Error cancelling order:', error);
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  // Get active strategies
  getActiveStrategies() {
    return Array.from(this.strategies.entries()).map(([id, strategy]) => ({
      id,
      type: strategy.type,
      status: 'active'
    }));
  }

  // Helper method to create limit order using existing service
  async createLimitOrder(params) {
    return this.oneInchService.createLimitOrder(params);
  }
}