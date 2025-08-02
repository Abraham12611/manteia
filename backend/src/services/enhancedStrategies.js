import { ethers } from 'ethers';
import { PredicateBuilder } from './limitOrderService.js';

// Enhanced TWAP Strategy with Slippage Protection
export class EnhancedTWAPStrategy {
  constructor(params) {
    this.params = params;
    this.predicateBuilder = new PredicateBuilder();
    this.abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // Enhanced TWAP parameters
    this.totalAmount = params.totalAmount;
    this.intervals = params.intervals;
    this.duration = params.duration;
    this.slippageProtection = params.slippageProtection || {
      maxSlippage: 0.01, // 1% default
      priceImpactThreshold: 0.005, // 0.5% default
      emergencyStop: true
    };
    this.dynamicAdjustment = params.dynamicAdjustment || {
      enabled: true,
      marketConditionThreshold: 0.02, // 2% volatility threshold
      intervalAdjustmentFactor: 0.5 // Reduce intervals by 50% in high volatility
    };
    this.partialFillHandling = params.partialFillHandling || {
      enabled: true,
      merkleTreeSecrets: true, // Use 1inch's Merkle tree approach
      retryFailedIntervals: true
    };
  }

  async execute(limitOrderService) {
    const orders = [];
    const secrets = [];

    // Calculate dynamic intervals based on market conditions
    const adjustedIntervals = await this.calculateDynamicIntervals();
    const amountPerInterval = Math.floor(this.totalAmount / adjustedIntervals);
    const intervalDuration = Math.floor(this.duration / adjustedIntervals);

    // Generate Merkle tree secrets for partial fills (following 1inch approach)
    if (this.partialFillHandling.merkleTreeSecrets) {
      for (let i = 0; i < adjustedIntervals; i++) {
        const secret = ethers.randomBytes(32);
        const secretHash = ethers.keccak256(secret);
        secrets.push({
          index: i,
          secret: secret,
          secretHash: secretHash,
          fillRange: {
            start: i / adjustedIntervals,
            end: (i + 1) / adjustedIntervals
          }
        });
      }
    }

    for (let i = 0; i < adjustedIntervals; i++) {
      const startTime = Date.now() + (i * intervalDuration * 1000);
      const endTime = startTime + (intervalDuration * 1000);

      // Create enhanced predicate with slippage protection
      const timePredicate = this.predicateBuilder.createTimePredicate(startTime, endTime);
      const slippagePredicate = this.createSlippageProtectionPredicate();
      const priceImpactPredicate = this.createPriceImpactPredicate();

      // Combine predicates with AND logic
      const compoundPredicate = this.predicateBuilder.createCompoundPredicate([
        { predicate: timePredicate, operator: 0 },
        { predicate: slippagePredicate, operator: 0 },
        { predicate: priceImpactPredicate, operator: 0 }
      ]);

      // Create interaction data for partial fill handling
      const interaction = this.createPartialFillInteraction(i, secrets[i]);

      const order = await limitOrderService.createLimitOrder({
        chainId: this.params.chainId,
        makerAsset: this.params.makerAsset,
        takerAsset: this.params.takerAsset,
        makingAmount: amountPerInterval.toString(),
        takingAmount: '0', // Market will determine
        maker: this.params.maker,
        predicate: compoundPredicate,
        interaction,
        salt: ethers.randomBytes(32)
      });

      orders.push({
        ...order,
        interval: i,
        secret: secrets[i],
        fillRange: secrets[i]?.fillRange
      });
    }

    return {
      orders,
      strategy: 'enhanced_twap',
      secrets,
      merkleRoot: this.calculateMerkleRoot(secrets),
      dynamicIntervals: adjustedIntervals
    };
  }

