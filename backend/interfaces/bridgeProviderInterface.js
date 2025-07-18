/**
 * Bridge Provider Interface
 *
 * This interface defines the standard methods that all bridge providers must implement.
 * It allows for a pluggable bridge system where different bridge providers can be easily
 * integrated and switched between.
 */

class BridgeProviderInterface {
  constructor(config) {
    this.config = config;
    this.name = config.name;
    this.initialized = false;
  }

  /**
   * Initialize the bridge provider
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by bridge provider');
  }

  /**
   * Get list of supported chains
   * @returns {Promise<Array<Object>>} Array of supported chain objects
   */
  async getSupportedChains() {
    throw new Error('getSupportedChains() must be implemented by bridge provider');
  }

  /**
   * Get bridge quote for a specific route
   * @param {Object} params - Quote parameters
   * @param {string} params.sourceChain - Source chain identifier
   * @param {string} params.destinationChain - Destination chain identifier
   * @param {string} params.token - Token address or symbol
   * @param {string} params.amount - Amount to bridge
   * @returns {Promise<Object>} Quote object with fees and estimated time
   */
  async getQuote(params) {
    throw new Error('getQuote() must be implemented by bridge provider');
  }

  /**
   * Execute a bridge transaction
   * @param {Object} params - Bridge parameters
   * @param {string} params.userAddress - User's wallet address
   * @param {string} params.sourceChain - Source chain identifier
   * @param {string} params.destinationChain - Destination chain identifier
   * @param {string} params.token - Token address or symbol
   * @param {string} params.amount - Amount to bridge
   * @param {Object} params.options - Additional options (gas limit, etc.)
   * @returns {Promise<Object>} Bridge transaction result
   */
  async executeBridge(params) {
    throw new Error('executeBridge() must be implemented by bridge provider');
  }

  /**
   * Get bridge transaction status
   * @param {string} bridgeId - Bridge transaction ID
   * @returns {Promise<Object>} Bridge status object
   */
  async getBridgeStatus(bridgeId) {
    throw new Error('getBridgeStatus() must be implemented by bridge provider');
  }

  /**
   * Get user's bridge history
   * @param {string} userAddress - User's wallet address
   * @param {number} limit - Number of records to return
   * @returns {Promise<Array<Object>>} Array of bridge history records
   */
  async getUserBridgeHistory(userAddress, limit = 50) {
    throw new Error('getUserBridgeHistory() must be implemented by bridge provider');
  }

  /**
   * Get bridge statistics
   * @returns {Promise<Object>} Bridge statistics object
   */
  async getBridgeStats() {
    throw new Error('getBridgeStats() must be implemented by bridge provider');
  }

  /**
   * Get bridge provider health status
   * @returns {Promise<Object>} Health status object
   */
  async getHealthStatus() {
    throw new Error('getHealthStatus() must be implemented by bridge provider');
  }

  /**
   * Stop the bridge provider and clean up resources
   * @returns {Promise<void>}
   */
  async stop() {
    throw new Error('stop() must be implemented by bridge provider');
  }

  /**
   * Validate bridge parameters
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validateBridgeParams(params) {
    const errors = [];

    if (!params.userAddress) {
      errors.push('userAddress is required');
    }

    if (!params.sourceChain) {
      errors.push('sourceChain is required');
    }

    if (!params.destinationChain) {
      errors.push('destinationChain is required');
    }

    if (!params.token) {
      errors.push('token is required');
    }

    if (!params.amount || parseFloat(params.amount) <= 0) {
      errors.push('amount must be a positive number');
    }

    if (params.sourceChain === params.destinationChain) {
      errors.push('sourceChain and destinationChain must be different');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format bridge result for consistent response
   * @param {Object} bridgeData - Raw bridge data
   * @returns {Object} Formatted bridge result
   */
  formatBridgeResult(bridgeData) {
    return {
      bridgeId: bridgeData.id,
      provider: this.name,
      status: bridgeData.status,
      sourceChain: bridgeData.sourceChain,
      destinationChain: bridgeData.destinationChain,
      amount: bridgeData.amount,
      token: bridgeData.token,
      fees: bridgeData.fees,
      estimatedTime: bridgeData.estimatedTime,
      sourceTxHash: bridgeData.sourceTxHash,
      destinationTxHash: bridgeData.destinationTxHash,
      createdAt: bridgeData.createdAt,
      updatedAt: bridgeData.updatedAt,
      completedAt: bridgeData.completedAt
    };
  }

  /**
   * Log bridge event
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional log data
   */
  log(level, message, data = {}) {
    const logger = require('../utils/logger');
    logger[level](`[${this.name}] ${message}`, data);
  }
}

module.exports = BridgeProviderInterface;