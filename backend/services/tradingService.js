const { EventEmitter } = require('events');
const { ethers } = require('ethers');
const logger = require('../utils/logger');
const databaseService = require('../config/database');

class TradingService extends EventEmitter {
    constructor() {
        super();
        this.initialized = false;
        this.provider = null;
        this.marketHubContract = null;
        this.orderBooks = new Map(); // In-memory order book cache
        this.pendingOrders = new Map(); // Track pending orders
        // Don't call init() here - let the server initialize it when database is ready
    }

    static getInstance() {
        if (!TradingService.instance) {
            TradingService.instance = new TradingService();
        }
        return TradingService.instance;
    }

    async init() {
        try {
            // Initialize blockchain connection
            this.provider = new ethers.JsonRpcProvider(process.env.MANTLE_RPC_URL);

            // Initialize MarketHub contract
            if (process.env.MARKET_HUB_CONTRACT_ADDRESS) {
                const marketHubArtifact = require('../abi/MarketHub.json');
                this.marketHubContract = new ethers.Contract(
                    process.env.MARKET_HUB_CONTRACT_ADDRESS,
                    marketHubArtifact.abi,
                    this.provider
                );
            }

            this.initialized = true;
            logger.info('TradingService initialized successfully');

            // Load existing order books
            await this.loadOrderBooks();

            this.emit('ready');
        } catch (error) {
            logger.error('Failed to initialize TradingService:', error);
            this.emit('error', error);
        }
    }

    async loadOrderBooks() {
        try {
            const pool = databaseService.getPool();

            // Load active orders for all markets
            const activeOrders = await pool.query(`
                SELECT market_id, outcome, price, size, remaining_size, user_id, id, created_at
                FROM orders
                WHERE status = 'active' AND remaining_size > 0
                ORDER BY market_id, outcome, price DESC
            `);

            // Group orders by market
            const ordersByMarket = {};
            activeOrders.rows.forEach(order => {
                if (!ordersByMarket[order.market_id]) {
                    ordersByMarket[order.market_id] = { yes: [], no: [] };
                }

                const side = order.outcome ? 'yes' : 'no';
                ordersByMarket[order.market_id][side].push({
                    id: order.id,
                    userId: order.user_id,
                    price: parseFloat(order.price),
                    size: parseFloat(order.size),
                    remainingSize: parseFloat(order.remaining_size),
                    timestamp: order.created_at
                });
            });

            // Cache order books
            Object.keys(ordersByMarket).forEach(marketId => {
                this.orderBooks.set(marketId, ordersByMarket[marketId]);
            });

            logger.info(`Loaded order books for ${Object.keys(ordersByMarket).length} markets`);
        } catch (error) {
            logger.error('Failed to load order books:', error);
            throw error;
        }
    }

