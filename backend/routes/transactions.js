const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const transactionMonitorService = require('../services/transactionMonitorService');
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
 * POST /api/transactions
 * Add a new transaction for monitoring
 */
router.post('/',
  [
    body('userId').isUUID().withMessage('User ID must be a valid UUID'),
    body('transactionHash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash'),
    body('transactionType').isIn(['trade', 'deposit', 'withdrawal', 'bridge']).withMessage('Invalid transaction type'),
    body('fromAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid from address'),
    body('toAddress').matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid to address'),
    body('value').optional().isDecimal().withMessage('Value must be a decimal number'),
    body('chainId').optional().isInt().withMessage('Chain ID must be an integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        userId,
        transactionHash,
        transactionType,
        fromAddress,
        toAddress,
        value,
        chainId
      } = req.body;

      // Check if transaction already exists
      const existingQuery = 'SELECT id FROM transactions WHERE transaction_hash = $1';
      const existing = await databaseService.query(existingQuery, [transactionHash]);

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Transaction already exists',
          code: 'TRANSACTION_EXISTS',
          transactionId: existing.rows[0].id,
          timestamp: new Date().toISOString()
        });
      }

      // Add transaction to monitoring
      const transactionId = await transactionMonitorService.addTransaction({
        userId,
        transactionHash,
        transactionType,
        fromAddress,
        toAddress,
        value: value || '0',
        chainId: chainId || process.env.MANTLE_SEPOLIA_CHAIN_ID
      });

      logger.api('Transaction added for monitoring', {
        transactionId,
        transactionHash,
        userId,
        type: transactionType
      });

      res.status(201).json({
        success: true,
        message: 'Transaction added for monitoring',
        data: {
          transactionId,
          transactionHash,
          status: 'pending',
          monitoringStarted: true
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to add transaction:', error);
      res.status(500).json({
        error: 'Failed to add transaction',
        code: 'TRANSACTION_ADD_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/transactions/:hash/status
 * Get transaction status by hash
 */
router.get('/:hash/status',
  [
    param('hash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { hash } = req.params;

      const status = await transactionMonitorService.getTransactionStatus(hash);

      logger.api('Transaction status requested', {
        transactionHash: hash,
        status: status.status
      });

      res.json({
        success: true,
        data: {
          transactionHash: hash,
          ...status,
          explorerUrl: `${process.env.MANTLE_SEPOLIA_EXPLORER_URL}/tx/${hash}`
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get transaction status:', error);
      res.status(500).json({
        error: 'Failed to get transaction status',
        code: 'TRANSACTION_STATUS_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/transactions/user/:userId
 * Get user's transactions
 */
router.get('/user/:userId',
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    query('status').optional().isIn(['pending', 'confirmed', 'failed']).withMessage('Invalid status'),
    query('type').optional().isIn(['trade', 'deposit', 'withdrawal', 'bridge']).withMessage('Invalid type')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        limit = 50,
        offset = 0,
        status,
        type
      } = req.query;

      let query = `
        SELECT
          id,
          transaction_hash,
          chain_id,
          block_number,
          from_address,
          to_address,
          value,
          gas_used,
          transaction_fee,
          status,
          transaction_type,
          created_at,
          confirmed_at
        FROM transactions
        WHERE user_id = $1
      `;

      const queryParams = [userId];
      let paramIndex = 2;

      // Add status filter
      if (status) {
        query += ` AND status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      // Add type filter
      if (type) {
        query += ` AND transaction_type = $${paramIndex}`;
        queryParams.push(type);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(parseInt(limit), parseInt(offset));

      const result = await databaseService.query(query, queryParams);

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM transactions WHERE user_id = $1';
      const countParams = [userId];

      if (status) {
        countQuery += ' AND status = $2';
        countParams.push(status);
      }
      if (type) {
        const statusIndex = status ? 3 : 2;
        countQuery += ` AND transaction_type = $${statusIndex}`;
        countParams.push(type);
      }

      const countResult = await databaseService.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      const transactions = result.rows.map(tx => ({
        ...tx,
        explorerUrl: `${process.env.MANTLE_SEPOLIA_EXPLORER_URL}/tx/${tx.transaction_hash}`
      }));

      logger.api('User transactions retrieved', {
        userId,
        count: transactions.length,
        filters: { status, type, limit, offset }
      });

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + parseInt(limit)) < total
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get user transactions:', error);
      res.status(500).json({
        error: 'Failed to get user transactions',
        code: 'USER_TRANSACTIONS_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/transactions/:id
 * Get transaction details by ID
 */
router.get('/:id',
  [
    param('id').isUUID().withMessage('Transaction ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          t.*,
          tr.id as receipt_id,
          tr.receipt_type,
          tr.pdf_path
        FROM transactions t
        LEFT JOIN transaction_receipts tr ON t.id = tr.transaction_id
        WHERE t.id = $1
      `;

      const result = await databaseService.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Transaction not found',
          code: 'TRANSACTION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      const transaction = result.rows[0];

      // Parse receipt data if available
      if (transaction.receipt_data) {
        transaction.receipt_data = typeof transaction.receipt_data === 'string'
          ? JSON.parse(transaction.receipt_data)
          : transaction.receipt_data;
      }

      // Add explorer URL
      transaction.explorerUrl = `${process.env.MANTLE_SEPOLIA_EXPLORER_URL}/tx/${transaction.transaction_hash}`;

      // Get real-time status if transaction is still pending
      if (transaction.status === 'pending') {
        try {
          const liveStatus = await transactionMonitorService.getTransactionStatus(transaction.transaction_hash);
          transaction.liveStatus = liveStatus;
        } catch (error) {
          logger.warn('Failed to get live transaction status:', error);
        }
      }

      logger.api('Transaction details retrieved', {
        transactionId: id,
        hash: transaction.transaction_hash,
        status: transaction.status
      });

      res.json({
        success: true,
        data: transaction,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get transaction details:', error);
      res.status(500).json({
        error: 'Failed to get transaction details',
        code: 'TRANSACTION_DETAILS_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/transactions/:hash/retry
 * Retry processing a failed transaction
 */
router.post('/:hash/retry',
  [
    param('hash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { hash } = req.params;

      // Check if transaction exists and can be retried
      const query = 'SELECT id, status FROM transactions WHERE transaction_hash = $1';
      const result = await databaseService.query(query, [hash]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Transaction not found',
          code: 'TRANSACTION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      const transaction = result.rows[0];

      if (transaction.status === 'confirmed') {
        return res.status(400).json({
          error: 'Transaction is already confirmed',
          code: 'TRANSACTION_ALREADY_CONFIRMED',
          timestamp: new Date().toISOString()
        });
      }

      // Reset transaction status to pending and retry processing
      await databaseService.query(
        'UPDATE transactions SET status = $1, updated_at = NOW() WHERE transaction_hash = $2',
        ['pending', hash]
      );

      // Add back to pending transactions for monitoring
      transactionMonitorService.addPendingTransaction(hash);

      // Try to process immediately
      await transactionMonitorService.processTransaction(hash);

      logger.api('Transaction retry initiated', {
        transactionHash: hash,
        transactionId: transaction.id
      });

      res.json({
        success: true,
        message: 'Transaction retry initiated',
        data: {
          transactionHash: hash,
          status: 'pending'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to retry transaction:', error);
      res.status(500).json({
        error: 'Failed to retry transaction',
        code: 'TRANSACTION_RETRY_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/transactions/stats/summary
 * Get transaction statistics summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const queries = [
      'SELECT COUNT(*) as total FROM transactions',
      'SELECT COUNT(*) as pending FROM transactions WHERE status = $1',
      'SELECT COUNT(*) as confirmed FROM transactions WHERE status = $1',
      'SELECT COUNT(*) as failed FROM transactions WHERE status = $1',
      'SELECT transaction_type, COUNT(*) as count FROM transactions GROUP BY transaction_type',
      'SELECT DATE(created_at) as date, COUNT(*) as count FROM transactions WHERE created_at > NOW() - INTERVAL \'7 days\' GROUP BY DATE(created_at) ORDER BY date'
    ];

    const [total, pending, confirmed, failed, byType, byDate] = await Promise.all([
      databaseService.query(queries[0]),
      databaseService.query(queries[1], ['pending']),
      databaseService.query(queries[2], ['confirmed']),
      databaseService.query(queries[3], ['failed']),
      databaseService.query(queries[4]),
      databaseService.query(queries[5])
    ]);

    const stats = {
      totals: {
        total: parseInt(total.rows[0].total),
        pending: parseInt(pending.rows[0].pending),
        confirmed: parseInt(confirmed.rows[0].confirmed),
        failed: parseInt(failed.rows[0].failed)
      },
      byType: byType.rows.reduce((acc, row) => {
        acc[row.transaction_type] = parseInt(row.count);
        return acc;
      }, {}),
      last7Days: byDate.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      })),
      monitoringStatus: await transactionMonitorService.getHealthStatus()
    };

    logger.api('Transaction statistics retrieved');

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get transaction statistics:', error);
    res.status(500).json({
      error: 'Failed to get transaction statistics',
      code: 'TRANSACTION_STATS_FAILED',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;