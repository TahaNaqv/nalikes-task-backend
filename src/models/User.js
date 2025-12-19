const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    index: true
  },
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    unique: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        // Ethereum address format: 0x followed by 40 hex characters
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid wallet address format. Must be a valid Ethereum address (0x followed by 40 hex characters)'
    },
    index: true
  },
  email: {
    type: String,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  totalSessionsJoined: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSessionsWon: {
    type: Number,
    default: 0,
    min: 0
  },
  totalTokensEarned: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Instance Methods
// Check if user can join a session
userSchema.methods.canJoinSession = function() {
  return this.isActive;
};

// Increment session statistics
userSchema.methods.incrementSessionsJoined = async function() {
  this.totalSessionsJoined += 1;
  return this.save();
};

userSchema.methods.incrementSessionsWon = async function() {
  this.totalSessionsWon += 1;
  return this.save();
};

userSchema.methods.addTokensEarned = async function(amount) {
  this.totalTokensEarned += amount;
  return this.save();
};

// Static Methods
// Find user by wallet address
userSchema.statics.findByWalletAddress = function(walletAddress) {
  return this.findOne({ walletAddress: walletAddress.toUpperCase() });
};

// Find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Pre-save Hook
// Normalize wallet address to uppercase
userSchema.pre('save', function(next) {
  if (this.walletAddress) {
    this.walletAddress = this.walletAddress.toUpperCase();
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
