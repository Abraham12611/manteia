const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const tradingService = require('../services/tradingService');
const databaseService = require('../config/database');

const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                details: errors.array()
            }
        });
    }
    next();
};

// Get user wallet from request (for now, we'll use a simple approach)
const getUserId = async (walletAddress) => {
    try {
        const pool = databaseService.getPool();
        const result = await pool.query(
            'SELECT id FROM users WHERE wallet_address = $1',
            [walletAddress]
        );

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        return result.rows[0].id;
    } catch (error) {
        logger.error('Failed to get user ID:', error);
        throw error;
    }
};

// Place an order
router.post('/orders', [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('marketId').notEmpty().withMessage('Market ID is required'),
    body('outcome').isBoolean().withMessage('Outcome must be true (YES) or false (NO)'),
    body('price').isFloat({ min: 0.01, max: 0.99 }).withMessage('Price must be between 0.01 and 0.99'),
    body('size').isFloat({ min: 0.01 }).withMessage('Size must be at least 0.01'),
    body('orderType').isIn(['market', 'limit']).withMessage('Order type must be "market" or "limit"'),
    validateRequest
], async (req, res) => {
    try {
        const { walletAddress, marketId, outcome, price, size, orderType } = req.body;

        // Get user ID
        const userId = await getUserId(walletAddress);

        // Place the order
        const result = await tradingService.placeOrder(
            userId,
            marketId,
            outcome,
            parseFloat(price),
            parseFloat(size),
            orderType
        );

        logger.info('Order placed successfully', {
            userId,
            marketId,
            outcome,
            price,
            size,
            orderType,
            orderId: result.orderId
        });

        res.json({
            success: true,
            data: {
                orderId: result.orderId,
                totalMatched: result.totalMatched,
                remainingSize: result.remainingSize,
                avgExecutionPrice: result.avgExecutionPrice,
                message: result.message
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to place order:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'ORDER_PLACEMENT_ERROR',
                message: 'Failed to place order',
                details: error.message
            }
        });
    }
});

// Get order book for a market
router.get('/markets/:marketId/orderbook', [
    param('marketId').notEmpty().withMessage('Market ID is required'),
    validateRequest
], async (req, res) => {
    try {
        const { marketId } = req.params;

        const orderBook = tradingService.getOrderBook(marketId);

        // Format order book for frontend
        const formatOrders = (orders) => {
            return orders.map(order => ({
                price: order.price,
                size: order.remainingSize,
                total: order.price * order.remainingSize
            }));
        };

        const formattedOrderBook = {
            bids: formatOrders(orderBook.yes).sort((a, b) => b.price - a.price),
            asks: formatOrders(orderBook.no).map(order => ({
                price: 1 - order.price,
                size: order.size,
                total: (1 - order.price) * order.size
            })).sort((a, b) => a.price - b.price)
        };

        res.json({
            success: true,
            data: {
                marketId,
                orderBook: formattedOrderBook,
                bestBid: tradingService.getBestBid(orderBook),
                bestAsk: tradingService.getBestAsk(orderBook),
                spread: tradingService.getBestAsk(orderBook) - tradingService.getBestBid(orderBook),
                midPrice: await tradingService.getMarketPrice(marketId)
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get order book:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'ORDER_BOOK_ERROR',
                message: 'Failed to get order book',
                details: error.message
            }
        });
    }
});

// Get market price
router.get('/markets/:marketId/price', [
    param('marketId').notEmpty().withMessage('Market ID is required'),
    validateRequest
], async (req, res) => {
    try {
        const { marketId } = req.params;

        const price = await tradingService.getMarketPrice(marketId);
        const orderBook = tradingService.getOrderBook(marketId);

        res.json({
            success: true,
            data: {
                marketId,
                price,
                yesPrice: price,
                noPrice: 1 - price,
                bestBid: tradingService.getBestBid(orderBook),
                bestAsk: tradingService.getBestAsk(orderBook),
                spread: tradingService.getBestAsk(orderBook) - tradingService.getBestBid(orderBook)
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get market price:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKET_PRICE_ERROR',
                message: 'Failed to get market price',
                details: error.message
            }
        });
    }
});

