// Wallet Address Validator
const isValidWalletAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/i.test(address);
};

// Transaction Hash Validator
const isValidTransactionHash = (hash) => {
  if (!hash || typeof hash !== 'string') return false;
  return /^0x[a-fA-F0-9]{64}$/i.test(hash);
};

// Session ID Validator (UUID format)
const isValidSessionId = (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sessionId);
};

// Username Validator
const isValidUsername = (username) => {
  if (!username || typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
};

// Email Validator
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return /^\S+@\S+\.\S+$/.test(email);
};

// Score Validator
const isValidScore = (score) => {
  return typeof score === 'number' && score >= 0 && Number.isInteger(score);
};

// Duration Validator
const isValidDuration = (duration) => {
  return typeof duration === 'number' && duration >= 1 && duration <= 120;
};

module.exports = {
  isValidWalletAddress,
  isValidTransactionHash,
  isValidSessionId,
  isValidUsername,
  isValidEmail,
  isValidScore,
  isValidDuration
};

