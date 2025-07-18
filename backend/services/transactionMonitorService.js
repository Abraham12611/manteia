const { ethers } = require('ethers');
const axios = require('axios');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const databaseService = require('../config/database');
const receiptService = require('./receiptService');

class TransactionMonitorService extends EventEmitter {
  constructor() {
    super();
    this.provider = null;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.pendingTransactions = new Map();
    this.blockConfirmationCount = parseInt(process.env.BLOCK_CONFIRMATION_COUNT) || 3;
    this.monitorInterval = parseInt(process.env.TRANSACTION_MONITOR_INTERVAL_MS) || 5000;
  }

  async initialize() {
    try {
      // Initialize Mantle Sepolia provider
      this.provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);

      // Test provider connection
      const network = await this.provider.getNetwork();
      const latestBlock = await this.provider.getBlockNumber();

      logger.blockchain('Transaction monitor initialized', {
        chainId: network.chainId.toString(),
        networkName: network.name,
        latestBlock: latestBlock,
        rpcUrl: process.env.MANTLE_SEPOLIA_RPC_URL
      });

      // Set up event listeners for real-time monitoring
      this.setupEventListeners();

      return true;
    } catch (error) {
      logger.error('Failed to initialize transaction monitor:', error);
      throw new Error(`Transaction monitor initialization failed: ${error.message}`);
    }
  }

  setupEventListeners() {
    // Listen for new blocks
    this.provider.on('block', async (blockNumber) => {
      logger.blockchain(`New block detected: ${blockNumber}`);
      await this.processNewBlock(blockNumber);
    });

    // Listen for pending transactions (if supported by provider)
    this.provider.on('pending', (txHash) => {
      logger.blockchain(`Pending transaction detected: ${txHash}`);
      this.addPendingTransaction(txHash);
    });
  }

  /**
   * Start the transaction monitoring service
   * (Alias for startMonitoring for compatibility)
   */
  async start() {
    return await this.startMonitoring();
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Transaction monitoring is already active');
      return;
    }

    try {
      this.isMonitoring = true;

      // Start periodic monitoring for pending transactions
      this.monitoringInterval = setInterval(async () => {
        await this.checkPendingTransactions();
      }, this.monitorInterval);

      // Load pending transactions from database
      await this.loadPendingTransactionsFromDB();

      logger.transaction('Transaction monitoring started', {
        interval: this.monitorInterval,
        confirmations: this.blockConfirmationCount
      });
    } catch (error) {
      logger.error('Failed to start transaction monitoring:', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop the transaction monitoring service
   * (Alias for stopMonitoring for compatibility)
   */
  async stop() {
    return await this.stopMonitoring();
  }

  async stopMonitoring() {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Remove all event listeners
    this.provider.removeAllListeners();

    logger.transaction('Transaction monitoring stopped');
  }

  async addTransaction(transactionData) {
    try {
      const {
        userId,
        transactionHash,
        transactionType,
        fromAddress,
        toAddress,
        value = '0',
        chainId = process.env.MANTLE_SEPOLIA_CHAIN_ID
      } = transactionData;

      // Insert transaction into database
      const query = `
        INSERT INTO transactions (
          user_id, transaction_hash, chain_id, from_address, to_address,
          value, status, transaction_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, created_at
      `;

      const values = [
        userId,
        transactionHash,
        parseInt(chainId),
        fromAddress,
        toAddress,
        value,
        'pending',
        transactionType
      ];

      const result = await databaseService.query(query, values);
      const transactionId = result.rows[0].id;

      // Add to pending transactions map for monitoring
      this.pendingTransactions.set(transactionHash, {
        id: transactionId,
        userId,
        type: transactionType,
        addedAt: Date.now()
      });

      logger.transaction('Transaction added for monitoring', {
        transactionId,
        hash: transactionHash,
        type: transactionType,
        user: userId
      });

      return transactionId;
    } catch (error) {
      logger.error('Failed to add transaction:', error);
      throw error;
    }
  }

  async processTransaction(transactionHash) {
    try {
      // Get transaction details from blockchain
      const [transaction, receipt] = await Promise.all([
        this.provider.getTransaction(transactionHash),
        this.provider.getTransactionReceipt(transactionHash)
      ]);

      if (!transaction) {
        logger.warn(`Transaction not found: ${transactionHash}`);
        return null;
      }

      const isConfirmed = receipt && receipt.confirmations >= this.blockConfirmationCount;
      const status = receipt
        ? (receipt.status === 1 ? 'confirmed' : 'failed')
        : 'pending';

      // Update transaction in database
      const updateQuery = `
        UPDATE transactions
        SET
          block_number = $1,
          transaction_index = $2,
          gas_used = $3,
          gas_price = $4,
          transaction_fee = $5,
          status = $6,
          confirmed_at = $7,
          receipt_data = $8,
          updated_at = NOW()
        WHERE transaction_hash = $9
        RETURNING id, user_id, transaction_type
      `;

      const updateValues = [
        receipt?.blockNumber || null,
        receipt?.transactionIndex || null,
        receipt?.gasUsed?.toString() || null,
        transaction.gasPrice?.toString() || null,
        receipt ? (receipt.gasUsed * transaction.gasPrice).toString() : null,
        status,
        isConfirmed ? new Date() : null,
        receipt ? JSON.stringify(receipt) : null,
        transactionHash
      ];

      const updateResult = await databaseService.query(updateQuery, updateValues);

      if (updateResult.rows.length > 0) {
        const { id: transactionId, user_id: userId, transaction_type: transactionType } = updateResult.rows[0];

        // Generate receipt if transaction is confirmed
        if (status === 'confirmed') {
          await receiptService.generateReceipt({
            transactionId,
            transactionHash,
            userId,
            transactionType,
            transaction,
            receipt
          });

          // Remove from pending transactions
          this.pendingTransactions.delete(transactionHash);

          logger.transaction('Transaction confirmed and receipt generated', {
            transactionId,
            hash: transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString()
          });

          // Emit transaction update event
          this.emit('transactionUpdate', {
            transactionId,
            hash: transactionHash,
            status: 'confirmed',
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString(),
            userId,
            transactionType,
            receipt
          });
        } else if (status === 'failed') {
          this.pendingTransactions.delete(transactionHash);
          logger.transaction('Transaction failed', {
            transactionId,
            hash: transactionHash,
            blockNumber: receipt.blockNumber
          });

          // Emit transaction update event for failed transaction
          this.emit('transactionUpdate', {
            transactionId,
            hash: transactionHash,
            status: 'failed',
            blockNumber: receipt.blockNumber,
            userId,
            transactionType,
            receipt
          });
        }

        return updateResult.rows[0];
      }

      return null;
    } catch (error) {
      logger.error(`Failed to process transaction ${transactionHash}:`, error);
      throw error;
    }
  }

  async checkPendingTransactions() {
    if (this.pendingTransactions.size === 0) {
      return;
    }

    logger.blockchain(`Checking ${this.pendingTransactions.size} pending transactions`);

    const transactionPromises = Array.from(this.pendingTransactions.keys()).map(async (txHash) => {
      try {
        await this.processTransaction(txHash);
      } catch (error) {
        logger.error(`Error processing pending transaction ${txHash}:`, error);
      }
    });

    await Promise.allSettled(transactionPromises);

    // Clean up old pending transactions (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [txHash, data] of this.pendingTransactions.entries()) {
      if (data.addedAt < oneHourAgo) {
        logger.warn(`Removing stale pending transaction: ${txHash}`);
        this.pendingTransactions.delete(txHash);

        // Mark as failed in database
        await databaseService.query(
          'UPDATE transactions SET status = $1, updated_at = NOW() WHERE transaction_hash = $2',
          ['failed', txHash]
        );
      }
    }
  }

  async processNewBlock(blockNumber) {
    try {
      const block = await this.provider.getBlock(blockNumber, true);

      if (!block || !block.transactions) {
        return;
      }

      // Check if any of our pending transactions are in this block
      const relevantTransactions = block.transactions.filter(tx =>
        this.pendingTransactions.has(tx.hash)
      );

      if (relevantTransactions.length > 0) {
        logger.blockchain(`Found ${relevantTransactions.length} relevant transactions in block ${blockNumber}`);

        for (const tx of relevantTransactions) {
          await this.processTransaction(tx.hash);
        }
      }
    } catch (error) {
      logger.error(`Error processing block ${blockNumber}:`, error);
    }
  }

  async loadPendingTransactionsFromDB() {
    try {
      const query = `
        SELECT id, transaction_hash, user_id, transaction_type, created_at
        FROM transactions
        WHERE status = 'pending'
        AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
      `;

      const result = await databaseService.query(query);

      for (const row of result.rows) {
        this.pendingTransactions.set(row.transaction_hash, {
          id: row.id,
          userId: row.user_id,
          type: row.transaction_type,
          addedAt: new Date(row.created_at).getTime()
        });
      }

      logger.transaction('Loaded pending transactions from database', {
        count: result.rows.length
      });
    } catch (error) {
      logger.error('Failed to load pending transactions from database:', error);
    }
  }

  addPendingTransaction(transactionHash) {
    if (!this.pendingTransactions.has(transactionHash)) {
      this.pendingTransactions.set(transactionHash, {
        addedAt: Date.now(),
        fromProvider: true
      });
    }
  }

  async getTransactionStatus(transactionHash) {
    try {
      // First check database
      const dbQuery = 'SELECT * FROM transactions WHERE transaction_hash = $1';
      const dbResult = await databaseService.query(dbQuery, [transactionHash]);

      if (dbResult.rows.length > 0) {
        const dbTransaction = dbResult.rows[0];

        // If confirmed in database, return database info
        if (dbTransaction.status === 'confirmed') {
          return {
            status: 'confirmed',
            blockNumber: dbTransaction.block_number,
            confirmations: dbTransaction.block_number ?
              (await this.provider.getBlockNumber()) - dbTransaction.block_number : 0,
            transaction: dbTransaction
          };
        }
      }

      // Check blockchain for latest status
      const receipt = await this.provider.getTransactionReceipt(transactionHash);

      if (receipt) {
        const currentBlock = await this.provider.getBlockNumber();
        const confirmations = currentBlock - receipt.blockNumber;

        return {
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          blockNumber: receipt.blockNumber,
          confirmations,
          isConfirmed: confirmations >= this.blockConfirmationCount,
          receipt
        };
      }

      return {
        status: 'pending',
        confirmations: 0,
        isConfirmed: false
      };
    } catch (error) {
      logger.error(`Failed to get transaction status for ${transactionHash}:`, error);
      throw error;
    }
  }

  async getHealthStatus() {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();

      return {
        status: 'healthy',
        isMonitoring: this.isMonitoring,
        latestBlock,
        chainId: network.chainId.toString(),
        pendingTransactions: this.pendingTransactions.size,
        monitorInterval: this.monitorInterval,
        confirmationsRequired: this.blockConfirmationCount
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        isMonitoring: this.isMonitoring
      };
    }
  }
}

// Create singleton instance
const transactionMonitorService = new TransactionMonitorService();

module.exports = transactionMonitorService;