// Get user positions
router.get('/users/:walletAddress/positions', [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    query('marketId').optional().notEmpty().withMessage('Market ID cannot be empty'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
], async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { marketId, limit = 50 } = req.query;

        const userId = await getUserId(walletAddress);
        const positions = await tradingService.getUserPositions(userId, marketId);

        res.json({
            success: true,
            data: {
                positions: positions.slice(0, parseInt(limit)),
                total: positions.length,
                walletAddress
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get user positions:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'USER_POSITIONS_ERROR',
                message: 'Failed to get user positions',
                details: error.message
            }
        });
    }
});

// Get user order history
router.get('/users/:walletAddress/orders', [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    query('marketId').optional().notEmpty().withMessage('Market ID cannot be empty'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
], async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { marketId, limit = 50 } = req.query;

        const userId = await getUserId(walletAddress);
        const orders = await tradingService.getUserOrderHistory(userId, marketId, parseInt(limit));

        res.json({
            success: true,
            data: {
                orders,
                total: orders.length,
                walletAddress
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get user order history:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'USER_ORDERS_ERROR',
                message: 'Failed to get user order history',
                details: error.message
            }
        });
    }
});

// Get user activity (trades)
router.get('/users/:walletAddress/activity', [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    query('marketId').optional().notEmpty().withMessage('Market ID cannot be empty'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
], async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { marketId, limit = 50 } = req.query;

        const userId = await getUserId(walletAddress);
        const pool = databaseService.getPool();

        let query = `
            SELECT
                t.id, t.market_id, t.outcome, t.price, t.size, t.manteia_fee,
                t.created_at, t.transaction_hash,
                m.title, m.category, m.status as market_status,
                CASE
                    WHEN t.maker_id = $1 THEN 'maker'
                    WHEN t.taker_id = $1 THEN 'taker'
                    ELSE 'unknown'
                END as role
            FROM trades t
            JOIN markets m ON t.market_id = m.id
            WHERE (t.maker_id = $1 OR t.taker_id = $1)
        `;

        const params = [userId];

        if (marketId) {
            query += ' AND t.market_id = $2';
            params.push(marketId);
            params.push(parseInt(limit));
        } else {
            params.push(parseInt(limit));
        }

        query += ' ORDER BY t.created_at DESC LIMIT $' + params.length;

        const result = await pool.query(query, params);

        const activities = result.rows.map(row => ({
            id: row.id,
            marketId: row.market_id,
            marketTitle: row.title,
            category: row.category,
            marketStatus: row.market_status,
            activityType: 'trade',
            outcome: row.outcome,
            price: parseFloat(row.price),
            size: parseFloat(row.size),
            role: row.role,
            fee: parseFloat(row.manteia_fee),
            transactionHash: row.transaction_hash,
            createdAt: row.created_at,
            description: `${row.role === 'maker' ? 'Made' : 'Took'} ${row.outcome ? 'YES' : 'NO'} order for ${row.size} shares at $${parseFloat(row.price).toFixed(2)}`
        }));

        res.json({
            success: true,
            data: {
                activities,
                total: activities.length,
                walletAddress
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get user activity:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'USER_ACTIVITY_ERROR',
                message: 'Failed to get user activity',
                details: error.message
            }
        });
    }
});

