const { ValidationError } = require('../utils/errors');
const {
  isValidUsername,
  isValidWalletAddress,
  isValidDuration,
  isValidScore
} = require('../utils/validators');

// User Registration Validation
const validateRegister = (req, res, next) => {
  const { username, walletAddress } = req.body;
  const errors = [];
  
  if (!username || !isValidUsername(username)) {
    errors.push('Username must be 3-30 characters and contain only letters, numbers, and underscores');
  }
  
  if (!walletAddress || !isValidWalletAddress(walletAddress)) {
    errors.push('Invalid wallet address format');
  }
  
  if (errors.length > 0) {
    return next(new ValidationError('Validation failed', errors));
  }
  
  next();
};

// Create Session Validation
const validateCreateSession = (req, res, next) => {
  const { durationMinutes, maxPlayers, minPlayersToStart, config } = req.body;
  const errors = [];
  
  if (durationMinutes !== undefined && !isValidDuration(durationMinutes)) {
    errors.push('Duration must be between 1 and 120 minutes');
  }
  
  if (maxPlayers !== undefined && (maxPlayers < 2 || maxPlayers > 1000)) {
    errors.push('Max players must be between 2 and 1000');
  }
  
  if (minPlayersToStart !== undefined && minPlayersToStart < 1) {
    errors.push('Min players to start must be at least 1');
  }
  
  if (minPlayersToStart !== undefined && maxPlayers !== undefined && minPlayersToStart > maxPlayers) {
    errors.push('Min players to start cannot exceed max players');
  }
  
  if (errors.length > 0) {
    return next(new ValidationError('Validation failed', errors));
  }
  
  next();
};

// Join Session Validation
const validateJoinSession = (req, res, next) => {
  const { sessionId } = req.params;
  const errors = [];
  
  if (!sessionId) {
    errors.push('Session ID is required');
  }
  
  if (errors.length > 0) {
    return next(new ValidationError('Validation failed', errors));
  }
  
  next();
};

// Update Score Validation
const validateUpdateScore = (req, res, next) => {
  const { score, tasksCompleted } = req.body;
  const errors = [];
  
  if (score !== undefined && !isValidScore(score)) {
    errors.push('Score must be a non-negative integer');
  }
  
  if (tasksCompleted !== undefined && !isValidScore(tasksCompleted)) {
    errors.push('Tasks completed must be a non-negative integer');
  }
  
  if (errors.length > 0) {
    return next(new ValidationError('Validation failed', errors));
  }
  
  next();
};

module.exports = {
  validateRegister,
  validateCreateSession,
  validateJoinSession,
  validateUpdateScore
};

