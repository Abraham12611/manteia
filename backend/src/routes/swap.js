import { Router } from 'express';
import Joi from 'joi';
import { swapRateLimiter, quoteRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Validation schemas
const quoteSchema = Joi.object({
  fromTokenAddress: Joi.string().required(),
  toTokenAddress: Joi.string().required(),
  amount: Joi.string().required(),
  fromChain: Joi.string().valid('ethereum', 'sui').required(),
  toChain: Joi.string().valid('ethereum', 'sui').required(),
  slippage: Joi.number().min(0).max(50).default(1), // 1% default slippage
  gasPrice: Joi.string().optional()
});

const swapSchema = Joi.object({
  fromTokenAddress: Joi.string().required(),
  toTokenAddress: Joi.string().required(),
  amount: Joi.string().required(),
  fromChain: Joi.string().valid('ethereum', 'sui').required(),
  toChain: Joi.string().valid('ethereum', 'sui').required(),
  slippage: Joi.number().min(0).max(50).default(1),
  userAddress: Joi.string().required(),
  gasPrice: Joi.string().optional(),
  deadline: Joi.number().optional() // Unix timestamp
});

const fusionOrderSchema = Joi.object({
  srcChainId: Joi.number().required(),
  dstChainId: Joi.string().valid('sui').required(),
  srcTokenAddress: Joi.string().required(),
  dstTokenAddress: Joi.string().required(),
  amount: Joi.string().required(),
  userAddress: Joi.string().required(),
  slippage: Joi.number().min(0).max(50).default(1),
  timelock: Joi.number().optional(),
  secret: Joi.string().optional()
});

// Validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }
    req.validatedData = value;
    next();
  };
}

