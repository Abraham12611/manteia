const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const databaseService = require('../config/database');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * POST /api/users
 * Create or update user
 */
router.post('/',
  [
    body('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address'),
    body('email').optional().isEmail().withMessage('Invalid email address'),
    body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { walletAddress, email, username } = req.body;

      // Check if user already exists
      const existingQuery = 'SELECT id, wallet_address FROM users WHERE wallet_address = $1';
      const existing = await databaseService.query(existingQuery, [walletAddress]);

      if (existing.rows.length > 0) {
        return res.status(200).json({
          success: true,
          message: 'User already exists',
          data: {
            userId: existing.rows[0].id,
            walletAddress: existing.rows[0].wallet_address,
            isNew: false
          },
          timestamp: new Date().toISOString()
        });
      }

      // Create new user
      const insertQuery = `
        INSERT INTO users (wallet_address, email, username, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, wallet_address, email, username, created_at
      `;

      const result = await databaseService.query(insertQuery, [walletAddress, email, username]);
      const user = result.rows[0];

      logger.api('New user created', {
        userId: user.id,
        walletAddress: user.wallet_address
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          userId: user.id,
          walletAddress: user.wallet_address,
          email: user.email,
          username: user.username,
          createdAt: user.created_at,
          isNew: true
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to create user:', error);
      res.status(500).json({
        error: 'Failed to create user',
        code: 'USER_CREATE_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/users/wallet/:walletAddress
 * Get user by wallet address
 */
router.get('/wallet/:walletAddress',
  [
    param('walletAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid wallet address')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { walletAddress } = req.params;

      const query = `
        SELECT
          id,
          wallet_address,
          smart_account_address,
          email,
          username,
          created_at,
          is_active,
          kyc_status
        FROM users
        WHERE wallet_address = $1
      `;

      const result = await databaseService.query(query, [walletAddress]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      const user = result.rows[0];

      logger.api('User retrieved by wallet address', {
        userId: user.id,
        walletAddress
      });

      res.json({
        success: true,
        data: user,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get user by wallet address:', error);
      res.status(500).json({
        error: 'Failed to get user',
        code: 'USER_GET_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/users/:userId/stats
 * Get user statistics
 */
router.get('/:userId/stats',
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Check if user exists
      const userQuery = 'SELECT id FROM users WHERE id = $1';
      const userResult = await databaseService.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      const queries = [
        'SELECT COUNT(*) as total_transactions FROM transactions WHERE user_id = $1',
        'SELECT COUNT(*) as pending_transactions FROM transactions WHERE user_id = $1 AND status = $2',
        'SELECT COUNT(*) as confirmed_transactions FROM transactions WHERE user_id = $1 AND status = $2',
        'SELECT COUNT(*) as failed_transactions FROM transactions WHERE user_id = $1 AND status = $2',
        'SELECT transaction_type, COUNT(*) as count FROM transactions WHERE user_id = $1 GROUP BY transaction_type',
        'SELECT COUNT(*) as total_receipts FROM transaction_receipts WHERE user_id = $1'
      ];

      const [total, pending, confirmed, failed, byType, receipts] = await Promise.all([
        databaseService.query(queries[0], [userId]),
        databaseService.query(queries[1], [userId, 'pending']),
        databaseService.query(queries[2], [userId, 'confirmed']),
        databaseService.query(queries[3], [userId, 'failed']),
        databaseService.query(queries[4], [userId]),
        databaseService.query(queries[5], [userId])
      ]);

      const stats = {
        transactions: {
          total: parseInt(total.rows[0].total_transactions),
          pending: parseInt(pending.rows[0].pending_transactions),
          confirmed: parseInt(confirmed.rows[0].confirmed_transactions),
          failed: parseInt(failed.rows[0].failed_transactions)
        },
        transactionsByType: byType.rows.reduce((acc, row) => {
          acc[row.transaction_type] = parseInt(row.count);
          return acc;
        }, {}),
        receipts: {
          total: parseInt(receipts.rows[0].total_receipts)
        }
      };

      logger.api('User statistics retrieved', {
        userId,
        totalTransactions: stats.transactions.total
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get user statistics:', error);
      res.status(500).json({
        error: 'Failed to get user statistics',
        code: 'USER_STATS_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * PUT /api/users/:userId
 * Update user information
 */
router.put('/:userId',
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID'),
    body('email').optional().isEmail().withMessage('Invalid email address'),
    body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
    body('smartAccountAddress').optional().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid smart account address')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { email, username, smartAccountAddress } = req.body;

      // Check if user exists
      const userQuery = 'SELECT id FROM users WHERE id = $1';
      const userResult = await databaseService.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        values.push(email);
        paramIndex++;
      }

      if (username !== undefined) {
        updates.push(`username = $${paramIndex}`);
        values.push(username);
        paramIndex++;
      }

      if (smartAccountAddress !== undefined) {
        updates.push(`smart_account_address = $${paramIndex}`);
        values.push(smartAccountAddress);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_UPDATE_FIELDS',
          timestamp: new Date().toISOString()
        });
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const updateQuery = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, wallet_address, smart_account_address, email, username, updated_at
      `;

      const result = await databaseService.query(updateQuery, values);
      const updatedUser = result.rows[0];

      logger.api('User updated', {
        userId,
        updatedFields: Object.keys(req.body)
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update user:', error);
      res.status(500).json({
        error: 'Failed to update user',
        code: 'USER_UPDATE_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;