const TokenReward = require('../models/TokenReward');
const User = require('../models/User');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { BLOCKCHAIN_NETWORK, REWARD_STATUS, DEFAULTS } = require('../utils/constants');
const crypto = require('crypto');

class BlockchainService {
  constructor() {
    this.network = process.env.BLOCKCHAIN_NETWORK || BLOCKCHAIN_NETWORK.MOCK;
    this.contractAddress = process.env.TOKEN_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
    this.rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    this.defaultTokenAmount = parseFloat(process.env.DEFAULT_TOKEN_AMOUNT) || 100;
  }

  // Award token to winner
  async awardToken(sessionId, userId, tokenAmount = null) {
    // Get user wallet address
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (!user.walletAddress) {
      throw new ValidationError('User does not have a wallet address');
    }

    const amount = tokenAmount || this.defaultTokenAmount;

    // Check if reward already exists for this session
    const existingReward = await TokenReward.findBySession(sessionId);
    if (existingReward) {
      throw new ValidationError('Reward already exists for this session');
    }

    // Create TokenReward record (PENDING)
    const reward = await TokenReward.create({
      sessionId,
      userId,
      tokenAmount: amount,
      contractAddress: this.contractAddress,
      network: this.network,
      status: REWARD_STATUS.PENDING
    });

    try {
      let txHash = null;
      let blockNumber = null;

      // Send transaction based on network
      if (this.network === BLOCKCHAIN_NETWORK.MOCK) {
        const result = await this.mockSendToken(user.walletAddress, amount);
        txHash = result.txHash;
        blockNumber = result.blockNumber;
      } else {
        // Real blockchain transaction
        const result = await this.sendTokenToBlockchain(user.walletAddress, amount);
        txHash = result.txHash;
        blockNumber = result.blockNumber;
      }

      // Update TokenReward with transaction hash
      await reward.markCompleted(txHash, blockNumber);

      // Update user's totalTokensEarned
      await user.addTokensEarned(amount);

      return {
        rewardId: reward._id,
        userId: user._id,
        walletAddress: user.walletAddress,
        tokenAmount: amount,
        transactionHash: txHash,
        blockNumber,
        status: REWARD_STATUS.COMPLETED,
        network: this.network
      };
    } catch (error) {
      // Mark reward as failed
      await reward.markFailed(error.message || 'Transaction failed');
      
      throw new Error(`Failed to award token: ${error.message}`);
    }
  }

  // Mock token transfer (for development)
  async mockSendToken(walletAddress, amount) {
    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(walletAddress)) {
      throw new ValidationError('Invalid wallet address format');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock transaction hash (64 hex characters after 0x)
    const mockTxHash = '0x' + crypto.randomBytes(32).toString('hex');
    
    // Generate mock block number
    const mockBlockNumber = Math.floor(Math.random() * 10000000) + 1000000;

    return {
      txHash: mockTxHash,
      blockNumber: mockBlockNumber
    };
  }

  // Real blockchain token transfer
  async sendTokenToBlockchain(walletAddress, amount) {
    // This would integrate with ethers.js or web3.js
    // For now, throw error if not in MOCK mode
    if (this.network === BLOCKCHAIN_NETWORK.MOCK) {
      return this.mockSendToken(walletAddress, amount);
    }

    // TODO: Implement real blockchain integration
    // Example with ethers.js:
    // const { ethers } = require('ethers');
    // const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    // const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    // const contract = new ethers.Contract(this.contractAddress, abi, wallet);
    // const tx = await contract.transfer(walletAddress, ethers.utils.parseUnits(amount.toString(), 18));
    // const receipt = await tx.wait();
    // return { txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };

    throw new Error(`Real blockchain integration not implemented for network: ${this.network}`);
  }

  // Get transaction status
  async getTransactionStatus(txHash) {
    if (!txHash) {
      throw new ValidationError('Transaction hash is required');
    }

    if (this.network === BLOCKCHAIN_NETWORK.MOCK) {
      // For mock, assume all transactions are confirmed
      return {
        status: 'confirmed',
        confirmations: 1
      };
    }

    // TODO: Query blockchain for transaction status
    // const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    // const receipt = await provider.getTransactionReceipt(txHash);
    // return { status: receipt ? 'confirmed' : 'pending', confirmations: receipt?.confirmations || 0 };

    throw new Error(`Transaction status check not implemented for network: ${this.network}`);
  }

  // Retry failed transaction
  async retryFailedReward(rewardId) {
    const reward = await TokenReward.findById(rewardId);
    
    if (!reward) {
      throw new NotFoundError('Token reward');
    }

    if (!reward.canRetry()) {
      throw new ValidationError('Reward cannot be retried');
    }

    // Reset to pending
    await reward.retry();

    // Get user
    const user = await User.findById(reward.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    try {
      let txHash = null;
      let blockNumber = null;

      if (this.network === BLOCKCHAIN_NETWORK.MOCK) {
        const result = await this.mockSendToken(user.walletAddress, reward.tokenAmount);
        txHash = result.txHash;
        blockNumber = result.blockNumber;
      } else {
        const result = await this.sendTokenToBlockchain(user.walletAddress, reward.tokenAmount);
        txHash = result.txHash;
        blockNumber = result.blockNumber;
      }

      await reward.markCompleted(txHash, blockNumber);
      await user.addTokensEarned(reward.tokenAmount);

      return {
        rewardId: reward._id,
        transactionHash: txHash,
        status: REWARD_STATUS.COMPLETED
      };
    } catch (error) {
      await reward.markFailed(error.message || 'Retry failed');
      throw error;
    }
  }

  // Process pending rewards (background job)
  async processPendingRewards() {
    const pendingRewards = await TokenReward.findPending();
    
    for (const reward of pendingRewards) {
      try {
        const user = await User.findById(reward.userId);
        if (!user || !user.walletAddress) {
          await reward.markFailed('User or wallet address not found');
          continue;
        }

        let txHash = null;
        let blockNumber = null;

        if (this.network === BLOCKCHAIN_NETWORK.MOCK) {
          const result = await this.mockSendToken(user.walletAddress, reward.tokenAmount);
          txHash = result.txHash;
          blockNumber = result.blockNumber;
        } else {
          const result = await this.sendTokenToBlockchain(user.walletAddress, reward.tokenAmount);
          txHash = result.txHash;
          blockNumber = result.blockNumber;
        }

        await reward.markCompleted(txHash, blockNumber);
        await user.addTokensEarned(reward.tokenAmount);
      } catch (error) {
        console.error(`Error processing reward ${reward._id}:`, error);
        await reward.markFailed(error.message || 'Processing failed');
      }
    }

    return {
      processed: pendingRewards.length,
      success: pendingRewards.filter(r => r.status === REWARD_STATUS.COMPLETED).length
    };
  }
}

module.exports = new BlockchainService();