// Get quote for token swap
router.post('/quote', quoteRateLimiter, validateRequest(quoteSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const { fromTokenAddress, toTokenAddress, amount, fromChain, toChain, slippage } = req.validatedData;

    logger.info('Quote request', { fromChain, toChain, fromTokenAddress, toTokenAddress, amount });

    let quote;

    if (fromChain === toChain) {
      // Same-chain swap
      if (fromChain === 'ethereum') {
        // Use 1inch classic swap
        quote = await services.oneInch.getClassicQuote({
          chainId: 1, // Ethereum mainnet
          src: fromTokenAddress,
          dst: toTokenAddress,
          amount,
          from: '0x0000000000000000000000000000000000000000' // Placeholder
        });

        quote.swapType = 'classic';
        quote.chainType = 'evm';
      } else if (fromChain === 'sui') {
        // Use Cetus for Sui-to-Sui swaps
        // This would require Cetus SDK integration
        quote = {
          fromTokenAddress,
          toTokenAddress,
          fromAmount: amount,
          toAmount: amount, // Placeholder - would calculate using Cetus
          swapType: 'cetus',
          chainType: 'sui',
          priceImpact: '0.01',
          fee: '0.003',
          route: ['direct']
        };
      }
    } else {
      // Cross-chain swap using 1inch Fusion+
      const srcChainId = fromChain === 'ethereum' ? 1 : 'sui';
      const dstChainId = toChain === 'ethereum' ? 1 : 'sui';

      if (fromChain === 'ethereum' && toChain === 'sui') {
        // Ethereum to Sui via Fusion+
        quote = await services.oneInch.getFusionQuote({
          srcChainId,
          dstChainId,
          srcTokenAddress: fromTokenAddress,
          dstTokenAddress: toTokenAddress,
          amount
        });

        quote.swapType = 'fusion_plus';
        quote.chainType = 'cross_chain';
        quote.direction = 'eth_to_sui';
      } else if (fromChain === 'sui' && toChain === 'ethereum') {
        // Sui to Ethereum - custom implementation needed
        quote = {
          fromTokenAddress,
          toTokenAddress,
          fromAmount: amount,
          toAmount: amount, // Would calculate based on current rates
          swapType: 'atomic_swap',
          chainType: 'cross_chain',
          direction: 'sui_to_eth',
          priceImpact: '0.02',
          fee: '0.005',
          estimatedTime: 300, // 5 minutes
          route: ['sui_escrow', 'eth_claim']
        };
      }
    }

    // Add common fields
    quote.slippage = slippage;
    quote.timestamp = new Date().toISOString();
    quote.validUntil = new Date(Date.now() + 60000).toISOString(); // 1 minute validity

    res.json({
      success: true,
      quote,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Quote error:', error);
    res.status(500).json({
      error: 'Failed to get quote',
      message: error.message,
      requestId: req.id
    });
  }
});

// Execute swap
router.post('/execute', swapRateLimiter, validateRequest(swapSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const {
      fromTokenAddress,
      toTokenAddress,
      amount,
      fromChain,
      toChain,
      slippage,
      userAddress
    } = req.validatedData;

    logger.info('Swap execution request', {
      fromChain,
      toChain,
      fromTokenAddress,
      toTokenAddress,
      amount,
      userAddress
    });

    let result;

    if (fromChain === toChain) {
      // Same-chain swap
      if (fromChain === 'ethereum') {
        // Execute 1inch classic swap
        result = await services.oneInch.getClassicSwap({
          chainId: 1,
          src: fromTokenAddress,
          dst: toTokenAddress,
          amount,
          from: userAddress,
          slippage
        });

        result.swapType = 'classic';
        result.status = 'ready_to_sign';
      } else if (fromChain === 'sui') {
        // Execute Cetus swap on Sui
        // This would create a transaction payload for Sui
        result = {
          swapType: 'cetus',
          status: 'ready_to_sign',
          transactionData: {
            // Sui transaction payload would go here
            // Built using Cetus SDK
          }
        };
      }
    } else {
      // Cross-chain swap
      if (fromChain === 'ethereum' && toChain === 'sui') {
        // Create Fusion+ order
        const secret = services.sui.generateSecret();
        const hash = services.sui.generateHash(secret);
        const crossChainId = services.sui.generateCrossChainId(
          userAddress, // Ethereum address
          userAddress, // Sui address (assuming same user)
          amount,
          Date.now()
        );

        result = await services.oneInch.createFusionOrder({
          srcChainId: 1,
          dstChainId: 'sui',
          srcTokenAddress: fromTokenAddress,
          dstTokenAddress: toTokenAddress,
          amount,
          userAddress,
          hashLock: hash,
          timelock: Math.floor(Date.now() / 1000) + 3600, // 1 hour
          crossChainId
        });

        result.swapType = 'fusion_plus';
        result.secret = secret;
        result.crossChainId = crossChainId;
        result.status = 'order_created';
      } else if (fromChain === 'sui' && toChain === 'ethereum') {
        // Create Sui escrow for atomic swap
        const secret = services.sui.generateSecret();
        const hash = services.sui.generateHash(secret);
        const crossChainId = services.sui.generateCrossChainId(
          userAddress, // Ethereum destination
          userAddress, // Sui sender
          amount,
          Date.now()
        );

        // This would create a Sui escrow transaction
        result = {
          swapType: 'atomic_swap',
          secret,
          hash,
          crossChainId,
          status: 'escrow_ready',
          suiTransaction: {
            // Sui escrow creation transaction payload
          },
          estimatedTime: 300 // 5 minutes
        };
      }
    }

    // Add common fields
    result.requestId = req.id;
    result.timestamp = new Date().toISOString();
    result.userAddress = userAddress;

    res.json({
      success: true,
      result,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Swap execution error:', error);
    res.status(500).json({
      error: 'Failed to execute swap',
      message: error.message,
      requestId: req.id
    });
  }
});

// Create Fusion+ cross-chain order
router.post('/fusion-order', swapRateLimiter, validateRequest(fusionOrderSchema), async (req, res) => {
  try {
    const { services, logger } = req;
    const orderData = req.validatedData;

    logger.info('Fusion+ order creation', orderData);

    // Generate atomic swap parameters if not provided
    if (!orderData.secret) {
      orderData.secret = services.sui.generateSecret();
    }

    const hash = services.sui.generateHash(orderData.secret);
    const crossChainId = services.sui.generateCrossChainId(
      orderData.userAddress,
      orderData.userAddress, // Assuming same user on both chains
      orderData.amount,
      Date.now()
    );

    // Create 1inch Fusion+ order
    const order = await services.oneInch.createFusionOrder({
      ...orderData,
      hashLock: hash,
      timelock: orderData.timelock || Math.floor(Date.now() / 1000) + 3600,
      crossChainId
    });

    // Store order details for tracking
    const orderInfo = {
      orderId: order.orderId,
      secret: orderData.secret,
      hash,
      crossChainId,
      status: 'created',
      createdAt: new Date().toISOString(),
      userAddress: orderData.userAddress
    };

    res.json({
      success: true,
      order: orderInfo,
      oneInchOrder: order,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Fusion+ order creation error:', error);
    res.status(500).json({
      error: 'Failed to create Fusion+ order',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get swap status
router.get('/status/:transactionId', async (req, res) => {
  try {
    const { services, logger } = req;
    const { transactionId } = req.params;

    logger.info('Swap status request', { transactionId });

    // Try to get status from different sources
    let status = null;

    // Check 1inch Fusion+ order status
    try {
      status = await services.oneInch.getFusionOrderStatus(transactionId);
      status.source = 'fusion_plus';
    } catch (error) {
      // Not a Fusion+ order, try other sources
    }

    // Check Sui transaction status
    if (!status) {
      try {
        // Check if it's a Sui transaction
        const txResult = await services.sui.client.getTransactionBlock({
          digest: transactionId,
          options: { showEffects: true, showEvents: true }
        });

        status = {
          status: txResult.effects?.status?.status || 'unknown',
          source: 'sui',
          effects: txResult.effects,
          events: txResult.events
        };
      } catch (error) {
        // Not a Sui transaction
      }
    }

    if (!status) {
      return res.status(404).json({
        error: 'Transaction not found',
        transactionId,
        requestId: req.id
      });
    }

    res.json({
      success: true,
      transactionId,
      status,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to get swap status',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get supported tokens
router.get('/tokens/:chain', async (req, res) => {
  try {
    const { services, logger } = req;
    const { chain } = req.params;

    logger.info('Tokens request', { chain });

    let tokens = [];

    if (chain === 'ethereum') {
      // Get tokens from 1inch
      const chainId = 1; // Ethereum mainnet
      tokens = await services.oneInch.getTokens(chainId);
    } else if (chain === 'sui') {
      // Get Sui tokens - this would need to be implemented
      // For now, return some common Sui tokens
      tokens = {
        '0x2::sui::SUI': {
          symbol: 'SUI',
          name: 'Sui',
          decimals: 9,
          logoURI: ''
        },
        // Add more Sui tokens as they become available
      };
    } else {
      return res.status(400).json({
        error: 'Unsupported chain',
        supportedChains: ['ethereum', 'sui'],
        requestId: req.id
      });
    }

    res.json({
      success: true,
      chain,
      tokens,
      count: Object.keys(tokens).length,
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Tokens fetch error:', error);
    res.status(500).json({
      error: 'Failed to get tokens',
      message: error.message,
      requestId: req.id
    });
  }
});

// Get token prices
router.get('/prices/:chain', async (req, res) => {
  try {
    const { services, logger } = req;
    const { chain } = req.params;
    const { tokens } = req.query; // Comma-separated token addresses

    if (!tokens) {
      return res.status(400).json({
        error: 'Missing tokens parameter',
        requestId: req.id
      });
    }

    const tokenAddresses = tokens.split(',');
    logger.info('Price request', { chain, tokens: tokenAddresses });

    let prices = {};

    if (chain === 'ethereum') {
      const chainId = 1;
      prices = await services.oneInch.getTokenPrice(chainId, tokenAddresses);
    } else if (chain === 'sui') {
      // Sui price fetching would need to be implemented
      // For now, return placeholder prices
      prices = tokenAddresses.reduce((acc, token) => {
        acc[token] = '1.00'; // Placeholder
        return acc;
      }, {});
    }

    res.json({
      success: true,
      chain,
      prices,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });

  } catch (error) {
    req.logger.error('Price fetch error:', error);
    res.status(500).json({
      error: 'Failed to get prices',
      message: error.message,
      requestId: req.id
    });
  }
});

export default router;