  async calculateDynamicIntervals() {
    if (!this.dynamicAdjustment.enabled) {
      return this.intervals;
    }

    try {
      // Get market volatility (this would integrate with price feeds)
      const volatility = await this.getMarketVolatility();

      if (volatility > this.dynamicAdjustment.marketConditionThreshold) {
        // Reduce intervals in high volatility
        return Math.max(2, Math.floor(this.intervals * this.dynamicAdjustment.intervalAdjustmentFactor));
      }

      return this.intervals;
    } catch (error) {
      // Fallback to original intervals
      return this.intervals;
    }
  }

  async getMarketVolatility() {
    // This would integrate with price feeds to calculate volatility
    // For now, return a mock value
    return 0.015; // 1.5% volatility
  }

  createSlippageProtectionPredicate() {
    return this.predicateBuilder.createPricePredicate(
      this.params.takerAsset,
      this.slippageProtection.maxSlippage,
      'call',
      Date.now() + this.duration * 1000
    );
  }

  createPriceImpactPredicate() {
    return this.predicateBuilder.createVolumePredicate(
      this.params.makerAsset,
      this.slippageProtection.priceImpactThreshold,
      this.slippageProtection.priceImpactThreshold * 2,
      this.duration
    );
  }

  createPartialFillInteraction(intervalIndex, secret) {
    if (!this.partialFillHandling.enabled) return '0x';

    return this.abiCoder.encode(
      ['uint256', 'bytes32', 'uint256', 'uint256'],
      [
        intervalIndex,
        secret.secretHash,
        secret.fillRange.start * 10000, // Convert to basis points
        secret.fillRange.end * 10000
      ]
    );
  }

  calculateMerkleRoot(secrets) {
    if (!secrets || secrets.length === 0) return ethers.ZeroHash;

    // Simple Merkle tree calculation
    let hashes = secrets.map(s => s.secretHash);

    while (hashes.length > 1) {
      const newHashes = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = i + 1 < hashes.length ? hashes[i + 1] : left;
        const combined = ethers.concat([left, right]);
        newHashes.push(ethers.keccak256(combined));
      }
      hashes = newHashes;
    }

    return hashes[0];
  }
}

// Barrier Options Strategy (Knock-in/Knock-out)
export class BarrierOptionsStrategy {
  constructor(params) {
    this.params = params;
    this.predicateBuilder = new PredicateBuilder();
    this.abiCoder = ethers.AbiCoder.defaultAbiCoder();

    this.barrierType = params.barrierType; // 'knock-in', 'knock-out'
    this.barrierLevel = params.barrierLevel;
    this.strikePrice = params.strikePrice;
    this.expiry = params.expiry;
    this.optionType = params.optionType; // 'call', 'put'
    this.monitoring = params.monitoring || {
      frequency: 300, // 5 minutes
      continuous: true
    };
  }

  async execute(limitOrderService) {
    const orders = [];

    // Create barrier monitoring predicate
    const barrierPredicate = this.createBarrierPredicate();

    // Create option execution predicate
    const optionPredicate = this.createOptionPredicate();

    // Combine predicates based on barrier type
    let finalPredicate;
    if (this.barrierType === 'knock-in') {
      // For knock-in: barrier must be hit AND option conditions must be met
      finalPredicate = this.predicateBuilder.createCompoundPredicate([
        { predicate: barrierPredicate, operator: 0 },
        { predicate: optionPredicate, operator: 0 }
      ], 'AND');
    } else {
      // For knock-out: barrier must NOT be hit AND option conditions must be met
      finalPredicate = this.predicateBuilder.createCompoundPredicate([
        { predicate: barrierPredicate, operator: 1 }, // NOT barrier
        { predicate: optionPredicate, operator: 0 }
      ], 'AND');
    }

    // Create interaction for barrier monitoring
    const interaction = this.createBarrierInteraction();

    const order = await limitOrderService.createLimitOrder({
      chainId: this.params.chainId,
      makerAsset: this.params.makerAsset,
      takerAsset: this.params.takerAsset,
      makingAmount: this.params.amount,
      takingAmount: this.strikePrice.toString(),
      maker: this.params.maker,
      predicate: finalPredicate,
      interaction,
      salt: ethers.randomBytes(32)
    });

    orders.push({
      ...order,
      barrierType: this.barrierType,
      barrierLevel: this.barrierLevel,
      strikePrice: this.strikePrice,
      optionType: this.optionType
    });

    return {
      orders,
      strategy: 'barrier_options',
      barrierType: this.barrierType,
      barrierLevel: this.barrierLevel
    };
  }

