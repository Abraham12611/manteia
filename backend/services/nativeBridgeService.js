const { ethers } = require('ethers');
const logger = require('../utils/logger');
const databaseService = require('../config/database');

// Mantle Bridge Contract ABIs (simplified for core functions)
const L1_BRIDGE_ABI = [
  'function depositETH(uint32 _minGasLimit, bytes calldata _extraData) external payable',
  'function depositERC20(address _l1Token, address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external',
  'function withdraw(address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external',
  'event ETHDepositInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)',
  'event ERC20DepositInitiated(address indexed l1Token, address indexed l2Token, address indexed from, address indexed to, uint256 amount, bytes extraData)',
  'event WithdrawalFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address indexed to, uint256 amount, bytes extraData)'
];

const L2_BRIDGE_ABI = [
  'function withdraw(address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external',
  'function withdrawTo(address _l2Token, address _to, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external',
  'event WithdrawalInitiated(address indexed l1Token, address indexed l2Token, address indexed from, address indexed to, uint256 amount, bytes extraData)',
  'event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address indexed to, uint256 amount, bytes extraData)'
];

class NativeBridgeService {
  constructor() {
    this.l1Provider = null;
    this.l2Provider = null;
    this.l1Bridge = null;
    this.l2Bridge = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Check required environment variables
      const requiredEnvVars = {
        ETHEREUM_SEPOLIA_RPC_URL: process.env.ETHEREUM_SEPOLIA_RPC_URL || process.env.ETHEREUM_RPC_URL,
        MANTLE_SEPOLIA_RPC_URL: process.env.MANTLE_SEPOLIA_RPC_URL,
        MANTLE_BRIDGE_L1_ADDRESS: process.env.MANTLE_BRIDGE_L1_ADDRESS || '0xc92470D7Ffa21473611ab6c6e2FcFB8637c8f330',
        MANTLE_BRIDGE_L2_ADDRESS: process.env.MANTLE_BRIDGE_L2_ADDRESS || '0x4200000000000000000000000000000000000010'
      };

      // Validate required variables
      const missingVars = Object.entries(requiredEnvVars)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (missingVars.length > 0) {
        logger.warn(`Missing environment variables for bridge service: ${missingVars.join(', ')}`);
        logger.warn('Bridge service will use default values where possible');
      }

      // Initialize providers with fallback URLs
      const ethereumRpcUrl = requiredEnvVars.ETHEREUM_SEPOLIA_RPC_URL ||
        'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID';
      const mantleRpcUrl = requiredEnvVars.MANTLE_SEPOLIA_RPC_URL ||
        'https://rpc.sepolia.mantle.xyz';

      this.l1Provider = new ethers.JsonRpcProvider(ethereumRpcUrl);
      this.l2Provider = new ethers.JsonRpcProvider(mantleRpcUrl);

      // Initialize bridge contracts with default addresses
      this.l1Bridge = new ethers.Contract(
        requiredEnvVars.MANTLE_BRIDGE_L1_ADDRESS,
        L1_BRIDGE_ABI,
        this.l1Provider
      );

      this.l2Bridge = new ethers.Contract(
        requiredEnvVars.MANTLE_BRIDGE_L2_ADDRESS,
        L2_BRIDGE_ABI,
        this.l2Provider
      );

      // Test connections
      try {
        await this.l1Provider.getNetwork();
        logger.info('L1 provider connected successfully');
      } catch (error) {
        logger.warn('Failed to connect to L1 provider:', error.message);
      }

      try {
        await this.l2Provider.getNetwork();
        logger.info('L2 provider connected successfully');
      } catch (error) {
        logger.warn('Failed to connect to L2 provider:', error.message);
      }

      // Set up event listeners (with error handling)
      await this.setupEventListeners();

      this.initialized = true;
      logger.info('Native bridge service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize native bridge service:', error);
      // Don't throw error - allow service to continue with limited functionality
      this.initialized = false;
    }
  }

  async setupEventListeners() {
    try {
      // Only set up event listeners if providers are properly initialized
      if (!this.l1Provider || !this.l2Provider || !this.l1Bridge || !this.l2Bridge) {
        logger.warn('Cannot setup event listeners - providers not properly initialized');
        return;
      }

      // L1 (Ethereum Sepolia) event listeners
      this.l1Bridge.on('ETHDepositInitiated', async (from, to, amount, extraData, event) => {
        try {
          logger.info('ETH deposit initiated on L1:', {
            from,
            to,
            amount: ethers.formatEther(amount),
            txHash: event.transactionHash
          });

          await this.handleDepositInitiated({
            from,
            to,
            amount,
            token: 'ETH',
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
            sourceChain: 'ethereum-sepolia',
            destinationChain: 'mantle-sepolia'
          });
        } catch (error) {
          logger.error('Error handling ETH deposit initiated:', error);
        }
      });

      this.l1Bridge.on('ERC20DepositInitiated', async (l1Token, l2Token, from, to, amount, extraData, event) => {
        try {
          logger.info('ERC20 deposit initiated on L1:', {
            l1Token,
            l2Token,
            from,
            to,
            amount: amount.toString(),
            txHash: event.transactionHash
          });

          await this.handleDepositInitiated({
            from,
            to,
            amount,
            l1Token,
            l2Token,
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
            sourceChain: 'ethereum-sepolia',
            destinationChain: 'mantle-sepolia'
          });
        } catch (error) {
          logger.error('Error handling ERC20 deposit initiated:', error);
        }
      });

      // L2 (Mantle Sepolia) event listeners
      this.l2Bridge.on('WithdrawalInitiated', async (l1Token, l2Token, from, to, amount, extraData, event) => {
        try {
          logger.info('Withdrawal initiated on L2:', {
            l1Token,
            l2Token,
            from,
            to,
            amount: amount.toString(),
            txHash: event.transactionHash
          });

          await this.handleWithdrawalInitiated({
            from,
            to,
            amount,
            l1Token,
            l2Token,
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
            sourceChain: 'mantle-sepolia',
            destinationChain: 'ethereum-sepolia'
          });
        } catch (error) {
          logger.error('Error handling withdrawal initiated:', error);
        }
      });

      this.l2Bridge.on('DepositFinalized', async (l1Token, l2Token, from, to, amount, extraData, event) => {
        try {
          logger.info('Deposit finalized on L2:', {
            l1Token,
            l2Token,
            from,
            to,
            amount: amount.toString(),
            txHash: event.transactionHash
          });

          await this.handleDepositFinalized({
            from,
            to,
            amount,
            l1Token,
            l2Token,
            txHash: event.transactionHash,
            blockNumber: event.blockNumber
          });
        } catch (error) {
          logger.error('Error handling deposit finalized:', error);
        }
      });

      logger.info('Event listeners setup completed');
    } catch (error) {
      logger.error('Failed to setup event listeners:', error);
      // Don't throw error - allow service to continue
    }
  }

  async bridgeToMantle(params) {
    const { userAddress, amount, token = 'ETH', minGasLimit = 200000 } = params;

    try {
      if (!this.initialized) {
        throw new Error('Bridge service not initialized');
      }

      logger.info('Initiating bridge to Mantle:', { userAddress, amount, token });

      // Create bridge record in database
      const bridgeRecord = await this.createBridgeRecord({
        userAddress,
        sourceChain: 'ethereum-sepolia',
        destinationChain: 'mantle-sepolia',
        amount,
        token,
        status: 'initiated'
      });

      // Prepare bridge data
      const bridgeData = {
        bridgeId: bridgeRecord.id,
        userAddress,
        amount,
        token,
        minGasLimit,
        extraData: ethers.solidityPacked(['bytes32'], [bridgeRecord.id])
      };

      logger.info('Bridge record created:', bridgeRecord.id);
      return {
        bridgeId: bridgeRecord.id,
        status: 'initiated',
        estimatedTime: '10-15 minutes',
        message: 'Bridge transaction initiated. Please complete the transaction in your wallet.'
      };

    } catch (error) {
      logger.error('Failed to initiate bridge to Mantle:', error);
      throw error;
    }
  }

  async bridgeFromMantle(params) {
    const { userAddress, amount, token = 'ETH', minGasLimit = 200000 } = params;

    try {
      if (!this.initialized) {
        throw new Error('Bridge service not initialized');
      }

      logger.info('Initiating bridge from Mantle:', { userAddress, amount, token });

      // Create bridge record in database
      const bridgeRecord = await this.createBridgeRecord({
        userAddress,
        sourceChain: 'mantle-sepolia',
        destinationChain: 'ethereum-sepolia',
        amount,
        token,
        status: 'initiated'
      });

      // Prepare bridge data
      const bridgeData = {
        bridgeId: bridgeRecord.id,
        userAddress,
        amount,
        token,
        minGasLimit,
        extraData: ethers.solidityPacked(['bytes32'], [bridgeRecord.id])
      };

      logger.info('Bridge record created:', bridgeRecord.id);
      return {
        bridgeId: bridgeRecord.id,
        status: 'initiated',
        estimatedTime: '7 days (challenge period)',
        message: 'Withdrawal initiated. Please wait for the challenge period to complete.'
      };

    } catch (error) {
      logger.error('Failed to initiate bridge from Mantle:', error);
      throw error;
    }
  }

  async getBridgeStatus(bridgeId) {
    try {
      const pool = databaseService.getPool();
      const query = `
        SELECT
          id,
          user_id,
          source_chain_id,
          destination_chain_id,
          source_amount,
          destination_amount,
          bridge_status,
          source_transaction_hash,
          destination_transaction_hash,
          created_at,
          completed_at,
          bridge_data
        FROM cross_chain_bridges
        WHERE id = $1
      `;

      const result = await pool.query(query, [bridgeId]);

      if (result.rows.length === 0) {
        throw new Error('Bridge transaction not found');
      }

      const bridge = result.rows[0];

      // Calculate progress based on status
      let progress = 0;
      let estimatedTimeRemaining = 'Unknown';

      switch (bridge.bridge_status) {
        case 'initiated':
          progress = 25;
          estimatedTimeRemaining = '10-15 minutes';
          break;
        case 'processing':
          progress = 50;
          estimatedTimeRemaining = '5-10 minutes';
          break;
        case 'challenge_period':
          progress = 75;
          estimatedTimeRemaining = '6-7 days';
          break;
        case 'completed':
          progress = 100;
          estimatedTimeRemaining = 'Completed';
          break;
        case 'failed':
          progress = 0;
          estimatedTimeRemaining = 'Failed';
          break;
      }

      return {
        bridgeId: bridge.id,
        status: bridge.bridge_status,
        progress,
        estimatedTimeRemaining,
        sourceChain: this.getChainName(bridge.source_chain_id),
        destinationChain: this.getChainName(bridge.destination_chain_id),
        amount: bridge.source_amount,
        sourceTxHash: bridge.source_transaction_hash,
        destinationTxHash: bridge.destination_transaction_hash,
        createdAt: bridge.created_at,
        completedAt: bridge.completed_at,
        bridgeData: bridge.bridge_data
      };

    } catch (error) {
      logger.error('Failed to get bridge status:', error);
      throw error;
    }
  }

  async handleDepositInitiated(params) {
    const { from, to, amount, txHash, blockNumber, sourceChain, destinationChain } = params;

    try {
      const pool = databaseService.getPool();

      // Update bridge record
      const updateQuery = `
        UPDATE cross_chain_bridges
        SET
          source_transaction_hash = $1,
          bridge_status = 'processing',
          bridge_data = COALESCE(bridge_data, '{}'::jsonb) || $2::jsonb
        WHERE source_transaction_hash IS NULL
          AND source_chain_id = $3
          AND destination_chain_id = $4
        RETURNING id
      `;

      const bridgeData = {
        sourceBlockNumber: blockNumber,
        depositInitiated: true,
        depositInitiatedAt: new Date().toISOString()
      };

      const result = await pool.query(updateQuery, [
        txHash,
        JSON.stringify(bridgeData),
        this.getChainId(sourceChain),
        this.getChainId(destinationChain)
      ]);

      if (result.rows.length > 0) {
        logger.info('Bridge deposit initiated and recorded:', {
          bridgeId: result.rows[0].id,
          txHash,
          sourceChain,
          destinationChain
        });
      }

    } catch (error) {
      logger.error('Failed to handle deposit initiated:', error);
    }
  }

  async handleWithdrawalInitiated(params) {
    const { from, to, amount, txHash, blockNumber, sourceChain, destinationChain } = params;

    try {
      const pool = databaseService.getPool();

      // Update bridge record
      const updateQuery = `
        UPDATE cross_chain_bridges
        SET
          source_transaction_hash = $1,
          bridge_status = 'challenge_period',
          bridge_data = COALESCE(bridge_data, '{}'::jsonb) || $2::jsonb
        WHERE source_transaction_hash IS NULL
          AND source_chain_id = $3
          AND destination_chain_id = $4
        RETURNING id
      `;

      const bridgeData = {
        sourceBlockNumber: blockNumber,
        withdrawalInitiated: true,
        withdrawalInitiatedAt: new Date().toISOString(),
        challengePeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      const result = await pool.query(updateQuery, [
        txHash,
        JSON.stringify(bridgeData),
        this.getChainId(sourceChain),
        this.getChainId(destinationChain)
      ]);

      if (result.rows.length > 0) {
        logger.info('Bridge withdrawal initiated and recorded:', {
          bridgeId: result.rows[0].id,
          txHash,
          sourceChain,
          destinationChain
        });
      }

    } catch (error) {
      logger.error('Failed to handle withdrawal initiated:', error);
    }
  }

  async handleDepositFinalized(params) {
    const { from, to, amount, txHash, blockNumber } = params;

    try {
      const pool = databaseService.getPool();

      // Update bridge record
      const updateQuery = `
        UPDATE cross_chain_bridges
        SET
          destination_transaction_hash = $1,
          bridge_status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          bridge_data = COALESCE(bridge_data, '{}'::jsonb) || $2::jsonb
        WHERE destination_transaction_hash IS NULL
          AND bridge_status = 'processing'
        RETURNING id
      `;

      const bridgeData = {
        destinationBlockNumber: blockNumber,
        depositFinalized: true,
        depositFinalizedAt: new Date().toISOString()
      };

      const result = await pool.query(updateQuery, [
        txHash,
        JSON.stringify(bridgeData)
      ]);

      if (result.rows.length > 0) {
        logger.info('Bridge deposit finalized and recorded:', {
          bridgeId: result.rows[0].id,
          txHash
        });
      }

    } catch (error) {
      logger.error('Failed to handle deposit finalized:', error);
    }
  }

  async createBridgeRecord(params) {
    const { userAddress, sourceChain, destinationChain, amount, token, status } = params;

    try {
      const pool = databaseService.getPool();

      // First, get or create user
      const userQuery = `
        INSERT INTO users (wallet_address)
        VALUES ($1)
        ON CONFLICT (wallet_address) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const userResult = await pool.query(userQuery, [userAddress]);
      const userId = userResult.rows[0].id;

      // Create bridge record
      const bridgeQuery = `
        INSERT INTO cross_chain_bridges (
          user_id,
          source_chain_id,
          destination_chain_id,
          source_token_address,
          destination_token_address,
          source_amount,
          bridge_provider,
          bridge_status,
          bridge_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at
      `;

      const bridgeData = {
        token,
        initiatedBy: userAddress,
        bridgeProvider: 'native-mantle'
      };

      const bridgeResult = await pool.query(bridgeQuery, [
        userId,
        this.getChainId(sourceChain),
        this.getChainId(destinationChain),
        token === 'ETH' ? '0x0000000000000000000000000000000000000000' : token,
        token === 'ETH' ? '0x0000000000000000000000000000000000000000' : token,
        amount,
        'native-mantle',
        status,
        JSON.stringify(bridgeData)
      ]);

      return {
        id: bridgeResult.rows[0].id,
        createdAt: bridgeResult.rows[0].created_at
      };

    } catch (error) {
      logger.error('Failed to create bridge record:', error);
      throw error;
    }
  }

  async getUserBridgeHistory(userAddress, limit = 50) {
    try {
      const pool = databaseService.getPool();

      const query = `
        SELECT
          b.id,
          b.source_chain_id,
          b.destination_chain_id,
          b.source_amount,
          b.destination_amount,
          b.bridge_status,
          b.source_transaction_hash,
          b.destination_transaction_hash,
          b.created_at,
          b.completed_at,
          b.bridge_data
        FROM cross_chain_bridges b
        JOIN users u ON b.user_id = u.id
        WHERE u.wallet_address = $1
        ORDER BY b.created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userAddress, limit]);

      return result.rows.map(bridge => ({
        id: bridge.id,
        sourceChain: this.getChainName(bridge.source_chain_id),
        destinationChain: this.getChainName(bridge.destination_chain_id),
        amount: bridge.source_amount,
        status: bridge.bridge_status,
        sourceTxHash: bridge.source_transaction_hash,
        destinationTxHash: bridge.destination_transaction_hash,
        createdAt: bridge.created_at,
        completedAt: bridge.completed_at,
        bridgeData: bridge.bridge_data
      }));

    } catch (error) {
      logger.error('Failed to get user bridge history:', error);
      throw error;
    }
  }

  getChainId(chainName) {
    const chainMapping = {
      'ethereum-sepolia': 11155111,
      'mantle-sepolia': 5003
    };
    return chainMapping[chainName] || 0;
  }

  getChainName(chainId) {
    const chainMapping = {
      11155111: 'ethereum-sepolia',
      5003: 'mantle-sepolia'
    };
    return chainMapping[chainId] || 'unknown';
  }

  async getBridgeQuote(params) {
    const { sourceChain, destinationChain, amount, token } = params;

    try {
      // For native bridge, fees are minimal (just gas costs)
      const baseFee = '0.001'; // ETH
      const estimatedGas = token === 'ETH' ? '100000' : '150000';

      // Get current gas prices
      const sourceGasPrice = await this.getGasPrice(sourceChain);
      const destinationGasPrice = await this.getGasPrice(destinationChain);

      const totalFee = (parseFloat(estimatedGas) * parseFloat(sourceGasPrice) / 1e18).toFixed(6);

      return {
        sourceChain,
        destinationChain,
        amount,
        token,
        estimatedFee: totalFee,
        estimatedTime: destinationChain === 'mantle-sepolia' ? '10-15 minutes' : '7 days',
        route: 'native-mantle-bridge'
      };

    } catch (error) {
      logger.error('Failed to get bridge quote:', error);
      throw error;
    }
  }

  async getGasPrice(chainName) {
    try {
      const provider = chainName === 'ethereum-sepolia' ? this.l1Provider : this.l2Provider;
      const feeData = await provider.getFeeData();
      return feeData.gasPrice.toString();
    } catch (error) {
      logger.error('Failed to get gas price:', error);
      return '20000000000'; // Default 20 gwei
    }
  }

  async getStatus() {
    return {
      initialized: this.initialized,
      l1Connected: this.l1Provider !== null,
      l2Connected: this.l2Provider !== null,
      bridgeContracts: {
        l1Bridge: this.l1Bridge?.target || null,
        l2Bridge: this.l2Bridge?.target || null
      }
    };
  }

  async stop() {
    try {
      if (this.l1Bridge) {
        this.l1Bridge.removeAllListeners();
      }
      if (this.l2Bridge) {
        this.l2Bridge.removeAllListeners();
      }

      this.initialized = false;
      logger.info('Native bridge service stopped');
    } catch (error) {
      logger.error('Failed to stop native bridge service:', error);
    }
  }

  // Required interface methods for BridgeManagerService compatibility

  /**
   * Get supported chains for this bridge provider
   * @returns {Promise<Array<Object>>} Array of supported chains
   */
  async getSupportedChains() {
    return [
      {
        id: 'ethereum-sepolia',
        chainId: 11155111,
        name: 'Ethereum Sepolia',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: [process.env.ETHEREUM_SEPOLIA_RPC_URL],
        blockExplorerUrls: ['https://sepolia.etherscan.io']
      },
      {
        id: 'mantle-sepolia',
        chainId: 5003,
        name: 'Mantle Sepolia',
        nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
        rpcUrls: [process.env.MANTLE_SEPOLIA_RPC_URL],
        blockExplorerUrls: ['https://sepolia.mantlescan.xyz']
      }
    ];
  }

  /**
   * Get quote for bridge operation (alias for getBridgeQuote)
   * @param {Object} params - Quote parameters
   * @returns {Promise<Object>} Quote object
   */
  async getQuote(params) {
    return await this.getBridgeQuote(params);
  }

  /**
   * Execute bridge operation
   * @param {Object} params - Bridge parameters
   * @returns {Promise<Object>} Bridge result
   */
  async executeBridge(params) {
    const { sourceChain, destinationChain, userAddress, amount, token } = params;

    try {
      // Determine bridge direction
      if (sourceChain === 'ethereum-sepolia' && destinationChain === 'mantle-sepolia') {
        return await this.bridgeToMantle({ userAddress, amount, token });
      } else if (sourceChain === 'mantle-sepolia' && destinationChain === 'ethereum-sepolia') {
        return await this.bridgeFromMantle({ userAddress, amount, token });
      } else {
        throw new Error(`Unsupported bridge route: ${sourceChain} -> ${destinationChain}`);
      }
    } catch (error) {
      logger.error('Failed to execute bridge:', error);
      throw error;
    }
  }

  /**
   * Get bridge statistics
   * @returns {Promise<Object>} Bridge statistics
   */
  async getBridgeStats() {
    try {
      const pool = databaseService.getPool();

      const query = `
        SELECT
          COUNT(*) as total_bridges,
          COUNT(CASE WHEN bridge_status = 'completed' THEN 1 END) as completed_bridges,
          COUNT(CASE WHEN bridge_status IN ('initiated', 'processing', 'challenge_period') THEN 1 END) as pending_bridges,
          COUNT(CASE WHEN bridge_status = 'failed' THEN 1 END) as failed_bridges,
          COALESCE(SUM(CAST(source_amount AS DECIMAL)), 0) as total_volume
        FROM cross_chain_bridges
        WHERE bridge_provider = 'native-mantle'
      `;

      const result = await pool.query(query);
      const stats = result.rows[0];

      return {
        totalBridges: parseInt(stats.total_bridges),
        completedBridges: parseInt(stats.completed_bridges),
        pendingBridges: parseInt(stats.pending_bridges),
        failedBridges: parseInt(stats.failed_bridges),
        totalVolume: stats.total_volume.toString()
      };

    } catch (error) {
      logger.error('Failed to get bridge stats:', error);
      return {
        totalBridges: 0,
        completedBridges: 0,
        pendingBridges: 0,
        failedBridges: 0,
        totalVolume: '0'
      };
    }
  }

  /**
   * Get health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    try {
      const status = await this.getStatus();
      return {
        ...status,
        healthy: status.initialized && status.l1Connected && status.l2Connected,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get health status:', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new NativeBridgeService();