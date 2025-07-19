const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { adminLogin, authenticateAdmin } = require('../middleware/adminAuth');
const logger = require('../utils/logger');
const { ethers } = require('ethers');

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

// Admin login route
router.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
], adminLogin);

// Create new market
router.post('/markets', [
    authenticateAdmin,
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('category').isIn(['politics', 'sports', 'crypto', 'entertainment', 'technology', 'economics', 'science', 'other']).withMessage('Invalid category'),
    body('endDate').isISO8601().withMessage('Invalid end date format'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('resolutionCriteria').notEmpty().withMessage('Resolution criteria is required'),
    body('resolutionSource').optional().isString().withMessage('Resolution source must be a string'),
    validateRequest
], async (req, res) => {
    try {
        const { title, description, category, endDate, tags, resolutionCriteria, resolutionSource } = req.body;

        // Validate end date is in the future
        const endDateTime = new Date(endDate);
        if (endDateTime <= new Date()) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_END_DATE',
                    message: 'End date must be in the future'
                }
            });
        }

        // Generate market ID
        const marketId = generateMarketId();

        // Create market in database
        const pool = require('../config/database').getPool();
        const marketData = {
            id: marketId,
            title,
            description,
            category,
            status: 'active',
            created_at: new Date(),
            resolved_at: null,
            outcome: null,
            end_date: endDateTime,
            current_price: 0.50,
            tags: tags || [],
            resolution_criteria: resolutionCriteria,
            resolution_source: resolutionSource || '',
            created_by: req.admin.username,
            total_volume: 0,
            total_yes_volume: 0,
            total_no_volume: 0,
            yes_price: 0.50,
            no_price: 0.50,
            last_traded_price: 0.50,
            best_bid: 0,
            best_ask: 0,
            spread: 0,
            market_maker_fee: 0.0000,
            taker_fee: 0.0000,
            manteia_fee: 0.0200
        };

        await pool.query(`
            INSERT INTO markets (
                id, title, description, category, status, created_at, end_date,
                current_price, tags, resolution_criteria, resolution_source, created_by,
                total_volume, total_yes_volume, total_no_volume, yes_price, no_price,
                last_traded_price, best_bid, best_ask, spread, market_maker_fee,
                taker_fee, manteia_fee
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24
            )
        `, [
            marketData.id, marketData.title, marketData.description, marketData.category,
            marketData.status, marketData.created_at, marketData.end_date, marketData.current_price,
            marketData.tags, marketData.resolution_criteria, marketData.resolution_source,
            marketData.created_by, marketData.total_volume, marketData.total_yes_volume,
            marketData.total_no_volume, marketData.yes_price, marketData.no_price,
            marketData.last_traded_price, marketData.best_bid, marketData.best_ask,
            marketData.spread, marketData.market_maker_fee, marketData.taker_fee,
            marketData.manteia_fee
        ]);

        // Deploy market to smart contract
        try {
            const contractResult = await deployMarketToContract(marketData);
            logger.info('Market deployed to smart contract', { marketId, txHash: contractResult.txHash });
        } catch (contractError) {
            logger.error('Failed to deploy market to contract:', contractError);
            // Continue without contract deployment for now
        }

        logger.info('Market created successfully', { marketId, title, category, createdBy: req.admin.username });

        res.json({
            success: true,
            data: {
                market: marketData,
                message: 'Market created successfully'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to create market:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKET_CREATION_ERROR',
                message: 'Failed to create market',
                details: error.message
            }
        });
    }
});

