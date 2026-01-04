const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Authenticate user via JWT access token (from HttpOnly cookie)
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // Get token from HttpOnly cookie only (not from header for security)
  const token = req.cookies?.accessToken;

  if (!token) {
    throw ApiError.unauthorized('Access denied. No token provided.');
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Account has been deactivated');
    }

    // Check if password was changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      throw ApiError.unauthorized('Password was recently changed. Please log in again.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw ApiError.unauthorized('Invalid token');
    }
    throw error;
  }
});

/**
 * Authorize user based on roles
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken;

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    } catch {
      // Ignore token errors for optional auth
    }
  }

  next();
});

module.exports = { authenticate, authorize, optionalAuth };
