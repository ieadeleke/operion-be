const jwt = require('jsonwebtoken');
const config = require('../config');

// Access token expiry (short-lived)
const ACCESS_TOKEN_EXPIRY = '15m';

/**
 * Generate JWT access token (short-lived, for API requests)
 * @param {Object} user - User object
 * @returns {string} JWT access token
 */
const generateAccessToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

/**
 * Verify JWT access token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, config.jwtSecret);

  // Ensure it's an access token
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded;
};

/**
 * Cookie options for access token (HttpOnly, secure in production)
 */
const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
});

/**
 * Cookie options for refresh token (HttpOnly, secure in production)
 */
const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
});

/**
 * Set auth cookies on response
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - Opaque refresh token
 */
const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, getAccessTokenCookieOptions());
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());
};

/**
 * Clear auth cookies on response
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_EXPIRY,
};
