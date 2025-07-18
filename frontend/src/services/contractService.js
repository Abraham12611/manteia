import { ethers } from 'ethers';
import MarketHubABI from '../abi/MarketHub.json';

// Contract configuration
const MANTLE_SEPOLIA_CHAIN_ID = 5003;
const MARKET_HUB_ADDRESS = process.env.REACT_APP_MARKET_HUB_ADDRESS || '0x...'; // Will be set after deployment

class ContractService {
  constructor() {
    this.marketHubAddress = MARKET_HUB_ADDRESS;
    this.abi = MarketHubABI.abi;
    this.provider = null;
    this.signer = null;
    this.contract = null;
  }

  // Initialize the contract with a provider/signer
  async init(provider, signer = null) {
    this.provider = provider;
    this.signer = signer;

    if (signer) {
      this.contract = new ethers.Contract(this.marketHubAddress, this.abi, signer);
    } else {
      this.contract = new ethers.Contract(this.marketHubAddress, this.abi, provider);
    }

    // Verify contract deployment
    await this.verifyContractDeployment();
  }

  // Get contract with signer for write operations
  async getContractWithSigner() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const signer = await this.provider.getSigner();
    return new ethers.Contract(this.marketHubAddress, this.abi, signer);
  }

  // Verify contract is deployed and accessible
  async verifyContractDeployment() {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // Skip verification if no valid address is provided
      if (!this.marketHubAddress || this.marketHubAddress === '0x...' || this.marketHubAddress === 'undefined') {
        console.warn('No valid contract address provided, skipping verification');
        return true;
      }

      const code = await this.provider.getCode(this.marketHubAddress);
      if (code === '0x') {
        console.warn('Contract not deployed at specified address:', this.marketHubAddress);
        return true; // Continue without verification for now
      }

      // Try to call a view function to verify ABI compatibility
      try {
        const contractVersion = await this.contract.version();
        console.log('Contract version:', contractVersion);
      } catch (error) {
        console.warn('Contract version call failed, continuing anyway:', error.message);
      }

      return true;
    } catch (error) {
      console.error('Contract verification failed:', error);
      // Don't throw error, just continue with warning
      console.warn('Continuing without contract verification');
      return true;
    }
  }

  // Get user's MNT balance
  async getMNTBalance(userAddress) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const balance = await this.provider.getBalance(userAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching MNT balance:', error);
      throw error;
    }
  }

  // Get user's collateral balance in the contract
  async getUserCollateral(userAddress) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const collateral = await this.contract.userCollateral(userAddress);
      return ethers.formatEther(collateral);
    } catch (error) {
      console.error('Error fetching user collateral:', error);
      throw error;
    }
  }

  // Deposit MNT as collateral
  async depositCollateral(amount) {
    try {
      const contractWithSigner = await this.getContractWithSigner();
      const amountWei = ethers.parseEther(amount.toString());

      console.log('Depositing collateral:', amount, 'MNT');

      const tx = await contractWithSigner.deposit({
        value: amountWei
      });

      console.log('Deposit transaction hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('Deposit transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt,
        amount: amount
      };
    } catch (error) {
      console.error('Error depositing collateral:', error);
      throw error;
    }
  }

  // Withdraw MNT collateral
  async withdrawCollateral(amount) {
    try {
      const contractWithSigner = await this.getContractWithSigner();
      const amountWei = ethers.parseEther(amount.toString());

      console.log('Withdrawing collateral:', amount, 'MNT');

      const tx = await contractWithSigner.withdraw(amountWei);

      console.log('Withdrawal transaction hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('Withdrawal transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt,
        amount: amount
      };
    } catch (error) {
      console.error('Error withdrawing collateral:', error);
      throw error;
    }
  }

  // Get user's share token balances for a specific market
  async getUserBalances(userAddress, marketId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      // Token IDs: marketId + "1" for YES, marketId + "2" for NO
      const yesTokenId = ethers.id(`${marketId}-YES`);
      const noTokenId = ethers.id(`${marketId}-NO`);

      const [yesBalance, noBalance] = await Promise.all([
        this.contract.balanceOf(userAddress, yesTokenId),
        this.contract.balanceOf(userAddress, noTokenId)
      ]);

      return {
        yes: ethers.formatEther(yesBalance),
        no: ethers.formatEther(noBalance),
        yesRaw: yesBalance,
        noRaw: noBalance
      };
    } catch (error) {
      console.error('Error fetching user balances:', error);
      throw error;
    }
  }

  // Place an order on the market
  async placeOrder(marketId, outcome, price, size, orderType = 'limit') {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      // Convert to wei
      const priceWei = ethers.parseEther(price.toString());
      const sizeWei = ethers.parseEther(size.toString());
      const isMarketOrder = orderType === 'market';

      console.log('Placing order with params:', {
        marketId: marketId.toString(),
        outcome: Boolean(outcome),
        price: priceWei.toString(),
        size: sizeWei.toString(),
        isMarketOrder
      });

      // Calculate required collateral
      const collateralRequired = ethers.parseEther((parseFloat(price) * parseFloat(size)).toString());

      // Place order with collateral
      const tx = await contractWithSigner.placeOrder(
        marketId.toString(),
        Boolean(outcome),
        priceWei,
        sizeWei,
        isMarketOrder,
        { value: collateralRequired }
      );

      console.log('Order transaction hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('Order transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt,
        marketId: marketId.toString(),
        outcome: Boolean(outcome),
        price: price.toString(),
        size: size.toString(),
        orderType: orderType
      };
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  // Cancel an order
  async cancelOrder(orderId) {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      console.log('Canceling order:', orderId);

      const tx = await contractWithSigner.cancelOrder(orderId);

      console.log('Cancel transaction hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('Cancel transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt,
        orderId: orderId
      };
    } catch (error) {
      console.error('Error canceling order:', error);
      throw error;
    }
  }

  // Get order book for a market
  async getOrderBook(marketId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const [yesOrders, noOrders] = await Promise.all([
        this.contract.getOrders(marketId.toString(), true), // YES orders
        this.contract.getOrders(marketId.toString(), false) // NO orders
      ]);

      return {
        yes: yesOrders.map(order => ({
          id: order.id,
          trader: order.trader,
          price: ethers.formatEther(order.price),
          size: ethers.formatEther(order.size),
          timestamp: order.timestamp.toNumber()
        })),
        no: noOrders.map(order => ({
          id: order.id,
          trader: order.trader,
          price: ethers.formatEther(order.price),
          size: ethers.formatEther(order.size),
          timestamp: order.timestamp.toNumber()
        }))
      };
    } catch (error) {
      console.error('Error fetching order book:', error);
      throw error;
    }
  }

  // Get market price
  async getMarketPrice(marketId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const price = await this.contract.getMarketPrice(marketId.toString());
      return ethers.formatEther(price);
    } catch (error) {
      console.error('Error fetching market price:', error);
      throw error;
    }
  }

  // Get market statistics
  async getMarketStats(marketId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const stats = await this.contract.getMarketStats(marketId.toString());

      return {
        totalVolume: ethers.formatEther(stats.totalVolume),
        totalYesVolume: ethers.formatEther(stats.totalYesVolume),
        totalNoVolume: ethers.formatEther(stats.totalNoVolume),
        totalOrders: stats.totalOrders.toNumber(),
        totalTrades: stats.totalTrades.toNumber(),
        currentPrice: ethers.formatEther(stats.currentPrice),
        isResolved: stats.isResolved,
        outcome: stats.outcome
      };
    } catch (error) {
      console.error('Error fetching market stats:', error);
      throw error;
    }
  }

  // Redeem winnings for a resolved market
  async redeemWinnings(marketId, outcome) {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      console.log('Redeeming winnings for market:', marketId, 'outcome:', outcome);

      const tx = await contractWithSigner.redeemWinnings(marketId.toString(), Boolean(outcome));

      console.log('Redeem transaction hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('Redeem transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt,
        marketId: marketId.toString(),
        outcome: Boolean(outcome)
      };
    } catch (error) {
      console.error('Error redeeming winnings:', error);
      throw error;
    }
  }

  // Resolve market (admin function)
  async resolveMarket(marketId, outcome) {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      console.log('Resolving market:', marketId, 'to outcome:', outcome);

      const tx = await contractWithSigner.resolveMarket(marketId.toString(), Boolean(outcome));

      console.log('Resolution transaction hash:', tx.hash);
      const receipt = await tx.wait();
      console.log('Resolution transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt,
        marketId: marketId.toString(),
        outcome: Boolean(outcome)
      };
    } catch (error) {
      console.error('Error resolving market:', error);
      throw error;
    }
  }

  // Check if market is resolved
  async isMarketResolved(marketId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const isResolved = await this.contract.isMarketResolved(marketId.toString());
      return isResolved;
    } catch (error) {
      console.error('Error checking market resolution:', error);
      throw error;
    }
  }

  // Get market outcome (if resolved)
  async getMarketOutcome(marketId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const outcome = await this.contract.getMarketOutcome(marketId.toString());
      return outcome;
    } catch (error) {
      console.error('Error getting market outcome:', error);
      throw error;
    }
  }

  // Get contract events
  async getEvents(eventName, fromBlock = 0, toBlock = 'latest') {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const filter = this.contract.filters[eventName]();
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

      return events.map(event => ({
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        args: event.args,
        event: event.event,
        timestamp: event.timestamp
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // Listen to real-time events
  async listenToEvents(eventName, callback) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const filter = this.contract.filters[eventName]();

      this.contract.on(filter, (...args) => {
        const event = args[args.length - 1];
        callback({
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          args: event.args,
          event: event.event
        });
      });

      console.log(`Listening to ${eventName} events`);
    } catch (error) {
      console.error('Error setting up event listener:', error);
      throw error;
    }
  }

  // Gas estimation
  async estimateGas(method, params) {
    try {
      const contractWithSigner = await this.getContractWithSigner();
      const gasEstimate = await contractWithSigner[method].estimateGas(...params);
      return gasEstimate.toString();
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  }

  // Get current gas price
  async getCurrentGasPrice() {
    try {
      const gasPrice = await this.provider.getGasPrice();
      return ethers.formatUnits(gasPrice, 'gwei');
    } catch (error) {
      console.error('Error getting gas price:', error);
      throw error;
    }
  }

  // Format transaction errors
  formatTransactionError(error) {
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return 'Transaction may fail. Please check your inputs and try again.';
    }

    if (error.code === 'INSUFFICIENT_FUNDS') {
      return 'Insufficient funds for this transaction.';
    }

    if (error.code === 'USER_REJECTED') {
      return 'Transaction was rejected by user.';
    }

    if (error.reason) {
      return error.reason;
    }

    if (error.message) {
      return error.message;
    }

    return 'Unknown error occurred during transaction.';
  }

  // Utility method to convert market ID to bytes32
  marketIdToBytes32(marketId) {
    return ethers.id(marketId.toString());
  }

  // Utility method to format token amounts
  formatTokenAmount(amount, decimals = 18) {
    return ethers.formatUnits(amount, decimals);
  }

  // Utility method to parse token amounts
  parseTokenAmount(amount, decimals = 18) {
    return ethers.parseUnits(amount.toString(), decimals);
  }
}

// Create singleton instance
const contractService = new ContractService();

export default contractService;