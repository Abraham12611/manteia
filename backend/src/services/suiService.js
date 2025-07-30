import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { fromB64 } from '@mysten/sui.js/utils';
import crypto from 'crypto';

export class SuiService {
  constructor({ rpcUrl, privateKey, packageId, logger }) {
    this.rpcUrl = rpcUrl || getFullnodeUrl('testnet');
    this.packageId = packageId;
    this.logger = logger;

    // Initialize Sui client
    this.client = new SuiClient({ url: this.rpcUrl });

    // Initialize keypair if private key is provided
    if (privateKey) {
      this.keypair = Ed25519Keypair.fromSecretKey(fromB64(privateKey));
      this.address = this.keypair.getPublicKey().toSuiAddress();
    }

    // Contract modules
    this.modules = {
      escrow: `${packageId}::escrow`,
      resolver: `${packageId}::resolver`,
      utils: `${packageId}::utils`,
      batch_escrow: `${packageId}::batch_escrow`
    };

    this.logger.info('Sui service initialized', {
      rpcUrl: this.rpcUrl,
      address: this.address
    });
  }

  // Escrow Contract Methods
  async createEscrow(params) {
    try {
      const {
        coin,
        recipient,
        resolver,
        secret,
        duration,
        crossChainId,
        coinType = '0x2::sui::SUI'
      } = params;

      // Generate hash from secret
      const hash = crypto.createHash('sha256').update(secret).digest();

      const tx = new TransactionBlock();

      // Get current time
      const clock = tx.object('0x6');

      tx.moveCall({
        target: `${this.modules.escrow}::create_escrow`,
        typeArguments: [coinType],
        arguments: [
          tx.object(coin),
          tx.pure(recipient),
          tx.pure(resolver),
          tx.pure(Array.from(hash)),
          tx.pure(duration),
          tx.pure(Array.from(Buffer.from(crossChainId, 'hex'))),
          clock
        ]
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      this.logger.info('Escrow created on Sui', {
        digest: result.digest,
        crossChainId
      });

      return {
        digest: result.digest,
        escrowId: this.extractEscrowId(result),
        hash: hash.toString('hex'),
        crossChainId
      };
    } catch (error) {
      this.logger.error('Error creating Sui escrow:', error);
      throw new Error(`Failed to create Sui escrow: ${error.message}`);
    }
  }

  async claimEscrow(params) {
    try {
      const {
        escrowId,
        secret,
        coinType = '0x2::sui::SUI'
      } = params;

      const tx = new TransactionBlock();

      // Get current time
      const clock = tx.object('0x6');

      tx.moveCall({
        target: `${this.modules.escrow}::claim_with_secret`,
        typeArguments: [coinType],
        arguments: [
          tx.object(escrowId),
          tx.pure(Array.from(Buffer.from(secret, 'hex'))),
          clock
        ]
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      this.logger.info('Escrow claimed on Sui', {
        digest: result.digest,
        escrowId
      });

      return {
        digest: result.digest,
        secret: secret,
        claimer: this.address
      };
    } catch (error) {
      this.logger.error('Error claiming Sui escrow:', error);
      throw new Error(`Failed to claim Sui escrow: ${error.message}`);
    }
  }

  async cancelEscrow(params) {
    try {
      const {
        escrowId,
        coinType = '0x2::sui::SUI'
      } = params;

      const tx = new TransactionBlock();

      // Get current time
      const clock = tx.object('0x6');

      tx.moveCall({
        target: `${this.modules.escrow}::cancel_escrow`,
        typeArguments: [coinType],
        arguments: [
          tx.object(escrowId),
          clock
        ]
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      this.logger.info('Escrow cancelled on Sui', {
        digest: result.digest,
        escrowId
      });

      return {
        digest: result.digest,
        refundTo: this.address
      };
    } catch (error) {
      this.logger.error('Error cancelling Sui escrow:', error);
      throw new Error(`Failed to cancel Sui escrow: ${error.message}`);
    }
  }

  async getEscrowDetails(escrowId) {
    try {
      const escrow = await this.client.getObject({
        id: escrowId,
        options: { showContent: true }
      });

      if (!escrow.data) {
        throw new Error('Escrow not found');
      }

      const fields = escrow.data.content.fields;

      return {
        id: escrowId,
        sender: fields.sender,
        recipient: fields.recipient,
        resolver: fields.resolver,
        amount: fields.amount,
        hash: fields.hash,
        expiry: fields.expiry,
        crossChainId: fields.cross_chain_id,
        isClaimed: fields.is_claimed
      };
    } catch (error) {
      this.logger.error('Error getting escrow details:', error);
      throw new Error(`Failed to get escrow details: ${error.message}`);
    }
  }

  // Resolver Registry Methods
  async registerResolver(params) {
    try {
      const {
        registryId,
        resolverAddress,
        name,
        feeBps
      } = params;

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.modules.resolver}::register_resolver`,
        arguments: [
          tx.object(registryId),
          tx.pure(resolverAddress),
          tx.pure(Array.from(Buffer.from(name, 'utf8'))),
          tx.pure(feeBps)
        ]
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true
        }
      });

      this.logger.info('Resolver registered on Sui', {
        digest: result.digest,
        resolverAddress
      });

      return { digest: result.digest };
    } catch (error) {
      this.logger.error('Error registering resolver:', error);
      throw new Error(`Failed to register resolver: ${error.message}`);
    }
  }

  async updateResolverStats(params) {
    try {
      const {
        registryId,
        resolverAddress,
        volume,
        success,
        timestamp
      } = params;

      const tx = new TransactionBlock();

      tx.moveCall({
        target: `${this.modules.resolver}::update_resolver_stats`,
        arguments: [
          tx.object(registryId),
          tx.pure(resolverAddress),
          tx.pure(volume),
          tx.pure(success),
          tx.pure(timestamp)
        ]
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true
        }
      });

      this.logger.info('Resolver stats updated', {
        digest: result.digest,
        resolverAddress
      });

      return { digest: result.digest };
    } catch (error) {
      this.logger.error('Error updating resolver stats:', error);
      throw new Error(`Failed to update resolver stats: ${error.message}`);
    }
  }

  // Batch Escrow Methods for Partial Fills
  async createBatchEscrow(params) {
    try {
      const {
        coins,
        recipients,
        resolvers,
        amounts,
        parentHash,
        duration,
        crossChainId,
        coinType = '0x2::sui::SUI'
      } = params;

      const tx = new TransactionBlock();

      // Get current time
      const clock = tx.object('0x6');

      tx.moveCall({
        target: `${this.modules.batch_escrow}::create_batch_escrow`,
        typeArguments: [coinType],
        arguments: [
          tx.pure(coins.map(coin => tx.object(coin))),
          tx.pure(recipients),
          tx.pure(resolvers),
          tx.pure(amounts),
          tx.pure(Array.from(Buffer.from(parentHash, 'hex'))),
          tx.pure(duration),
          tx.pure(Array.from(Buffer.from(crossChainId, 'hex'))),
          clock
        ]
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true
        }
      });

      this.logger.info('Batch escrow created on Sui', {
        digest: result.digest,
        batchSize: coins.length
      });

      return {
        digest: result.digest,
        batchId: this.extractBatchId(result),
        crossChainId
      };
    } catch (error) {
      this.logger.error('Error creating batch escrow:', error);
      throw new Error(`Failed to create batch escrow: ${error.message}`);
    }
  }

  // Event Monitoring
  async subscribeToEscrowEvents(callback) {
    try {
      this.logger.info('Subscribing to Sui escrow events');

      // Subscribe to events from our package
      const subscription = await this.client.subscribeEvent({
        filter: {
          Package: this.packageId
        },
        onMessage: (event) => {
          try {
            const eventType = event.type.split('::').pop();

            switch (eventType) {
              case 'EscrowCreated':
                this.handleEscrowCreated(event, callback);
                break;
              case 'EscrowClaimed':
                this.handleEscrowClaimed(event, callback);
                break;
              case 'EscrowCancelled':
                this.handleEscrowCancelled(event, callback);
                break;
              default:
                this.logger.debug('Unknown event type:', eventType);
            }
          } catch (error) {
            this.logger.error('Error processing Sui event:', error);
          }
        }
      });

      return subscription;
    } catch (error) {
      this.logger.error('Error subscribing to Sui events:', error);
      throw error;
    }
  }

  handleEscrowCreated(event, callback) {
    const data = event.parsedJson;
    callback({
      type: 'escrow_created',
      escrowId: data.escrow_id,
      sender: data.sender,
      recipient: data.recipient,
      resolver: data.resolver,
      amount: data.amount,
      hash: data.hash,
      expiry: data.expiry,
      crossChainId: Buffer.from(data.cross_chain_id).toString('hex'),
      timestamp: event.timestampMs
    });
  }

  handleEscrowClaimed(event, callback) {
    const data = event.parsedJson;
    callback({
      type: 'escrow_claimed',
      escrowId: data.escrow_id,
      claimer: data.claimer,
      secret: Buffer.from(data.secret).toString('hex'),
      amount: data.amount,
      timestamp: event.timestampMs
    });
  }

  handleEscrowCancelled(event, callback) {
    const data = event.parsedJson;
    callback({
      type: 'escrow_cancelled',
      escrowId: data.escrow_id,
      refundTo: data.refund_to,
      amount: data.amount,
      timestamp: event.timestampMs
    });
  }

  // Utility Methods
  extractEscrowId(result) {
    // Extract escrow object ID from transaction result
    const createdObjects = result.objectChanges?.filter(
      change => change.type === 'created' &&
      change.objectType.includes('Escrow')
    );

    return createdObjects?.[0]?.objectId;
  }

  extractBatchId(result) {
    // Extract batch escrow object ID from transaction result
    const createdObjects = result.objectChanges?.filter(
      change => change.type === 'created' &&
      change.objectType.includes('BatchEscrow')
    );

    return createdObjects?.[0]?.objectId;
  }

  async getBalance(address, coinType = '0x2::sui::SUI') {
    try {
      const balance = await this.client.getBalance({
        owner: address,
        coinType: coinType
      });

      return {
        coinType,
        totalBalance: balance.totalBalance,
        coinObjectCount: balance.coinObjectCount
      };
    } catch (error) {
      this.logger.error('Error getting Sui balance:', error);
      throw error;
    }
  }

  async getCoins(address, coinType = '0x2::sui::SUI', limit = 10) {
    try {
      const coins = await this.client.getCoins({
        owner: address,
        coinType: coinType,
        limit
      });

      return coins.data.map(coin => ({
        coinObjectId: coin.coinObjectId,
        balance: coin.balance,
        version: coin.version,
        digest: coin.digest
      }));
    } catch (error) {
      this.logger.error('Error getting Sui coins:', error);
      throw error;
    }
  }

  // Cross-chain utilities
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateHash(secret) {
    return crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
  }

  generateCrossChainId(ethAddress, suiAddress, amount, nonce) {
    const data = Buffer.concat([
      Buffer.from(ethAddress.slice(2), 'hex'), // Remove 0x prefix
      Buffer.from(suiAddress.slice(2), 'hex'), // Remove 0x prefix
      Buffer.from(amount.toString(16).padStart(64, '0'), 'hex'),
      Buffer.from(nonce.toString(16).padStart(64, '0'), 'hex')
    ]);

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Health check
  async healthCheck() {
    try {
      const latestCheckpoint = await this.client.getLatestCheckpointSequenceNumber();

      return {
        status: 'healthy',
        rpcUrl: this.rpcUrl,
        latestCheckpoint,
        address: this.address,
        packageId: this.packageId
      };
    } catch (error) {
      this.logger.error('Sui health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}