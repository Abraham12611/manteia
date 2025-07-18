const { EventEmitter } = require('events');
const databaseService = require('../config/database');
const logger = require('../utils/logger');

class UserProfileService extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
  }

  async initialize() {
    try {
      this.initialized = true;
      logger.info('User profile service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize user profile service:', error);
      throw error;
    }
  }

  async getUserProfile(walletAddress) {
    try {
      const pool = databaseService.getPool();

      // Get user basic information
      const userQuery = `
        SELECT
          id,
          wallet_address,
          username,
          email,
          bio,
          avatar_url,
          created_at,
          updated_at,
          total_volume,
          total_profit_loss,
          total_positions,
          total_markets_traded,
          win_rate,
          is_verified,
          reputation_score,
          preferences
        FROM users
        WHERE wallet_address = $1
      `;

      const userResult = await pool.query(userQuery, [walletAddress]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Calculate comprehensive statistics
      const stats = await this.calculateUserStatistics(user.id);

      return {
        id: user.id,
        walletAddress: user.wallet_address,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        joinedDate: user.created_at,
        lastUpdated: user.updated_at,
        isVerified: user.is_verified,
        reputationScore: user.reputation_score,
        preferences: user.preferences,
        statistics: stats
      };

    } catch (error) {
      logger.error('Failed to get user profile:', error);
      throw error;
    }
  }

  async calculateUserStatistics(userId) {
    try {
      const pool = databaseService.getPool();

      // Get basic trading statistics
      const tradingStatsQuery = `
        SELECT
          COUNT(*) as total_transactions,
          SUM(CASE WHEN amount > 0 THEN amount::numeric ELSE 0 END) as total_volume,
          SUM(CASE WHEN transaction_type = 'buy' THEN amount::numeric ELSE -amount::numeric END) as net_position_value,
          COUNT(DISTINCT market_id) as markets_traded,
          AVG(amount::numeric) as avg_transaction_size,
          MIN(created_at) as first_transaction,
          MAX(created_at) as last_transaction
        FROM transactions
        WHERE user_id = $1
      `;

      const tradingResult = await pool.query(tradingStatsQuery, [userId]);
      const tradingStats = tradingResult.rows[0];

      // Get profit/loss calculation
      const profitLossQuery = `
        SELECT
          SUM(CASE WHEN t.transaction_type = 'sell' THEN t.amount::numeric ELSE -t.amount::numeric END) as realized_pnl,
          COUNT(CASE WHEN t.transaction_type = 'sell' THEN 1 END) as trades_closed,
          COUNT(CASE WHEN t.transaction_type = 'buy' THEN 1 END) as trades_opened
        FROM transactions t
        WHERE t.user_id = $1
      `;

      const pnlResult = await pool.query(profitLossQuery, [userId]);
      const pnlStats = pnlResult.rows[0];

      // Get current positions
      const positionsQuery = `
        SELECT
          COUNT(*) as active_positions,
          SUM(t.amount::numeric) as positions_value
        FROM transactions t
        JOIN markets m ON t.market_id = m.id
        WHERE t.user_id = $1
        AND m.status = 'active'
        GROUP BY t.user_id
      `;

      const positionsResult = await pool.query(positionsQuery, [userId]);
      const positionsStats = positionsResult.rows[0] || { active_positions: 0, positions_value: 0 };

      // Get bridge statistics
      const bridgeStatsQuery = `
        SELECT
          COUNT(*) as total_bridges,
          SUM(source_amount::numeric) as total_bridge_volume,
          COUNT(CASE WHEN bridge_status = 'completed' THEN 1 END) as successful_bridges,
          COUNT(CASE WHEN bridge_status = 'failed' THEN 1 END) as failed_bridges
        FROM cross_chain_bridges
        WHERE user_id = $1
      `;

      const bridgeResult = await pool.query(bridgeStatsQuery, [userId]);
      const bridgeStats = bridgeResult.rows[0];

      // Get receipt statistics
      const receiptStatsQuery = `
        SELECT
          COUNT(*) as total_receipts,
          COUNT(CASE WHEN receipt_status = 'generated' THEN 1 END) as generated_receipts,
          COUNT(CASE WHEN receipt_status = 'verified' THEN 1 END) as verified_receipts
        FROM receipts
        WHERE user_id = $1
      `;

      const receiptResult = await pool.query(receiptStatsQuery, [userId]);
      const receiptStats = receiptResult.rows[0];

      // Get market performance by category
      const categoryStatsQuery = `
        SELECT
          m.category,
          COUNT(*) as trades_count,
          SUM(t.amount::numeric) as volume,
          AVG(t.amount::numeric) as avg_trade_size
        FROM transactions t
        JOIN markets m ON t.market_id = m.id
        WHERE t.user_id = $1
        GROUP BY m.category
        ORDER BY volume DESC
      `;

      const categoryResult = await pool.query(categoryStatsQuery, [userId]);
      const categoryStats = categoryResult.rows;

      // Calculate additional metrics
      const winRate = pnlStats.trades_closed > 0 ?
        (pnlStats.realized_pnl > 0 ? 1 : 0) * 100 : 0;

      const avgDailyVolume = this.calculateAverageDailyVolume(
        tradingStats.total_volume,
        tradingStats.first_transaction,
        tradingStats.last_transaction
      );

      const tradingStreak = await this.calculateTradingStreak(userId);

      return {
        // Core Statistics
        positionsValue: parseFloat(positionsStats.positions_value || 0),
        profitLoss: parseFloat(pnlStats.realized_pnl || 0),
        totalVolume: parseFloat(tradingStats.total_volume || 0),
        marketsTraded: parseInt(tradingStats.markets_traded || 0),

        // Trading Statistics
        totalTransactions: parseInt(tradingStats.total_transactions || 0),
        activePositions: parseInt(positionsStats.active_positions || 0),
        tradesOpened: parseInt(pnlStats.trades_opened || 0),
        tradesClosed: parseInt(pnlStats.trades_closed || 0),
        winRate: parseFloat(winRate),
        avgTransactionSize: parseFloat(tradingStats.avg_transaction_size || 0),
        avgDailyVolume: parseFloat(avgDailyVolume),

        // Bridge Statistics
        totalBridges: parseInt(bridgeStats.total_bridges || 0),
        totalBridgeVolume: parseFloat(bridgeStats.total_bridge_volume || 0),
        successfulBridges: parseInt(bridgeStats.successful_bridges || 0),
        failedBridges: parseInt(bridgeStats.failed_bridges || 0),
        bridgeSuccessRate: bridgeStats.total_bridges > 0 ?
          (bridgeStats.successful_bridges / bridgeStats.total_bridges * 100) : 0,

        // Receipt Statistics
        totalReceipts: parseInt(receiptStats.total_receipts || 0),
        generatedReceipts: parseInt(receiptStats.generated_receipts || 0),
        verifiedReceipts: parseInt(receiptStats.verified_receipts || 0),

        // Category Performance
        categoryPerformance: categoryStats.map(cat => ({
          category: cat.category,
          tradesCount: parseInt(cat.trades_count),
          volume: parseFloat(cat.volume),
          avgTradeSize: parseFloat(cat.avg_trade_size)
        })),

        // Time-based Statistics
        firstTransaction: tradingStats.first_transaction,
        lastTransaction: tradingStats.last_transaction,
        tradingStreak: tradingStreak,

        // Rankings (placeholder for future implementation)
        volumeRank: null,
        profitRank: null,
        accuracyRank: null
      };

    } catch (error) {
      logger.error('Failed to calculate user statistics:', error);
      throw error;
    }
  }

  async getUserPositions(userId, filters = {}) {
    try {
      const pool = databaseService.getPool();

      let whereClause = 'WHERE t.user_id = $1';
      let params = [userId];
      let paramIndex = 2;

      // Apply filters
      if (filters.status) {
        whereClause += ` AND m.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.category) {
        whereClause += ` AND m.category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
      }

      if (filters.minAmount) {
        whereClause += ` AND t.amount >= $${paramIndex}`;
        params.push(filters.minAmount);
        paramIndex++;
      }

      const positionsQuery = `
        SELECT
          m.id as market_id,
          m.title as market_title,
          m.description as market_description,
          m.category,
          m.status as market_status,
          m.end_date,
          m.current_price,
          t.id as transaction_id,
          t.transaction_type,
          t.amount,
          t.token_address,
          t.created_at,
          t.transaction_status,
          (SELECT SUM(amount::numeric) FROM transactions t2 WHERE t2.market_id = m.id AND t2.user_id = $1) as total_position
        FROM transactions t
        JOIN markets m ON t.market_id = m.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT ${filters.limit || 50}
      `;

      const result = await pool.query(positionsQuery, params);

      return result.rows.map(row => ({
        marketId: row.market_id,
        marketTitle: row.market_title,
        marketDescription: row.market_description,
        category: row.category,
        marketStatus: row.market_status,
        endDate: row.end_date,
        currentPrice: row.current_price,
        transactionId: row.transaction_id,
        transactionType: row.transaction_type,
        amount: parseFloat(row.amount),
        tokenAddress: row.token_address,
        createdAt: row.created_at,
        transactionStatus: row.transaction_status,
        totalPosition: parseFloat(row.total_position || 0)
      }));

    } catch (error) {
      logger.error('Failed to get user positions:', error);
      throw error;
    }
  }

  async getUserActivity(userId, filters = {}) {
    try {
      const pool = databaseService.getPool();

      let whereClause = 'WHERE t.user_id = $1';
      let params = [userId];
      let paramIndex = 2;

      // Apply filters
      if (filters.type) {
        whereClause += ` AND t.transaction_type = $${paramIndex}`;
        params.push(filters.type);
        paramIndex++;
      }

      if (filters.minAmount) {
        whereClause += ` AND t.amount >= $${paramIndex}`;
        params.push(filters.minAmount);
        paramIndex++;
      }

      if (filters.dateFrom) {
        whereClause += ` AND t.created_at >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        whereClause += ` AND t.created_at <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      const activityQuery = `
        SELECT
          t.id,
          t.transaction_type,
          t.amount,
          t.token_address,
          t.transaction_hash,
          t.created_at,
          t.transaction_status,
          m.title as market_title,
          m.category,
          m.status as market_status,
          m.current_price
        FROM transactions t
        JOIN markets m ON t.market_id = m.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT ${filters.limit || 50}
      `;

      const result = await pool.query(activityQuery, params);

      return result.rows.map(row => ({
        id: row.id,
        type: row.transaction_type,
        amount: parseFloat(row.amount),
        tokenAddress: row.token_address,
        transactionHash: row.transaction_hash,
        createdAt: row.created_at,
        status: row.transaction_status,
        marketTitle: row.market_title,
        category: row.category,
        marketStatus: row.market_status,
        currentPrice: row.current_price
      }));

    } catch (error) {
      logger.error('Failed to get user activity:', error);
      throw error;
    }
  }

  async updateUserProfile(walletAddress, updates) {
    try {
      const pool = databaseService.getPool();

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.username) {
        updateFields.push(`username = $${paramIndex}`);
        values.push(updates.username);
        paramIndex++;
      }

      if (updates.email) {
        updateFields.push(`email = $${paramIndex}`);
        values.push(updates.email);
        paramIndex++;
      }

      if (updates.bio) {
        updateFields.push(`bio = $${paramIndex}`);
        values.push(updates.bio);
        paramIndex++;
      }

      if (updates.avatarUrl) {
        updateFields.push(`avatar_url = $${paramIndex}`);
        values.push(updates.avatarUrl);
        paramIndex++;
      }

      if (updates.preferences) {
        updateFields.push(`preferences = $${paramIndex}`);
        values.push(JSON.stringify(updates.preferences));
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(walletAddress);

      const updateQuery = `
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE wallet_address = $${paramIndex}
        RETURNING id, wallet_address, username, email, bio, avatar_url, updated_at
      `;

      const result = await pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to update user profile:', error);
      throw error;
    }
  }

  async getUserRankings(userId) {
    try {
      const pool = databaseService.getPool();

      // Get volume ranking
      const volumeRankQuery = `
        SELECT
          COUNT(*) + 1 as rank
        FROM users
        WHERE total_volume > (
          SELECT total_volume
          FROM users
          WHERE id = $1
        )
      `;

      const volumeRankResult = await pool.query(volumeRankQuery, [userId]);
      const volumeRank = volumeRankResult.rows[0].rank;

      // Get profit ranking
      const profitRankQuery = `
        SELECT
          COUNT(*) + 1 as rank
        FROM users
        WHERE total_profit_loss > (
          SELECT total_profit_loss
          FROM users
          WHERE id = $1
        )
      `;

      const profitRankResult = await pool.query(profitRankQuery, [userId]);
      const profitRank = profitRankResult.rows[0].rank;

      // Get accuracy ranking
      const accuracyRankQuery = `
        SELECT
          COUNT(*) + 1 as rank
        FROM users
        WHERE win_rate > (
          SELECT win_rate
          FROM users
          WHERE id = $1
        )
      `;

      const accuracyRankResult = await pool.query(accuracyRankQuery, [userId]);
      const accuracyRank = accuracyRankResult.rows[0].rank;

      return {
        volumeRank,
        profitRank,
        accuracyRank
      };

    } catch (error) {
      logger.error('Failed to get user rankings:', error);
      throw error;
    }
  }

  calculateAverageDailyVolume(totalVolume, firstTransaction, lastTransaction) {
    if (!firstTransaction || !lastTransaction || !totalVolume) return 0;

    const firstDate = new Date(firstTransaction);
    const lastDate = new Date(lastTransaction);
    const daysDiff = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

    return totalVolume / daysDiff;
  }

  async calculateTradingStreak(userId) {
    try {
      const pool = databaseService.getPool();

      // Get daily trading activity
      const streakQuery = `
        SELECT
          DATE(created_at) as trading_date,
          COUNT(*) as trades_count
        FROM transactions
        WHERE user_id = $1
        GROUP BY DATE(created_at)
        ORDER BY trading_date DESC
        LIMIT 365
      `;

      const result = await pool.query(streakQuery, [userId]);
      const tradingDays = result.rows;

      if (tradingDays.length === 0) return 0;

      // Calculate current streak
      let currentStreak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < tradingDays.length; i++) {
        const tradingDate = new Date(tradingDays[i].trading_date);
        const expectedDate = new Date(currentDate);
        expectedDate.setDate(expectedDate.getDate() - i);

        if (tradingDate.getTime() === expectedDate.getTime()) {
          currentStreak++;
        } else {
          break;
        }
      }

      return currentStreak;

    } catch (error) {
      logger.error('Failed to calculate trading streak:', error);
      return 0;
    }
  }

  async getUserPreferences(walletAddress) {
    try {
      const pool = databaseService.getPool();

      const query = `
        SELECT preferences
        FROM users
        WHERE wallet_address = $1
      `;

      const result = await pool.query(query, [walletAddress]);

      if (result.rows.length === 0) {
        return this.getDefaultPreferences();
      }

      return result.rows[0].preferences || this.getDefaultPreferences();

    } catch (error) {
      logger.error('Failed to get user preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  getDefaultPreferences() {
    return {
      theme: 'dark',
      emailNotifications: true,
      pushNotifications: true,
      marketUpdates: true,
      priceAlerts: true,
      profileVisibility: 'public',
      language: 'en',
      currency: 'USD',
      timezone: 'UTC'
    };
  }

  async getStatus() {
    return {
      initialized: this.initialized,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new UserProfileService();