  createBarrierPredicate() {
    // Create predicate that monitors barrier level
    return this.abiCoder.encode(
      ['address', 'uint256', 'uint256', 'uint8'],
      [
        this.params.underlying,
        this.barrierLevel,
        this.monitoring.frequency,
        this.barrierType === 'knock-in' ? 1 : 0
      ]
    );
  }

  createOptionPredicate() {
    return this.predicateBuilder.createPricePredicate(
      this.params.underlying,
      this.strikePrice,
      this.optionType,
      this.expiry
    );
  }

  createBarrierInteraction() {
    return this.abiCoder.encode(
      ['uint256', 'uint256', 'uint8', 'uint256'],
      [
        this.barrierLevel,
        this.strikePrice,
        this.optionType === 'call' ? 1 : 0,
        this.monitoring.frequency
      ]
    );
  }
}

// Dynamic Delta Hedging Strategy
export class DynamicDeltaHedgingStrategy {
  constructor(params) {
    this.params = params;
    this.predicateBuilder = new PredicateBuilder();
    this.abiCoder = ethers.AbiCoder.defaultAbiCoder();

    this.optionPosition = params.optionPosition;
    this.deltaTarget = params.deltaTarget || 0; // Target delta (0 = delta-neutral)
    this.rebalanceThreshold = params.rebalanceThreshold || 0.1; // 10% delta change
    this.hedgingAsset = params.hedgingAsset;
    this.monitoring = params.monitoring || {
      frequency: 60, // 1 minute
      maxRebalances: 10
    };
  }

  async execute(limitOrderService) {
    const orders = [];

    // Calculate initial delta
    const initialDelta = await this.calculateOptionDelta();
    const requiredHedge = this.calculateRequiredHedge(initialDelta);

    if (Math.abs(requiredHedge) > this.rebalanceThreshold) {
      // Create hedging order
      const hedgePredicate = this.createDeltaHedgePredicate();
      const hedgeInteraction = this.createDeltaHedgeInteraction(requiredHedge);

      const hedgeOrder = await limitOrderService.createLimitOrder({
        chainId: this.params.chainId,
        makerAsset: this.params.makerAsset,
        takerAsset: this.hedgingAsset,
        makingAmount: Math.abs(requiredHedge).toString(),
        takingAmount: '0',
        maker: this.params.maker,
        predicate: hedgePredicate,
        interaction: hedgeInteraction,
        salt: ethers.randomBytes(32)
      });

      orders.push({
        ...hedgeOrder,
        type: 'delta_hedge',
        delta: initialDelta,
        hedgeAmount: requiredHedge
      });
    }

    // Create monitoring order for future rebalancing
    const monitorPredicate = this.createDeltaMonitorPredicate();
    const monitorInteraction = this.createDeltaMonitorInteraction();

    const monitorOrder = await limitOrderService.createLimitOrder({
      chainId: this.params.chainId,
      makerAsset: this.params.makerAsset,
      takerAsset: this.hedgingAsset,
      makingAmount: '0', // Will be calculated dynamically
      takingAmount: '0',
      maker: this.params.maker,
      predicate: monitorPredicate,
      interaction: monitorInteraction,
      salt: ethers.randomBytes(32)
    });

    orders.push({
      ...monitorOrder,
      type: 'delta_monitor',
      targetDelta: this.deltaTarget
    });

    return {
      orders,
      strategy: 'dynamic_delta_hedging',
      initialDelta,
      targetDelta: this.deltaTarget,
      rebalanceThreshold: this.rebalanceThreshold
    };
  }

  async calculateOptionDelta() {
    // This would integrate with options pricing models
    // For now, return a mock delta
    return 0.6; // 60% delta
  }

