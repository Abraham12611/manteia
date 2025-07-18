const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const userProfileService = require('../services/userProfileService');
const logger = require('../utils/logger');

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

// Get user profile
router.get('/:walletAddress',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { walletAddress } = req.params;

      const profile = await userProfileService.getUserProfile(walletAddress);

      res.json({
        success: true,
        data: profile,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get user profile:', error);

      if (error.message === 'User not found') {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'PROFILE_ERROR',
            message: 'Failed to get user profile',
            details: error.message
          }
        });
      }
    }
  }
);

// Update user profile
router.put('/:walletAddress',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('username').optional().isString().isLength({ min: 1, max: 50 }).withMessage('Username must be 1-50 characters'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('bio').optional().isString().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
    body('avatarUrl').optional().isURL().withMessage('Invalid avatar URL'),
    body('preferences').optional().isObject().withMessage('Preferences must be an object'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const updates = req.body;

      const updatedProfile = await userProfileService.updateUserProfile(walletAddress, updates);

      res.json({
        success: true,
        data: updatedProfile,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to update user profile:', error);

      if (error.message === 'User not found') {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'PROFILE_UPDATE_ERROR',
            message: 'Failed to update user profile',
            details: error.message
          }
        });
      }
    }
  }
);

// Get user positions
router.get('/:walletAddress/positions',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    query('status').optional().isIn(['active', 'resolved', 'cancelled']).withMessage('Invalid status'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('minAmount').optional().isFloat({ min: 0 }).withMessage('Min amount must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const filters = {
        status: req.query.status,
        category: req.query.category,
        minAmount: req.query.minAmount,
        limit: parseInt(req.query.limit) || 50
      };

      // Get user ID first
      const profile = await userProfileService.getUserProfile(walletAddress);
      const positions = await userProfileService.getUserPositions(profile.id, filters);

      res.json({
        success: true,
        data: {
          positions,
          count: positions.length,
          filters: filters
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get user positions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'POSITIONS_ERROR',
          message: 'Failed to get user positions',
          details: error.message
        }
      });
    }
  }
);

// Get user activity
router.get('/:walletAddress/activity',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    query('type').optional().isIn(['buy', 'sell', 'redeem']).withMessage('Invalid transaction type'),
    query('minAmount').optional().isFloat({ min: 0 }).withMessage('Min amount must be positive'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const filters = {
        type: req.query.type,
        minAmount: req.query.minAmount,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        limit: parseInt(req.query.limit) || 50
      };

      // Get user ID first
      const profile = await userProfileService.getUserProfile(walletAddress);
      const activity = await userProfileService.getUserActivity(profile.id, filters);

      res.json({
        success: true,
        data: {
          activity,
          count: activity.length,
          filters: filters
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get user activity:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ACTIVITY_ERROR',
          message: 'Failed to get user activity',
          details: error.message
        }
      });
    }
  }
);

// Get user statistics
router.get('/:walletAddress/statistics',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { walletAddress } = req.params;

      const profile = await userProfileService.getUserProfile(walletAddress);
      const rankings = await userProfileService.getUserRankings(profile.id);

      res.json({
        success: true,
        data: {
          statistics: profile.statistics,
          rankings: rankings
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get user statistics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATISTICS_ERROR',
          message: 'Failed to get user statistics',
          details: error.message
        }
      });
    }
  }
);

// Get user preferences
router.get('/:walletAddress/preferences',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { walletAddress } = req.params;

      const preferences = await userProfileService.getUserPreferences(walletAddress);

      res.json({
        success: true,
        data: preferences,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get user preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PREFERENCES_ERROR',
          message: 'Failed to get user preferences',
          details: error.message
        }
      });
    }
  }
);

// Update user preferences
router.put('/:walletAddress/preferences',
  [
    param('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('theme').optional().isIn(['light', 'dark', 'auto']).withMessage('Invalid theme'),
    body('emailNotifications').optional().isBoolean().withMessage('Email notifications must be boolean'),
    body('pushNotifications').optional().isBoolean().withMessage('Push notifications must be boolean'),
    body('marketUpdates').optional().isBoolean().withMessage('Market updates must be boolean'),
    body('priceAlerts').optional().isBoolean().withMessage('Price alerts must be boolean'),
    body('profileVisibility').optional().isIn(['public', 'private']).withMessage('Invalid profile visibility'),
    body('language').optional().isString().withMessage('Language must be a string'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('timezone').optional().isString().withMessage('Timezone must be a string'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const preferences = req.body;

      const updatedProfile = await userProfileService.updateUserProfile(walletAddress, {
        preferences: preferences
      });

      res.json({
        success: true,
        data: updatedProfile,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to update user preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PREFERENCES_UPDATE_ERROR',
          message: 'Failed to update user preferences',
          details: error.message
        }
      });
    }
  }
);

// Get leaderboard
router.get('/leaderboard/:category',
  [
    param('category').isIn(['volume', 'profit', 'accuracy', 'streak']).withMessage('Invalid leaderboard category'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('timeframe').optional().isIn(['all', 'month', 'week', 'day']).withMessage('Invalid timeframe'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { category } = req.params;
      const { limit = 50, timeframe = 'all' } = req.query;

      const pool = require('../config/database').getPool();

      let orderBy = '';
      let timeFilter = '';

      switch (category) {
        case 'volume':
          orderBy = 'total_volume DESC';
          break;
        case 'profit':
          orderBy = 'total_profit_loss DESC';
          break;
        case 'accuracy':
          orderBy = 'win_rate DESC';
          break;
        case 'streak':
          orderBy = 'total_positions DESC'; // Placeholder
          break;
      }

      if (timeframe !== 'all') {
        const timeMap = {
          'day': '1 day',
          'week': '7 days',
          'month': '30 days'
        };
        timeFilter = `AND created_at >= NOW() - INTERVAL '${timeMap[timeframe]}'`;
      }

      const leaderboardQuery = `
        SELECT
          wallet_address,
          username,
          avatar_url,
          total_volume,
          total_profit_loss,
          win_rate,
          total_positions,
          total_markets_traded,
          reputation_score,
          ROW_NUMBER() OVER (ORDER BY ${orderBy}) as rank
        FROM users
        WHERE total_volume > 0 ${timeFilter}
        ORDER BY ${orderBy}
        LIMIT $1
      `;

      const result = await pool.query(leaderboardQuery, [limit]);

      const leaderboard = result.rows.map(row => ({
        rank: parseInt(row.rank),
        walletAddress: row.wallet_address,
        username: row.username,
        avatarUrl: row.avatar_url,
        totalVolume: parseFloat(row.total_volume || 0),
        totalProfitLoss: parseFloat(row.total_profit_loss || 0),
        winRate: parseFloat(row.win_rate || 0),
        totalPositions: parseInt(row.total_positions || 0),
        totalMarketsTraded: parseInt(row.total_markets_traded || 0),
        reputationScore: parseFloat(row.reputation_score || 0)
      }));

      res.json({
        success: true,
        data: {
          leaderboard,
          category,
          timeframe,
          count: leaderboard.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get leaderboard:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LEADERBOARD_ERROR',
          message: 'Failed to get leaderboard',
          details: error.message
        }
      });
    }
  }
);

// Profile service health check
router.get('/health/status', async (req, res) => {
  try {
    const status = await userProfileService.getStatus();

    res.json({
      success: true,
      data: {
        service: 'user-profile',
        status: status.initialized ? 'healthy' : 'unhealthy',
        details: status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get profile service health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_HEALTH_ERROR',
        message: 'Failed to get profile service health',
        details: error.message
      }
    });
  }
});

module.exports = router;