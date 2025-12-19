const { ERROR_CODES } = require('./constants');

// Base App Error
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific Error Classes
class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, ERROR_CODES.AUTHENTICATION_ERROR);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, ERROR_CODES.AUTHORIZATION_ERROR);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, ERROR_CODES.CONFLICT);
  }
}

// Error Response Formatter
const formatErrorResponse = (error, req) => {
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode || ERROR_CODES.INTERNAL_ERROR,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error.errors
      })
    }
  };
  
  if (error.errors && Array.isArray(error.errors)) {
    response.error.errors = error.errors;
  }
  
  return response;
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  formatErrorResponse
};

