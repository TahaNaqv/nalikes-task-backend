const { ERROR_CODES } = require('../utils/constants');

const errorHandler = (err, req, res, next) => {
  // Log error
  console.error('Error:', err);
  
  // Default error
  let error = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Internal server error',
    errorCode: err.errorCode || ERROR_CODES.INTERNAL_ERROR
  };
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    error.statusCode = 400;
    error.message = 'Validation error';
    error.errorCode = ERROR_CODES.VALIDATION_ERROR;
    error.errors = Object.values(err.errors).map(e => e.message);
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    error.statusCode = 409;
    error.message = 'Duplicate entry';
    error.errorCode = ERROR_CODES.CONFLICT;
    const field = Object.keys(err.keyPattern)[0];
    error.message = `${field} already exists`;
  }
  
  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error.statusCode = 400;
    error.message = 'Invalid ID format';
    error.errorCode = ERROR_CODES.VALIDATION_ERROR;
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = 'Invalid token';
    error.errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
  }
  
  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = 'Token expired';
    error.errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
  }
  
  // If error already has errors array (from ValidationError)
  if (err.errors && Array.isArray(err.errors)) {
    error.errors = err.errors;
  }
  
  // Send error response
  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      code: error.errorCode,
      ...(error.errors && { errors: error.errors }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack
      })
    }
  });
};

module.exports = errorHandler;