// Get recent trades for a market
router.get('/markets/:marketId/trades', [
    param('marketId').notEmpty().withMessage('Market ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
], async (req, res) => {
    try {
        const { marketId } = req.params;
        const { limit = 50 } = req.query;

        const pool = databaseService.getPool();

        const result = await pool.query(`
            SELECT
                t.id, t.outcome, t.price, t.size, t.manteia_fee, t.created_at,
                u1.username as maker_username,
                u2.username as taker_username
            FROM trades t
            JOIN users u1 ON t.maker_id = u1.id
            JOIN users u2 ON t.taker_id = u2.id
            WHERE t.market_id = $1
            ORDER BY t.created_at DESC
            LIMIT $2
        `, [marketId, parseInt(limit)]);

        const trades = result.rows.map(row => ({
            id: row.id,
            outcome: row.outcome,
            price: parseFloat(row.price),
            size: parseFloat(row.size),
            fee: parseFloat(row.manteia_fee),
            makerUsername: row.maker_username,
            takerUsername: row.taker_username,
            createdAt: row.created_at
        }));

        res.json({
            success: true,
            data: {
                trades,
                total: trades.length,
                marketId
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get market trades:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKET_TRADES_ERROR',
                message: 'Failed to get market trades',
                details: error.message
            }
        });
    }
});

// Cancel an order
router.delete('/orders/:orderId', [
    param('orderId').isUUID().withMessage('Invalid order ID'),
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    validateRequest
], async (req, res) => {
    try {
        const { orderId } = req.params;
        const { walletAddress } = req.body;

        const userId = await getUserId(walletAddress);
        const pool = databaseService.getPool();

        // Check if order exists and belongs to user
        const orderCheck = await pool.query(
            'SELECT id, status, remaining_size FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, userId]
        );

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found or does not belong to user'
                }
            });
        }

        const order = orderCheck.rows[0];

        if (order.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_ACTIVE',
                    message: 'Order is not active and cannot be cancelled'
                }
            });
        }

        // Cancel the order
        await pool.query(
            'UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3',
            ['cancelled', new Date(), orderId]
        );

        // Remove from order book
        tradingService.removeFromOrderBook('', orderId); // Market ID will be determined in the service

        logger.info('Order cancelled successfully', { orderId, userId });

        res.json({
            success: true,
            data: {
                orderId,
                message: 'Order cancelled successfully'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to cancel order:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'ORDER_CANCELLATION_ERROR',
                message: 'Failed to cancel order',
                details: error.message
            }
        });
    }
});

// Get trading service status
router.get('/status', async (req, res) => {
    try {
        const status = tradingService.getStatus();

        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get trading service status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'STATUS_ERROR',
                message: 'Failed to get trading service status',
                details: error.message
            }
        });
    }
});

// Get market statistics
router.get('/markets/:marketId/stats', [
    param('marketId').notEmpty().withMessage('Market ID is required'),
    validateRequest
], async (req, res) => {
    try {
        const { marketId } = req.params;
        const pool = databaseService.getPool();

        // Get market info
        const marketQuery = await pool.query(
            'SELECT * FROM markets WHERE id = $1',
            [marketId]
        );

        if (marketQuery.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MARKET_NOT_FOUND',
                    message: 'Market not found'
                }
            });
        }

        const market = marketQuery.rows[0];

        // Get trading statistics
        const statsQuery = await pool.query(`
            SELECT
                COUNT(*) as total_trades,
                COUNT(DISTINCT maker_id) + COUNT(DISTINCT taker_id) as unique_traders,
                SUM(CASE WHEN outcome = true THEN size ELSE 0 END) as yes_volume,
                SUM(CASE WHEN outcome = false THEN size ELSE 0 END) as no_volume,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price,
                SUM(manteia_fee) as total_fees
            FROM trades
            WHERE market_id = $1
        `, [marketId]);

        const stats = statsQuery.rows[0];

        // Get order book depth
        const orderBook = tradingService.getOrderBook(marketId);
        const currentPrice = await tradingService.getMarketPrice(marketId);

        res.json({
            success: true,
            data: {
                market: {
                    id: market.id,
                    title: market.title,
                    category: market.category,
                    status: market.status,
                    currentPrice: parseFloat(market.current_price),
                    totalVolume: parseFloat(market.total_volume),
                    endDate: market.end_date
                },
                stats: {
                    totalTrades: parseInt(stats.total_trades) || 0,
                    uniqueTraders: parseInt(stats.unique_traders) || 0,
                    yesVolume: parseFloat(stats.yes_volume) || 0,
                    noVolume: parseFloat(stats.no_volume) || 0,
                    avgPrice: parseFloat(stats.avg_price) || 0,
                    minPrice: parseFloat(stats.min_price) || 0,
                    maxPrice: parseFloat(stats.max_price) || 0,
                    totalFees: parseFloat(stats.total_fees) || 0
                },
                orderBook: {
                    yesOrders: orderBook.yes.length,
                    noOrders: orderBook.no.length,
                    bestBid: tradingService.getBestBid(orderBook),
                    bestAsk: tradingService.getBestAsk(orderBook),
                    spread: tradingService.getBestAsk(orderBook) - tradingService.getBestBid(orderBook),
                    currentPrice
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get market stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKET_STATS_ERROR',
                message: 'Failed to get market statistics',
                details: error.message
            }
        });
    }
});

