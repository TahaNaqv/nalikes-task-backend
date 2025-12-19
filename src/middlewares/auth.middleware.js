const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../utils/errors');

// REST API Authentication
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      throw new AuthenticationError('No token provided');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthenticationError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Socket.IO Authentication
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || 
                  (socket.handshake.headers?.authorization && 
                   socket.handshake.headers.authorization.split(' ')[1]);
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new Error('Authentication error: Invalid token'));
    } else {
      next(new Error('Authentication error: Invalid token'));
    }
  }
};

// Optional Authentication (for endpoints that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
      } catch (error) {
        // Token invalid, but continue without auth
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  optionalAuth
};

