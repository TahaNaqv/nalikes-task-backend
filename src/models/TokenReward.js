const mongoose = require("mongoose");

const tokenRewardSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GameSession',
        required: [true, 'Session ID is required'],
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    tokenAmount: {
        type: Number,
        required: [true, 'Token amount is required'],
        min: [0, 'Token amount cannot be negative']
    },
    transactionHash: {
        type: String,
        default: null,
        sparse: true, // Allows multiple nulls but enforces uniqueness for non-null
        unique: true,
        trim: true,
        index: true,
        validate: {
            validator: function(v) {
                if (!v) return true; // Allow null
                // Ethereum transaction hash: 0x followed by 64 hex characters
                return /^0x[a-fA-F0-9]{64}$/.test(v);
            },
            message: 'Invalid transaction hash format'
        }
    },
    contractAddress: {
        type: String,
        required: [true, 'Token contract address is required'],
        trim: true,
        uppercase: true,
        validate: {
            validator: function(v) {
                return /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: 'Invalid contract address format'
        }
    },
    network: {
        type: String,
        enum: {
            values: ['ETHEREUM', 'POLYGON', 'BSC', 'ARBITRUM', 'MOCK'],
            message: 'Network must be ETHEREUM, POLYGON, BSC, ARBITRUM, or MOCK'
        },
        default: 'MOCK',
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ['PENDING', 'COMPLETED', 'FAILED'],
            message: 'Status must be PENDING, COMPLETED, or FAILED'
        },
        default: 'PENDING',
        index: true
    },
    errorMessage: {
        type: String,
        default: null,
        trim: true
    },
    retryCount: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    rewardedAt: {
        type: Date,
        default: null,
        index: true
    },
    confirmedAt: {
        type: Date,
        default: null
    },
    blockNumber: {
        type: Number,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
// Compound index on (userId, status) - for user's reward status
tokenRewardSchema.index({ userId: 1, status: 1 });

// Compound index on (sessionId, status) - for session reward status
tokenRewardSchema.index({ sessionId: 1, status: 1 });

// Instance Methods
// Mark reward as completed
tokenRewardSchema.methods.markCompleted = async function(txHash, blockNumber = null) {
    if (!txHash) {
        throw new Error('Transaction hash is required');
    }
    
    this.status = 'COMPLETED';
    this.transactionHash = txHash;
    this.confirmedAt = new Date();
    if (blockNumber) {
        this.blockNumber = blockNumber;
    }
    
    if (!this.rewardedAt) {
        this.rewardedAt = new Date();
    }
    
    return this.save();
};

// Mark reward as failed
tokenRewardSchema.methods.markFailed = async function(errorMessage) {
    this.status = 'FAILED';
    this.errorMessage = errorMessage || 'Transaction failed';
    this.retryCount += 1;
    return this.save();
};

// Retry failed transaction
tokenRewardSchema.methods.retry = async function() {
    if (this.status !== 'FAILED') {
        throw new Error('Can only retry failed rewards');
    }
    if (this.retryCount >= 5) {
        throw new Error('Maximum retry count reached');
    }
    
    this.status = 'PENDING';
    this.errorMessage = null;
    return this.save();
};

// Check if reward can be retried
tokenRewardSchema.methods.canRetry = function() {
    return this.status === 'FAILED' && this.retryCount < 5;
};

// Static Methods
// Find pending rewards
tokenRewardSchema.statics.findPending = function() {
    return this.find({ status: 'PENDING' });
};

// Find failed rewards that can be retried
tokenRewardSchema.statics.findRetryable = function() {
    return this.find({ 
        status: 'FAILED',
        retryCount: { $lt: 5 }
    });
};

// Find rewards by user
tokenRewardSchema.statics.findByUser = function(userId) {
    return this.find({ userId }).sort({ createdAt: -1 });
};

// Find reward by session
tokenRewardSchema.statics.findBySession = function(sessionId) {
    return this.findOne({ sessionId });
};

// Get total tokens rewarded to user
tokenRewardSchema.statics.getUserTotalRewards = async function(userId) {
    const result = await this.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$tokenAmount' } } }
    ]);
    return result.length > 0 ? result[0].total : 0;
};

// Pre-save Hook
// Normalize addresses to uppercase
tokenRewardSchema.pre('save', function(next) {
    if (this.contractAddress) {
        this.contractAddress = this.contractAddress.toUpperCase();
    }
    if (this.transactionHash) {
        this.transactionHash = this.transactionHash.toLowerCase();
    }
    next();
});

module.exports = mongoose.model("TokenReward", tokenRewardSchema);