    async placeOrder(userId, marketId, outcome, price, size, orderType = 'limit') {
        try {
            // Validate inputs
            this.validateOrder(userId, marketId, outcome, price, size, orderType);

            const pool = databaseService.getPool();

            // Check if market exists and is active
            const marketCheck = await pool.query(
                'SELECT id, status, end_date FROM markets WHERE id = $1',
                [marketId]
            );

            if (marketCheck.rows.length === 0) {
                throw new Error('Market not found');
            }

            const market = marketCheck.rows[0];
            if (market.status !== 'active') {
                throw new Error('Market is not active');
            }

            if (new Date(market.end_date) <= new Date()) {
                throw new Error('Market has ended');
            }

            // Check user balance (for now, we'll assume they have enough)
            // In production, this would check their MNT balance

            let remainingSize = size;
            let totalMatched = 0;
            let avgExecutionPrice = 0;

            // Try to match order
            if (orderType === 'market') {
                // For market orders, execute immediately at best available prices
                const matchResult = await this.executeMarketOrder(userId, marketId, outcome, size);
                remainingSize = matchResult.remainingSize;
                totalMatched = matchResult.totalMatched;
                avgExecutionPrice = matchResult.avgPrice;
            } else {
                // For limit orders, try to match at specified price or better
                const matchResult = await this.tryMatchLimitOrder(userId, marketId, outcome, price, size);
                remainingSize = matchResult.remainingSize;
                totalMatched = matchResult.totalMatched;
                avgExecutionPrice = matchResult.avgPrice;
            }

            let orderId = null;

            // If there's remaining size, add to order book
            if (remainingSize > 0) {
                const orderResult = await pool.query(`
                    INSERT INTO orders (
                        user_id, market_id, outcome, order_type, price, size,
                        filled_size, remaining_size, status, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    userId, marketId, outcome, orderType, price, size,
                    totalMatched, remainingSize, 'active', new Date()
                ]);

                orderId = orderResult.rows[0].id;

                // Add to in-memory order book
                this.addToOrderBook(marketId, orderId, userId, outcome, price, remainingSize);
            }

            // Update user positions
            if (totalMatched > 0) {
                await this.updateUserPosition(userId, marketId, outcome, totalMatched, avgExecutionPrice);
            }

            // Update market statistics
            await this.updateMarketStats(marketId, outcome, totalMatched, avgExecutionPrice);

            // Emit events
            this.emit('orderPlaced', {
                orderId,
                userId,
                marketId,
                outcome,
                price,
                size,
                totalMatched,
                remainingSize,
                avgExecutionPrice
            });

            return {
                success: true,
                orderId,
                totalMatched,
                remainingSize,
                avgExecutionPrice,
                message: totalMatched > 0 ?
                    `Order placed successfully. ${totalMatched} shares matched at avg price ${avgExecutionPrice.toFixed(4)}` :
                    'Order placed successfully and added to order book'
            };

        } catch (error) {
            logger.error('Failed to place order:', error);
            throw error;
        }
    }

    async executeMarketOrder(userId, marketId, outcome, size) {
        const oppositeOutcome = !outcome;
        const orderBook = this.getOrderBook(marketId);
        const oppositeOrders = oppositeOutcome ? orderBook.yes : orderBook.no;

        let remainingSize = size;
        let totalMatched = 0;
        let totalCost = 0;
        const matchedOrders = [];

        // Sort orders by price (best first)
        const sortedOrders = oppositeOrders.sort((a, b) =>
            oppositeOutcome ? b.price - a.price : a.price - b.price
        );

        for (const order of sortedOrders) {
            if (remainingSize <= 0) break;

            const matchSize = Math.min(remainingSize, order.remainingSize);
            const matchPrice = this.calculateMatchPrice(outcome, order.price);

            // Execute the match
            await this.executeTrade(
                marketId,
                order.userId, // maker
                userId, // taker
                order.id,
                null, // taker order ID (market order)
                outcome,
                matchPrice,
                matchSize
            );

            matchedOrders.push({ orderId: order.id, size: matchSize, price: matchPrice });
            totalMatched += matchSize;
            totalCost += matchSize * matchPrice;
            remainingSize -= matchSize;

            // Update order book
            order.remainingSize -= matchSize;
            if (order.remainingSize <= 0) {
                this.removeFromOrderBook(marketId, order.id);
            }
        }

        if (remainingSize > 0) {
            throw new Error('Cannot completely fill market order');
        }

        return {
            totalMatched,
            remainingSize,
            avgPrice: totalMatched > 0 ? totalCost / totalMatched : 0,
            matchedOrders
        };
    }

    async tryMatchLimitOrder(userId, marketId, outcome, price, size) {
        const oppositeOutcome = !outcome;
        const orderBook = this.getOrderBook(marketId);
        const oppositeOrders = oppositeOutcome ? orderBook.yes : orderBook.no;

        let remainingSize = size;
        let totalMatched = 0;
        let totalCost = 0;
        const matchedOrders = [];

        // Find matching orders
        for (const order of oppositeOrders) {
            if (remainingSize <= 0) break;

            // Check if prices are compatible
            const complementaryPrice = 1 - price;
            const canMatch = oppositeOutcome ?
                order.price >= complementaryPrice :
                order.price <= complementaryPrice;

            if (!canMatch) continue;

            const matchSize = Math.min(remainingSize, order.remainingSize);
            const matchPrice = order.price; // Use maker's price

            // Execute the match
            await this.executeTrade(
                marketId,
                order.userId, // maker
                userId, // taker
                order.id,
                null, // taker order ID (will be created later)
                outcome,
                matchPrice,
                matchSize
            );

            matchedOrders.push({ orderId: order.id, size: matchSize, price: matchPrice });
            totalMatched += matchSize;
            totalCost += matchSize * matchPrice;
            remainingSize -= matchSize;

            // Update order book
            order.remainingSize -= matchSize;
            if (order.remainingSize <= 0) {
                this.removeFromOrderBook(marketId, order.id);
            }
        }

        return {
            totalMatched,
            remainingSize,
            avgPrice: totalMatched > 0 ? totalCost / totalMatched : 0,
            matchedOrders
        };
    }

    async executeTrade(marketId, makerId, takerId, makerOrderId, takerOrderId, outcome, price, size) {
        try {
            const pool = databaseService.getPool();

            // Calculate fees
            const makerFee = 0; // 0% maker fee
            const takerFee = 0; // 0% taker fee
            const manteiaFee = size * 0.02; // 2% platform fee

            // Create trade record
            const tradeResult = await pool.query(`
                INSERT INTO trades (
                    market_id, maker_id, taker_id, maker_order_id, taker_order_id,
                    outcome, price, size, maker_fee, taker_fee, manteia_fee, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                marketId, makerId, takerId, makerOrderId, takerOrderId,
                outcome, price, size, makerFee, takerFee, manteiaFee, new Date()
            ]);

            const tradeId = tradeResult.rows[0].id;

            // Update maker order
            await pool.query(`
                UPDATE orders
                SET filled_size = filled_size + $1,
                    remaining_size = remaining_size - $1,
                    status = CASE WHEN remaining_size - $1 <= 0 THEN 'filled' ELSE status END,
                    updated_at = $2
                WHERE id = $3
            `, [size, new Date(), makerOrderId]);

            // Update user positions
            await this.updateUserPosition(makerId, marketId, !outcome, size, 1 - price);
            await this.updateUserPosition(takerId, marketId, outcome, size, price);

            // Emit trade event
            this.emit('tradeExecuted', {
                tradeId,
                marketId,
                makerId,
                takerId,
                outcome,
                price,
                size,
                makerFee,
                takerFee,
                manteiaFee
            });

            return tradeId;

        } catch (error) {
            logger.error('Failed to execute trade:', error);
            throw error;
        }
    }

    async updateUserPosition(userId, marketId, outcome, size, price) {
        try {
            const pool = databaseService.getPool();

            // Check if position exists
            const existingPosition = await pool.query(`
                SELECT shares, avg_price, total_cost
                FROM user_positions
                WHERE user_id = $1 AND market_id = $2 AND outcome = $3
            `, [userId, marketId, outcome]);

            if (existingPosition.rows.length > 0) {
                // Update existing position
                const current = existingPosition.rows[0];
                const currentShares = parseFloat(current.shares);
                const currentAvgPrice = parseFloat(current.avg_price);
                const currentTotalCost = parseFloat(current.total_cost);

                const newShares = currentShares + size;
                const newTotalCost = currentTotalCost + (size * price);
                const newAvgPrice = newTotalCost / newShares;

                await pool.query(`
                    UPDATE user_positions
                    SET shares = $1, avg_price = $2, total_cost = $3, updated_at = $4
                    WHERE user_id = $5 AND market_id = $6 AND outcome = $7
                `, [newShares, newAvgPrice, newTotalCost, new Date(), userId, marketId, outcome]);
            } else {
                // Create new position
                await pool.query(`
                    INSERT INTO user_positions (
                        user_id, market_id, outcome, shares, avg_price, total_cost, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [userId, marketId, outcome, size, price, size * price, new Date()]);
            }

        } catch (error) {
            logger.error('Failed to update user position:', error);
            throw error;
        }
    }

    async updateMarketStats(marketId, outcome, volume, price) {
        try {
            const pool = databaseService.getPool();

            const volumeField = outcome ? 'total_yes_volume' : 'total_no_volume';
            const priceField = outcome ? 'yes_price' : 'no_price';

            await pool.query(`
                UPDATE markets
                SET
                    total_volume = total_volume + $1,
                    ${volumeField} = ${volumeField} + $1,
                    ${priceField} = $2,
                    last_traded_price = $2,
                    current_price = $2
                WHERE id = $3
            `, [volume, price, marketId]);

        } catch (error) {
            logger.error('Failed to update market stats:', error);
            throw error;
        }
    }

    getOrderBook(marketId) {
        if (!this.orderBooks.has(marketId)) {
            this.orderBooks.set(marketId, { yes: [], no: [] });
        }
        return this.orderBooks.get(marketId);
    }

    addToOrderBook(marketId, orderId, userId, outcome, price, size) {
        const orderBook = this.getOrderBook(marketId);
        const side = outcome ? 'yes' : 'no';

        const order = {
            id: orderId,
            userId,
            price,
            size,
            remainingSize: size,
            timestamp: new Date()
        };

        orderBook[side].push(order);

        // Sort orders by price (best first)
        orderBook[side].sort((a, b) => outcome ? b.price - a.price : a.price - b.price);

        this.emit('orderBookUpdated', { marketId, side, orderBook });
    }

    removeFromOrderBook(marketId, orderId) {
        const orderBook = this.getOrderBook(marketId);

        ['yes', 'no'].forEach(side => {
            const index = orderBook[side].findIndex(order => order.id === orderId);
            if (index !== -1) {
                orderBook[side].splice(index, 1);
                this.emit('orderBookUpdated', { marketId, side, orderBook });
            }
        });
    }

    calculateMatchPrice(outcome, orderPrice) {
        // For YES orders matched with NO orders: use the order price
        // For NO orders matched with YES orders: use 1 - order price
        return outcome ? orderPrice : 1 - orderPrice;
    }

    validateOrder(userId, marketId, outcome, price, size, orderType) {
        if (!userId || !marketId) {
            throw new Error('User ID and Market ID are required');
        }

        if (typeof outcome !== 'boolean') {
            throw new Error('Outcome must be boolean (true for YES, false for NO)');
        }

        if (price <= 0 || price >= 1) {
            throw new Error('Price must be between 0 and 1');
        }

        if (size <= 0) {
            throw new Error('Size must be positive');
        }

        if (!['market', 'limit'].includes(orderType)) {
            throw new Error('Order type must be "market" or "limit"');
        }
    }

    async getMarketPrice(marketId) {
        try {
            const orderBook = this.getOrderBook(marketId);

            const bestBid = this.getBestBid(orderBook);
            const bestAsk = this.getBestAsk(orderBook);

            if (bestBid === 0 && bestAsk === 0) {
                // No orders, return 0.5 (50/50 odds)
                return 0.5;
            }

            if (bestAsk - bestBid > 0.1) {
                // Spread too wide, use last traded price
                const pool = databaseService.getPool();
                const result = await pool.query(
                    'SELECT last_traded_price FROM markets WHERE id = $1',
                    [marketId]
                );
                return result.rows[0]?.last_traded_price || 0.5;
            }

            // Use midpoint of spread
            return (bestBid + bestAsk) / 2;

        } catch (error) {
            logger.error('Failed to get market price:', error);
            return 0.5;
        }
    }

    getBestBid(orderBook) {
        if (orderBook.yes.length === 0) return 0;
        return Math.max(...orderBook.yes.map(order => order.price));
    }

    getBestAsk(orderBook) {
        if (orderBook.no.length === 0) return 0;
        return Math.min(...orderBook.no.map(order => 1 - order.price));
    }

    async getUserPositions(userId, marketId = null) {
        try {
            const pool = databaseService.getPool();

            let query = `
                SELECT
                    up.market_id, up.outcome, up.shares, up.avg_price, up.total_cost,
                    up.realized_pnl, up.unrealized_pnl, up.created_at, up.updated_at,
                    m.title, m.description, m.category, m.status, m.current_price
                FROM user_positions up
                JOIN markets m ON up.market_id = m.id
                WHERE up.user_id = $1 AND up.shares > 0
            `;

            const params = [userId];

            if (marketId) {
                query += ' AND up.market_id = $2';
                params.push(marketId);
            }

            query += ' ORDER BY up.updated_at DESC';

            const result = await pool.query(query, params);

            return result.rows.map(row => ({
                marketId: row.market_id,
                marketTitle: row.title,
                marketDescription: row.description,
                category: row.category,
                marketStatus: row.status,
                currentPrice: parseFloat(row.current_price),
                outcome: row.outcome,
                shares: parseFloat(row.shares),
                avgPrice: parseFloat(row.avg_price),
                totalCost: parseFloat(row.total_cost),
                realizedPnl: parseFloat(row.realized_pnl || 0),
                unrealizedPnl: parseFloat(row.unrealized_pnl || 0),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));

        } catch (error) {
            logger.error('Failed to get user positions:', error);
            throw error;
        }
    }

    async getUserOrderHistory(userId, marketId = null, limit = 50) {
        try {
            const pool = databaseService.getPool();

            let query = `
                SELECT
                    o.id, o.market_id, o.outcome, o.order_type, o.price, o.size,
                    o.filled_size, o.remaining_size, o.status, o.created_at,
                    m.title, m.category
                FROM orders o
                JOIN markets m ON o.market_id = m.id
                WHERE o.user_id = $1
            `;

            const params = [userId];

            if (marketId) {
                query += ' AND o.market_id = $2';
                params.push(marketId);
                params.push(limit);
            } else {
                params.push(limit);
            }

            query += ' ORDER BY o.created_at DESC LIMIT $' + params.length;

            const result = await pool.query(query, params);

            return result.rows.map(row => ({
                id: row.id,
                marketId: row.market_id,
                marketTitle: row.title,
                category: row.category,
                outcome: row.outcome,
                orderType: row.order_type,
                price: parseFloat(row.price),
                size: parseFloat(row.size),
                filledSize: parseFloat(row.filled_size),
                remainingSize: parseFloat(row.remaining_size),
                status: row.status,
                createdAt: row.created_at
            }));

        } catch (error) {
            logger.error('Failed to get user order history:', error);
            throw error;
        }
    }

    getStatus() {
        return {
            initialized: this.initialized,
            activeMarkets: this.orderBooks.size,
            pendingOrders: this.pendingOrders.size,
            lastUpdate: new Date().toISOString()
        };
    }
}

module.exports = TradingService.getInstance();