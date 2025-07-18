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
      // Initialize providers
      this.l1Provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_SEPOLIA_RPC_URL);
      this.l2Provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);

      // Initialize bridge contracts
      this.l1Bridge = new ethers.Contract(
        process.env.MANTLE_BRIDGE_L1_ADDRESS,
        L1_BRIDGE_ABI,
        this.l1Provider
      );

      this.l2Bridge = new ethers.Contract(
        process.env.MANTLE_BRIDGE_L2_ADDRESS,
        L2_BRIDGE_ABI,
        this.l2Provider
      );

      // Set up event listeners
      await this.setupEventListeners();

      this.initialized = true;
      logger.info('Native bridge service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize native bridge service:', error);
      throw error;
    }
  }

  async setupEventListeners() {
    // L1 (Ethereum Sepolia) event listeners
    this.l1Bridge.on('ETHDepositInitiated', async (from, to, amount, extraData, event) => {
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
    });

    this.l1Bridge.on('ERC20DepositInitiated', async (l1Token, l2Token, from, to, amount, extraData, event) => {
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
    });

    // L2 (Mantle Sepolia) event listeners
    this.l2Bridge.on('WithdrawalInitiated', async (l1Token, l2Token, from, to, amount, extraData, event) => {
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
    });

    this.l2Bridge.on('DepositFinalized', async (l1Token, l2Token, from, to, amount, extraData, event) => {
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
    });
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
}

module.exports = new NativeBridgeService();