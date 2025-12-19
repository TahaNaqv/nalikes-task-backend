// Session Status
const SESSION_STATUS = {
  WAITING: 'WAITING',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED'
};

// Token Reward Status
const REWARD_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

// Scoring Types
const SCORING_TYPE = {
  POINTS: 'POINTS',
  TASKS: 'TASKS',
  RANDOM: 'RANDOM',
  COMBINED: 'COMBINED'
};

// Blockchain Networks
const BLOCKCHAIN_NETWORK = {
  ETHEREUM: 'ETHEREUM',
  POLYGON: 'POLYGON',
  BSC: 'BSC',
  ARBITRUM: 'ARBITRUM',
  MOCK: 'MOCK'
};

// Socket Events
const SOCKET_EVENTS = {
  // Client -> Server
  JOIN_SESSION: 'join_session',
  LEAVE_SESSION: 'leave_session',
  UPDATE_SCORE: 'update_score',
  REQUEST_SESSION_DATA: 'request_session_data',
  PING: 'ping',
  
  // Server -> Client
  SESSION_JOINED: 'session_joined',
  SESSION_LEFT: 'session_left',
  BROADCAST_DATA: 'broadcast_data',
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  TOKEN_REWARDED: 'token_rewarded',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  SCORE_UPDATED: 'score_updated',
  ERROR: 'error',
  PONG: 'pong'
};

// Error Codes
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SESSION_FULL: 'SESSION_FULL',
  SESSION_ENDED: 'SESSION_ENDED',
  INVALID_SESSION: 'INVALID_SESSION'
};

// Default Values
const DEFAULTS = {
  SESSION_DURATION: 10, // minutes
  MAX_PLAYERS: 50,
  MIN_PLAYERS_TO_START: 2,
  POINTS_PER_TASK: 10,
  MAX_RETRY_COUNT: 5
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

module.exports = {
  SESSION_STATUS,
  REWARD_STATUS,
  SCORING_TYPE,
  BLOCKCHAIN_NETWORK,
  SOCKET_EVENTS,
  ERROR_CODES,
  DEFAULTS,
  HTTP_STATUS
};