  calculateRequiredHedge(currentDelta) {
    const deltaDifference = currentDelta - this.deltaTarget;
    return -deltaDifference; // Negative because we hedge opposite to delta
  }

  createDeltaHedgePredicate() {
    return this.predicateBuilder.createPricePredicate(
      this.params.underlying,
      this.params.strikePrice,
      this.params.optionType,
      Date.now() + 86400 * 1000 // 24 hours
    );
  }

  createDeltaHedgeInteraction(hedgeAmount) {
    return this.abiCoder.encode(
      ['uint256', 'uint256', 'uint8'],
      [
        hedgeAmount,
        this.rebalanceThreshold,
        this.params.optionType === 'call' ? 1 : 0
      ]
    );
  }

  createDeltaMonitorPredicate() {
    return this.predicateBuilder.createVolumePredicate(
      this.params.underlying,
      this.rebalanceThreshold,
      this.rebalanceThreshold * 2,
      this.monitoring.frequency
    );
  }

  createDeltaMonitorInteraction() {
    return this.abiCoder.encode(
      ['uint256', 'uint256', 'uint256'],
      [
        this.deltaTarget,
        this.rebalanceThreshold,
        this.monitoring.maxRebalances
      ]
    );
  }
}

// Custom Strategy Builder
export class CustomStrategyBuilder {
  constructor() {
    this.predicateBuilder = new PredicateBuilder();
    this.abiCoder = ethers.AbiCoder.defaultAbiCoder();
  }

  buildStrategy(config) {
    const predicates = [];
    const interactions = [];

    // Build predicates based on configuration
    if (config.timeConditions) {
      predicates.push(this.buildTimePredicates(config.timeConditions));
    }

    if (config.priceConditions) {
      predicates.push(this.buildPricePredicates(config.priceConditions));
    }

    if (config.volumeConditions) {
      predicates.push(this.buildVolumePredicates(config.volumeConditions));
    }

    if (config.customConditions) {
      predicates.push(this.buildCustomPredicates(config.customConditions));
    }

    // Build interactions
    if (config.actions) {
      interactions.push(this.buildActions(config.actions));
    }

    return {
      predicates,
      interactions,
      logic: config.logic || 'AND',
      metadata: config.metadata || {}
    };
  }

  buildTimePredicates(conditions) {
    const predicates = [];

    for (const condition of conditions) {
      const predicate = this.predicateBuilder.createTimePredicate(
        condition.startTime,
        condition.endTime
      );
      predicates.push({ predicate, operator: condition.operator || 0 });
    }

    return predicates;
  }

  buildPricePredicates(conditions) {
    const predicates = [];

    for (const condition of conditions) {
      const predicate = this.predicateBuilder.createPricePredicate(
        condition.token,
        condition.strikePrice,
        condition.optionType,
        condition.expiry
      );
      predicates.push({ predicate, operator: condition.operator || 0 });
    }

    return predicates;
  }

  buildVolumePredicates(conditions) {
    const predicates = [];

    for (const condition of conditions) {
      const predicate = this.predicateBuilder.createVolumePredicate(
        condition.token,
        condition.minVolume,
        condition.maxVolume,
        condition.timeframe
      );
      predicates.push({ predicate, operator: condition.operator || 0 });
    }

    return predicates;
  }

  buildCustomPredicates(conditions) {
    const predicates = [];

    for (const condition of conditions) {
      const predicate = this.predicateBuilder.createCustomLogicPredicate(
        condition.conditions,
        condition.customLogic
      );
      predicates.push({ predicate, operator: condition.operator || 0 });
    }

    return predicates;
  }

  buildActions(actions) {
    const encodedActions = [];

    for (const action of actions) {
      const encodedAction = this.abiCoder.encode(
        ['uint8', 'bytes'],
        [action.type, action.data]
      );
      encodedActions.push(encodedAction);
    }

    return this.abiCoder.encode(['bytes[]'], [encodedActions]);
  }
}