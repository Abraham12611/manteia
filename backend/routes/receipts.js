const express = require('express');
const { param, query, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const logger = require('../utils/logger');
const receiptService = require('../services/receiptService');
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
 * GET /api/receipts/:receiptId
 * Get receipt by ID
 */
router.get('/:receiptId',
  [
    param('receiptId').isUUID().withMessage('Receipt ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { receiptId } = req.params;

      const receipt = await receiptService.getReceipt(receiptId);

      if (!receipt) {
        return res.status(404).json({
          error: 'Receipt not found',
          code: 'RECEIPT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      logger.api('Receipt retrieved', {
        receiptId,
        type: receipt.receipt_data.receiptType
      });

      res.json({
        success: true,
        data: {
          id: receipt.id,
          transactionId: receipt.transaction_id,
          transactionHash: receipt.transaction_hash,
          receiptType: receipt.receipt_type,
          receiptData: receipt.receipt_data,
          hasPdf: !!receipt.pdf_path,
          createdAt: receipt.created_at
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get receipt:', error);
      res.status(500).json({
        error: 'Failed to get receipt',
        code: 'RECEIPT_GET_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/receipts/user/:userId
 * Get user's receipts
 */
router.get('/user/:userId',
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    query('type').optional().isIn(['trading', 'deposit', 'withdrawal', 'bridge', 'generic']).withMessage('Invalid receipt type')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const {
        limit = 50,
        offset = 0,
        type
      } = req.query;

      let query = `
        SELECT
          tr.id,
          tr.transaction_id,
          tr.transaction_hash,
          tr.receipt_type,
          tr.receipt_data,
          tr.pdf_path,
          tr.created_at,
          t.status as transaction_status,
          t.transaction_type
        FROM transaction_receipts tr
        JOIN transactions t ON tr.transaction_id = t.id
        WHERE tr.user_id = $1
      `;

      const queryParams = [userId];
      let paramIndex = 2;

      // Add type filter
      if (type) {
        query += ` AND tr.receipt_type = $${paramIndex}`;
        queryParams.push(type);
        paramIndex++;
      }

      query += ` ORDER BY tr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(parseInt(limit), parseInt(offset));

      const result = await databaseService.query(query, queryParams);

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM transaction_receipts tr JOIN transactions t ON tr.transaction_id = t.id WHERE tr.user_id = $1';
      const countParams = [userId];

      if (type) {
        countQuery += ' AND tr.receipt_type = $2';
        countParams.push(type);
      }

      const countResult = await databaseService.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      const receipts = result.rows.map(receipt => ({
        id: receipt.id,
        transactionId: receipt.transaction_id,
        transactionHash: receipt.transaction_hash,
        receiptType: receipt.receipt_type,
        receiptData: typeof receipt.receipt_data === 'string'
          ? JSON.parse(receipt.receipt_data)
          : receipt.receipt_data,
        hasPdf: !!receipt.pdf_path,
        transactionStatus: receipt.transaction_status,
        transactionType: receipt.transaction_type,
        createdAt: receipt.created_at
      }));

      logger.api('User receipts retrieved', {
        userId,
        count: receipts.length,
        filters: { type, limit, offset }
      });

      res.json({
        success: true,
        data: {
          receipts,
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
      logger.error('Failed to get user receipts:', error);
      res.status(500).json({
        error: 'Failed to get user receipts',
        code: 'USER_RECEIPTS_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/receipts/:receiptId/pdf
 * Download receipt PDF
 */
router.get('/:receiptId/pdf',
  [
    param('receiptId').isUUID().withMessage('Receipt ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { receiptId } = req.params;

      const receipt = await receiptService.getReceipt(receiptId);

      if (!receipt) {
        return res.status(404).json({
          error: 'Receipt not found',
          code: 'RECEIPT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      if (!receipt.pdf_path) {
        return res.status(404).json({
          error: 'PDF not available for this receipt',
          code: 'RECEIPT_PDF_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Check if PDF file exists
      try {
        await fs.access(receipt.pdf_path);
      } catch (error) {
        logger.error('PDF file not found:', { receiptId, pdfPath: receipt.pdf_path });
        return res.status(404).json({
          error: 'PDF file not found',
          code: 'RECEIPT_PDF_FILE_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Set appropriate headers
      const fileName = `receipt_${receiptId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Stream the PDF file
      const fileBuffer = await fs.readFile(receipt.pdf_path);

      logger.api('Receipt PDF downloaded', {
        receiptId,
        fileName,
        fileSize: fileBuffer.length
      });

      res.send(fileBuffer);
    } catch (error) {
      logger.error('Failed to download receipt PDF:', error);
      res.status(500).json({
        error: 'Failed to download receipt PDF',
        code: 'RECEIPT_PDF_DOWNLOAD_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/receipts/:receiptId/verify
 * Verify receipt against blockchain
 */
router.post('/:receiptId/verify',
  [
    param('receiptId').isUUID().withMessage('Receipt ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { receiptId } = req.params;

      const verification = await receiptService.verifyReceipt(receiptId);

      logger.api('Receipt verification performed', {
        receiptId,
        verified: verification.verified
      });

      res.json({
        success: true,
        data: verification,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to verify receipt:', error);
      res.status(500).json({
        error: 'Failed to verify receipt',
        code: 'RECEIPT_VERIFICATION_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/receipts/:receiptId/regenerate-pdf
 * Regenerate PDF for existing receipt
 */
router.post('/:receiptId/regenerate-pdf',
  [
    param('receiptId').isUUID().withMessage('Receipt ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { receiptId } = req.params;

      const receipt = await receiptService.getReceipt(receiptId);

      if (!receipt) {
        return res.status(404).json({
          error: 'Receipt not found',
          code: 'RECEIPT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      if (!receiptService.pdfGenerationEnabled) {
        return res.status(400).json({
          error: 'PDF generation is disabled',
          code: 'PDF_GENERATION_DISABLED',
          timestamp: new Date().toISOString()
        });
      }

      // Regenerate PDF
      const pdfPath = await receiptService.generatePDFReceipt(receipt);

      logger.api('Receipt PDF regenerated', {
        receiptId,
        pdfPath
      });

      res.json({
        success: true,
        message: 'PDF regenerated successfully',
        data: {
          receiptId,
          pdfGenerated: true,
          pdfPath: path.basename(pdfPath)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to regenerate receipt PDF:', error);
      res.status(500).json({
        error: 'Failed to regenerate receipt PDF',
        code: 'RECEIPT_PDF_REGENERATION_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/receipts/transaction/:transactionHash
 * Get receipt by transaction hash
 */
router.get('/transaction/:transactionHash',
  [
    param('transactionHash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid transaction hash')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { transactionHash } = req.params;

      const query = `
        SELECT
          tr.id,
          tr.transaction_id,
          tr.transaction_hash,
          tr.receipt_type,
          tr.receipt_data,
          tr.pdf_path,
          tr.created_at,
          t.status as transaction_status,
          t.user_id
        FROM transaction_receipts tr
        JOIN transactions t ON tr.transaction_id = t.id
        WHERE tr.transaction_hash = $1
        ORDER BY tr.created_at DESC
        LIMIT 1
      `;

      const result = await databaseService.query(query, [transactionHash]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Receipt not found for this transaction',
          code: 'RECEIPT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      const receipt = result.rows[0];

      logger.api('Receipt retrieved by transaction hash', {
        transactionHash,
        receiptId: receipt.id
      });

      res.json({
        success: true,
        data: {
          id: receipt.id,
          transactionId: receipt.transaction_id,
          transactionHash: receipt.transaction_hash,
          receiptType: receipt.receipt_type,
          receiptData: typeof receipt.receipt_data === 'string'
            ? JSON.parse(receipt.receipt_data)
            : receipt.receipt_data,
          hasPdf: !!receipt.pdf_path,
          transactionStatus: receipt.transaction_status,
          createdAt: receipt.created_at
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get receipt by transaction hash:', error);
      res.status(500).json({
        error: 'Failed to get receipt by transaction hash',
        code: 'RECEIPT_BY_HASH_FAILED',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/receipts/stats/summary
 * Get receipt statistics summary
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const queries = [
      'SELECT COUNT(*) as total FROM transaction_receipts',
      'SELECT receipt_type, COUNT(*) as count FROM transaction_receipts GROUP BY receipt_type',
      'SELECT COUNT(*) as with_pdf FROM transaction_receipts WHERE pdf_path IS NOT NULL',
      'SELECT DATE(created_at) as date, COUNT(*) as count FROM transaction_receipts WHERE created_at > NOW() - INTERVAL \'7 days\' GROUP BY DATE(created_at) ORDER BY date'
    ];

    const [total, byType, withPdf, byDate] = await Promise.all([
      databaseService.query(queries[0]),
      databaseService.query(queries[1]),
      databaseService.query(queries[2]),
      databaseService.query(queries[3])
    ]);

    const stats = {
      totals: {
        total: parseInt(total.rows[0].total),
        withPdf: parseInt(withPdf.rows[0].with_pdf),
        pdfGenerationEnabled: receiptService.pdfGenerationEnabled
      },
      byType: byType.rows.reduce((acc, row) => {
        acc[row.receipt_type] = parseInt(row.count);
        return acc;
      }, {}),
      last7Days: byDate.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      }))
    };

    logger.api('Receipt statistics retrieved');

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get receipt statistics:', error);
    res.status(500).json({
      error: 'Failed to get receipt statistics',
      code: 'RECEIPT_STATS_FAILED',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;