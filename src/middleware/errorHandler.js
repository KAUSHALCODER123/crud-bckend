const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Express-validator result handler
 * Call after validation chains in routes
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));
    return res.status(422).json({
      success: false,
      message: 'Validation failed. Please check the provided data.',
      errors: formattedErrors,
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

/**
 * 404 handler - must come after all routes
 */
const notFound = (req, res) => {
  return errorResponse(
    res,
    `Route ${req.method} ${req.originalUrl} not found.`,
    404
  );
};

/**
 * Global error handler - must be last middleware with 4 params
 */
const globalErrorHandler = (err, req, res, next) => {
  // Log all errors
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  // PostgreSQL error codes
  if (err.code === '23505') {
    const detail = err.detail || '';
    const field = detail.match(/\(([^)]+)\)/)?.[1] || 'field';
    return errorResponse(res, `${field} already exists.`, 409);
  }
  if (err.code === '23503') {
    return errorResponse(res, 'Referenced resource does not exist.', 404);
  }
  if (err.code === '22P02') {
    return errorResponse(res, 'Invalid ID format.', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired.', 401);
  }

  // Custom app errors
  if (err.statusCode) {
    return errorResponse(res, err.message, err.statusCode);
  }

  // Default 500
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred.'
    : err.message;

  return errorResponse(res, message, 500);
};

/**
 * Async handler wrapper to avoid try/catch in every controller
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create a structured app error
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = { validate, notFound, globalErrorHandler, asyncHandler, AppError };
