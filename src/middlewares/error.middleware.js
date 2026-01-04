const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error
  if (process.env.NODE_ENV !== 'test') {
    logger.error(`${err.message}`, err.stack);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Validation Error', errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = ApiError.conflict(`${field} already exists`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token expired');
  }

  // Default to 500 if not an ApiError
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    status: error.status || 'error',
    message,
    errors: error.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFoundHandler, errorHandler };
