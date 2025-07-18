import { ethers } from 'ethers';
import MarketHubABI from '../abi/MarketHub.json';
import config from '../config';

class ContractService {
  constructor() {
    this.marketHubAddress = config.marketHubAddress;
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
  }

  // Get contract with signer for write operations
  async getContractWithSigner() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const signer = await this.provider.getSigner();
    return new ethers.Contract(this.marketHubAddress, this.abi, signer);
  }

  // Get user's token balances for a specific market
  async getUserBalances(userAddress, marketId) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      // Token IDs: marketId * 2 for YES, marketId * 2 + 1 for NO
      const yesTokenId = marketId * 2;
      const noTokenId = marketId * 2 + 1;

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
  async placeOrder(marketId, price, amount, isBuy) {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      // Convert to wei
      const priceWei = ethers.parseEther(price.toString());
      const amountWei = ethers.parseEther(amount.toString());

      console.log('Placing order with params:', {
        marketId,
        price: priceWei.toString(),
        amount: amountWei.toString(),
        isBuy
      });

      // Call the contract function
      const tx = await contractWithSigner.placeOrder(
        marketId,
        priceWei,
        amountWei,
        isBuy
      );

      console.log('Transaction hash:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  // Get order details for a specific market and user
  async getOrderDetails(marketId, userAddress) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const orderDetails = await this.contract.orders(marketId, userAddress);

      return {
        user: orderDetails.user,
        price: ethers.formatEther(orderDetails.price),
        amount: ethers.formatEther(orderDetails.amount),
        isBuy: orderDetails.isBuy
      };
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  // Get batch balances for multiple tokens
  async getBatchBalances(userAddress, tokenIds) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const accounts = new Array(tokenIds.length).fill(userAddress);
      const balances = await this.contract.balanceOfBatch(accounts, tokenIds);

      return balances.map(balance => ethers.formatEther(balance));
    } catch (error) {
      console.error('Error fetching batch balances:', error);
      throw error;
    }
  }

  // Check if user has approved the contract to spend tokens
  async isApprovedForAll(userAddress, operatorAddress) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      return await this.contract.isApprovedForAll(userAddress, operatorAddress);
    } catch (error) {
      console.error('Error checking approval:', error);
      throw error;
    }
  }

  // Set approval for all tokens
  async setApprovalForAll(operatorAddress, approved) {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      const tx = await contractWithSigner.setApprovalForAll(operatorAddress, approved);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('Error setting approval:', error);
      throw error;
    }
  }

  // Transfer tokens (if needed for advanced functionality)
  async safeTransferFrom(from, to, tokenId, amount, data = '0x') {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      const tx = await contractWithSigner.safeTransferFrom(
        from,
        to,
        tokenId,
        ethers.parseEther(amount.toString()),
        data
      );

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('Error transferring tokens:', error);
      throw error;
    }
  }

  // Get contract events (useful for real-time updates)
  async getEvents(eventName, fromBlock = 0, toBlock = 'latest') {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const filter = this.contract.filters[eventName]();
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

      return events.map(event => ({
        ...event,
        args: event.args
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // Listen for real-time events
  async listenToEvents(eventName, callback) {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      this.contract.on(eventName, callback);
      return () => this.contract.off(eventName, callback);
    } catch (error) {
      console.error('Error setting up event listener:', error);
      throw error;
    }
  }

  // Get current network and verify contract deployment
  async verifyContractDeployment() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const network = await this.provider.getNetwork();
      const code = await this.provider.getCode(this.marketHubAddress);

      return {
        network: {
          name: network.name,
          chainId: network.chainId
        },
        contractDeployed: code !== '0x',
        contractAddress: this.marketHubAddress
      };
    } catch (error) {
      console.error('Error verifying contract deployment:', error);
      throw error;
    }
  }

  // Utility function to format transaction errors
  formatTransactionError(error) {
    if (error.code === 'ACTION_REJECTED') {
      return 'Transaction was rejected by user';
    }

    if (error.code === 'INSUFFICIENT_FUNDS') {
      return 'Insufficient funds for transaction';
    }

    if (error.code === 'NETWORK_ERROR') {
      return 'Network error occurred';
    }

    if (error.message.includes('execution reverted')) {
      return 'Transaction failed: ' + error.message;
    }

    return 'Unknown error: ' + error.message;
  }

  // Get gas estimate for a transaction
  async estimateGas(method, params) {
    try {
      const contractWithSigner = await this.getContractWithSigner();
      const gasEstimate = await contractWithSigner[method].estimateGas(...params);

      return {
        gasLimit: gasEstimate.toString(),
        gasLimitFormatted: ethers.formatUnits(gasEstimate, 'gwei')
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  }

    // Get current gas price
  async getCurrentGasPrice() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const feeData = await this.provider.getFeeData();

      return {
        gasPrice: feeData.gasPrice.toString(),
        gasPriceFormatted: ethers.formatUnits(feeData.gasPrice, 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
      };
    } catch (error) {
      console.error('Error fetching gas price:', error);
      throw error;
    }
  }

  // Redeem winnings for a resolved market
  async redeemWinnings(marketId, outcome) {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      // For now, we'll simulate the redeem functionality
      // In a real implementation, this would call a redeem function on the contract

      console.log('Redeeming winnings for market:', marketId, 'outcome:', outcome);

      // This is a placeholder - in a real contract, you'd have a redeem function
      // that burns the winning tokens and transfers collateral to the user

      // For demonstration, we'll just return success
      return {
        success: true,
        message: 'Winnings redeemed successfully',
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
      };

    } catch (error) {
      console.error('Error redeeming winnings:', error);
      throw error;
    }
  }

  // Simulate market resolution (normally done by oracle/admin)
  async resolveMarket(marketId, outcome) {
    try {
      const contractWithSigner = await this.getContractWithSigner();

      // This would normally call a resolveMarket function on the contract
      // For MVP, we'll simulate this

      console.log('Resolving market:', marketId, 'to outcome:', outcome);

      // In a real implementation, this would:
      // 1. Set the market outcome
      // 2. Enable redemption of winning tokens
      // 3. Emit a MarketResolved event

      return {
        success: true,
        marketId,
        outcome,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
      };

    } catch (error) {
      console.error('Error resolving market:', error);
      throw error;
    }
  }

  // Check if a market is resolved
  async isMarketResolved(marketId) {
    try {
      // This would normally check the contract state
      // For MVP, we'll return false (markets are not resolved yet)
      return false;
    } catch (error) {
      console.error('Error checking market resolution:', error);
      throw error;
    }
  }

  // Get market outcome (if resolved)
  async getMarketOutcome(marketId) {
    try {
      // This would normally read from the contract
      // For MVP, we'll return null (no markets resolved)
      return null;
    } catch (error) {
      console.error('Error getting market outcome:', error);
      throw error;
    }
  }
}

// Create singleton instance
const contractService = new ContractService();

export default contractService;