// Get all markets (admin view)
router.get('/markets', [
    authenticateAdmin,
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

        if (status) {
            whereClause += ` WHERE status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (category) {
            whereClause += whereClause ? ` AND category = $${paramIndex}` : ` WHERE category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        const query = `
            SELECT
                id, title, description, category, status, created_at, end_date,
                current_price, tags, resolution_criteria, resolution_source, created_by,
                total_volume, total_yes_volume, total_no_volume, yes_price, no_price,
                last_traded_price, best_bid, best_ask, spread, resolved_at, outcome
            FROM markets
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count
        const countQuery = `SELECT COUNT(*) FROM markets ${whereClause}`;
        const countResult = await pool.query(countQuery, params.slice(0, -2));
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                markets: result.rows,
                pagination: {
                    total: totalCount,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: totalCount > (parseInt(offset) + parseInt(limit))
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

// Resolve market
router.post('/markets/:marketId/resolve', [
    authenticateAdmin,
    param('marketId').notEmpty().withMessage('Market ID is required'),
    body('outcome').isBoolean().withMessage('Outcome must be true (YES) or false (NO)'),
    body('resolutionNote').optional().isString().withMessage('Resolution note must be a string'),
    validateRequest
], async (req, res) => {
    try {
        const { marketId } = req.params;
        const { outcome, resolutionNote } = req.body;

        const pool = require('../config/database').getPool();

        // Check if market exists and is not already resolved
        const marketCheck = await pool.query(
            'SELECT id, status, title FROM markets WHERE id = $1',
            [marketId]
        );

        if (marketCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MARKET_NOT_FOUND',
                    message: 'Market not found'
                }
            });
        }

        const market = marketCheck.rows[0];

        if (market.status === 'resolved') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MARKET_ALREADY_RESOLVED',
                    message: 'Market is already resolved'
                }
            });
        }

        // Update market resolution
        await pool.query(`
            UPDATE markets
            SET status = 'resolved', outcome = $1, resolved_at = $2, resolution_note = $3
            WHERE id = $4
        `, [outcome, new Date(), resolutionNote || null, marketId]);

        // Resolve market in smart contract
        try {
            const contractResult = await resolveMarketInContract(marketId, outcome);
            logger.info('Market resolved in smart contract', { marketId, outcome, txHash: contractResult.txHash });
        } catch (contractError) {
            logger.error('Failed to resolve market in contract:', contractError);
            // Continue without contract resolution for now
        }

        logger.info('Market resolved successfully', {
            marketId,
            outcome,
            title: market.title,
            resolvedBy: req.admin.username
        });

        res.json({
            success: true,
            data: {
                marketId,
                outcome,
                resolvedAt: new Date().toISOString(),
                message: 'Market resolved successfully'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to resolve market:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'MARKET_RESOLUTION_ERROR',
                message: 'Failed to resolve market',
                details: error.message
            }
        });
    }
});

// Get market statistics
router.get('/markets/:marketId/stats', [
    authenticateAdmin,
    param('marketId').notEmpty().withMessage('Market ID is required'),
    validateRequest
], async (req, res) => {
    try {
        const { marketId } = req.params;

        const pool = require('../config/database').getPool();

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

        // Get trading stats
        const statsQuery = await pool.query(`
            SELECT
                COUNT(*) as total_trades,
                COUNT(DISTINCT user_id) as unique_traders,
                SUM(CASE WHEN outcome = true THEN size ELSE 0 END) as yes_volume,
                SUM(CASE WHEN outcome = false THEN size ELSE 0 END) as no_volume,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM trades
            WHERE market_id = $1
        `, [marketId]);

        const stats = statsQuery.rows[0];

        // Get recent trades
        const recentTradesQuery = await pool.query(`
            SELECT
                t.id, t.outcome, t.price, t.size, t.created_at,
                u1.username as maker_username,
                u2.username as taker_username
            FROM trades t
            JOIN users u1 ON t.maker_id = u1.id
            JOIN users u2 ON t.taker_id = u2.id
            WHERE t.market_id = $1
            ORDER BY t.created_at DESC
            LIMIT 10
        `, [marketId]);

        res.json({
            success: true,
            data: {
                market,
                stats: {
                    totalTrades: parseInt(stats.total_trades) || 0,
                    uniqueTraders: parseInt(stats.unique_traders) || 0,
                    yesVolume: parseFloat(stats.yes_volume) || 0,
                    noVolume: parseFloat(stats.no_volume) || 0,
                    avgPrice: parseFloat(stats.avg_price) || 0,
                    minPrice: parseFloat(stats.min_price) || 0,
                    maxPrice: parseFloat(stats.max_price) || 0
                },
                recentTrades: recentTradesQuery.rows
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

// Get system statistics
router.get('/stats', [
    authenticateAdmin
], async (req, res) => {
    try {
        const pool = require('../config/database').getPool();

        // Get overall system stats
        const marketStatsQuery = await pool.query(`
            SELECT
                COUNT(*) as total_markets,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_markets,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_markets,
                SUM(total_volume) as total_volume
            FROM markets
        `);

        const userStatsQuery = await pool.query(`
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_week,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_month
            FROM users
        `);

        const tradeStatsQuery = await pool.query(`
            SELECT
                COUNT(*) as total_trades,
                SUM(size) as total_volume,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as trades_24h,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as trades_7d
            FROM trades
        `);

        const marketStats = marketStatsQuery.rows[0];
        const userStats = userStatsQuery.rows[0];
        const tradeStats = tradeStatsQuery.rows[0];

        res.json({
            success: true,
            data: {
                markets: {
                    total: parseInt(marketStats.total_markets) || 0,
                    active: parseInt(marketStats.active_markets) || 0,
                    resolved: parseInt(marketStats.resolved_markets) || 0,
                    totalVolume: parseFloat(marketStats.total_volume) || 0
                },
                users: {
                    total: parseInt(userStats.total_users) || 0,
                    newThisWeek: parseInt(userStats.new_users_week) || 0,
                    newThisMonth: parseInt(userStats.new_users_month) || 0
                },
                trades: {
                    total: parseInt(tradeStats.total_trades) || 0,
                    totalVolume: parseFloat(tradeStats.total_volume) || 0,
                    last24h: parseInt(tradeStats.trades_24h) || 0,
                    last7d: parseInt(tradeStats.trades_7d) || 0
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get system stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'SYSTEM_STATS_ERROR',
                message: 'Failed to get system statistics',
                details: error.message
            }
        });
    }
});

// Helper functions
function generateMarketId() {
    // Generate a unique market ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `market-${timestamp}-${random}`;
}

async function deployMarketToContract(marketData) {
    // Mock implementation - replace with actual contract deployment
    // This would interact with the MarketHub smart contract
    return {
        txHash: '0x' + Math.random().toString(16).substring(2, 66),
        marketId: marketData.id,
        contractAddress: process.env.MARKET_HUB_CONTRACT_ADDRESS
    };
}

async function resolveMarketInContract(marketId, outcome) {
    // Mock implementation - replace with actual contract interaction
    // This would call the resolveMarket function on the MarketHub contract
    return {
        txHash: '0x' + Math.random().toString(16).substring(2, 66),
        marketId,
        outcome
    };
}

module.exports = router;