// Get single market by ID
router.get('/markets/:marketId', [
    param('marketId').notEmpty().withMessage('Market ID is required'),
    validateRequest
], async (req, res) => {
    try {
        const { marketId } = req.params;

        const pool = databaseService.getPool();

        // Get market details
        const marketQuery = `
            SELECT
                id,
                title,
                description,
                category,
                status,
                outcome,
                current_price,
                total_volume,
                total_liquidity,
                yes_shares,
                no_shares,
                end_date,
                resolution_date,
                created_at,
                updated_at,
                tags,
                min_bet_amount,
                max_bet_amount,
                resolution_criteria,
                resolution_source,
                yes_price,
                no_price,
                last_traded_price,
                best_bid,
                best_ask,
                spread,
                resolved_at
            FROM markets
            WHERE id = $1
        `;

        const result = await pool.query(marketQuery, [marketId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MARKET_NOT_FOUND',
                    message: 'Market not found'
                },
                timestamp: new Date().toISOString()
            });
        }

        const market = result.rows[0];

        // Get additional market statistics
        const statsQuery = `
            SELECT
                COUNT(*) as total_trades,
                COUNT(DISTINCT maker_id) + COUNT(DISTINCT taker_id) as unique_traders,
                SUM(CASE WHEN outcome = true THEN size ELSE 0 END) as yes_volume,
                SUM(CASE WHEN outcome = false THEN size ELSE 0 END) as no_volume,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM trades
            WHERE market_id = $1
        `;

        const statsResult = await pool.query(statsQuery, [marketId]);
        const stats = statsResult.rows[0];

        // Format the response
        const marketData = {
            id: market.id,
            title: market.title,
            description: market.description,
            category: market.category,
            status: market.status,
            outcome: market.outcome,
            currentPrice: parseFloat(market.current_price),
            totalVolume: parseFloat(market.total_volume),
            totalLiquidity: parseFloat(market.total_liquidity || 0),
            yesShares: parseFloat(market.yes_shares || 0),
            noShares: parseFloat(market.no_shares || 0),
            endDate: market.end_date,
            resolutionDate: market.resolution_date,
            createdAt: market.created_at,
            updatedAt: market.updated_at,
            tags: market.tags || [],
            minBetAmount: parseFloat(market.min_bet_amount),
            maxBetAmount: parseFloat(market.max_bet_amount),
            resolutionCriteria: market.resolution_criteria,
            resolutionSource: market.resolution_source,
            yesPrice: parseFloat(market.yes_price),
            noPrice: parseFloat(market.no_price),
            lastTradedPrice: parseFloat(market.last_traded_price),
            bestBid: parseFloat(market.best_bid || 0),
            bestAsk: parseFloat(market.best_ask || 0),
            spread: parseFloat(market.spread || 0),
            resolvedAt: market.resolved_at,
            statistics: {
                totalTrades: parseInt(stats.total_trades) || 0,
                uniqueTraders: parseInt(stats.unique_traders) || 0,
                yesVolume: parseFloat(stats.yes_volume) || 0,
                noVolume: parseFloat(stats.no_volume) || 0,
                avgPrice: parseFloat(stats.avg_price) || 0,
                minPrice: parseFloat(stats.min_price) || 0,
                maxPrice: parseFloat(stats.max_price) || 0
            }
        };

        res.json({
            success: true,
            data: marketData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get market:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKET_FETCH_ERROR',
                message: 'Failed to fetch market',
                details: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

// Get all markets (public view)
router.get('/markets', [
    query('status').optional().isIn(['active', 'resolved', 'cancelled']).withMessage('Invalid status'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    validateRequest
], async (req, res) => {
    try {
        const { status, category, limit = 20, offset = 0 } = req.query;

        const pool = require('../config/database').getPool();
        let whereClause = '';
        let params = [];
        let paramIndex = 1;

        // Build WHERE clause for filtering
        const filters = [];
        if (status) {
            filters.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }
        if (category) {
            filters.push(`category = $${paramIndex}`);
            params.push(category);
            paramIndex++;
        }

        if (filters.length > 0) {
            whereClause = 'WHERE ' + filters.join(' AND ');
        }

        // Get markets with pagination
        const query = `
            SELECT
                id,
                title,
                description,
                category,
                status,
                outcome,
                current_price,
                total_volume,
                total_liquidity,
                yes_shares,
                no_shares,
                end_date,
                resolution_date,
                created_at,
                updated_at
            FROM markets
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(limit, offset);
        const result = await pool.query(query, params);

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) FROM markets ${whereClause}`;
        const countResult = await pool.query(countQuery, params.slice(0, -2));
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                markets: result.rows,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalCount,
                    hasMore: offset + result.rows.length < totalCount
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get markets:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKETS_FETCH_ERROR',
                message: 'Failed to fetch markets',
                details: error.message
            }
        });
    }
});

// Get featured markets
router.get('/markets/featured', [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
], async (req, res) => {
    try {
        const { limit = 6 } = req.query;

        const pool = databaseService.getPool();

        // Get featured markets (markets with high volume or manually featured)
        const query = `
            SELECT
                id,
                title,
                description,
                category,
                status,
                outcome,
                current_price,
                total_volume,
                total_liquidity,
                yes_shares,
                no_shares,
                end_date,
                resolution_date,
                created_at,
                updated_at
            FROM markets
            WHERE status = 'active'
            ORDER BY total_volume DESC, created_at DESC
            LIMIT $1
        `;

        const result = await pool.query(query, [parseInt(limit)]);

        res.json({
            success: true,
            data: {
                markets: result.rows,
                total: result.rows.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get featured markets:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'FEATURED_MARKETS_ERROR',
                message: 'Failed to get featured markets',
                details: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

// Get markets by category
router.get('/markets/category/:category', [
    param('category').notEmpty().withMessage('Category is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
], async (req, res) => {
    try {
        const { category } = req.params;
        const { limit = 10 } = req.query;

        const pool = databaseService.getPool();

        const query = `
            SELECT
                id,
                title,
                description,
                category,
                status,
                outcome,
                current_price,
                total_volume,
                total_liquidity,
                yes_shares,
                no_shares,
                end_date,
                resolution_date,
                created_at,
                updated_at
            FROM markets
            WHERE category = $1 AND status = 'active'
            ORDER BY created_at DESC
            LIMIT $2
        `;

        const result = await pool.query(query, [category, parseInt(limit)]);

        res.json({
            success: true,
            data: {
                markets: result.rows,
                category: category,
                total: result.rows.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get markets by category:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'CATEGORY_MARKETS_ERROR',
                message: 'Failed to get markets by category',
                details: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

// Search markets
router.get('/markets/search', [
    query('q').notEmpty().withMessage('Search query is required'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    validateRequest
], async (req, res) => {
    try {
        const { q, category, limit = 20, offset = 0 } = req.query;

        const pool = databaseService.getPool();

        let whereClause = `WHERE (title ILIKE $1 OR description ILIKE $1)`;
        let params = [`%${q}%`];
        let paramIndex = 2;

        if (category) {
            whereClause += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        const query = `
            SELECT
                id,
                title,
                description,
                category,
                status,
                outcome,
                current_price,
                total_volume,
                total_liquidity,
                yes_shares,
                no_shares,
                end_date,
                resolution_date,
                created_at,
                updated_at
            FROM markets
            ${whereClause}
            ORDER BY
                CASE
                    WHEN title ILIKE $1 THEN 1
                    WHEN description ILIKE $1 THEN 2
                    ELSE 3
                END,
                total_volume DESC,
                created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(parseInt(limit), parseInt(offset));
        const result = await pool.query(query, params);

        // Get total count for pagination
        const countQuery = `SELECT COUNT(*) FROM markets ${whereClause}`;
        const countResult = await pool.query(countQuery, params.slice(0, -2));
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                markets: result.rows,
                searchQuery: q,
                category: category || null,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalCount,
                    hasMore: offset + result.rows.length < totalCount
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to search markets:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKET_SEARCH_ERROR',
                message: 'Failed to search markets',
                details: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;