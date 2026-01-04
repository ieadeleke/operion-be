const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/response');
const ApiError = require('../utils/ApiError');
const User = require('../models/User.model');
const RefreshToken = require('../models/RefreshToken.model');
const { generateAccessToken, setAuthCookies, clearAuthCookies } = require('../utils/jwt');

/**
 * Get client IP address
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
};

/**
 * Format user for response (exclude sensitive fields)
 */
const formatUser = (user) => ({
  id: user._id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: user.fullName,
  role: user.role,
  department: user.department,
  permissions: user.permissions,
});

/**
 * Register new user
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('User with this email already exists');
  }

  // Create user
  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    phone,
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshTokenDoc = await RefreshToken.createToken(
    user._id,
    getClientIp(req),
    req.headers['user-agent']
  );

  // Set HttpOnly cookies
  setAuthCookies(res, accessToken, refreshTokenDoc.token);

  ApiResponse.created(res, {
    user: formatUser(user),
  }, 'User registered successfully');
});

/**
 * Login user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Check if account is locked
  if (user.isLocked()) {
    throw ApiError.unauthorized('Account is temporarily locked. Please try again later.');
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.incrementLoginAttempts();
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Reset login attempts on successful login
  await user.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshTokenDoc = await RefreshToken.createToken(
    user._id,
    getClientIp(req),
    req.headers['user-agent']
  );

  // Set HttpOnly cookies
  setAuthCookies(res, accessToken, refreshTokenDoc.token);

  ApiResponse.success(res, {
    user: formatUser(user),
  }, 'Login successful');
});

/**
 * Logout user (revoke current refresh token)
 */
const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    await RefreshToken.revokeToken(refreshToken);
  }

  // Clear cookies
  clearAuthCookies(res);

  ApiResponse.success(res, null, 'Logged out successfully');
});

/**
 * Logout from all devices (revoke all refresh tokens)
 */
const logoutAll = asyncHandler(async (req, res) => {
  await RefreshToken.revokeAllUserTokens(req.user._id);

  // Clear cookies
  clearAuthCookies(res);

  ApiResponse.success(res, null, 'Logged out from all devices');
});

/**
 * Refresh access token using refresh token
 */
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    throw ApiError.unauthorized('Refresh token required');
  }

  // Find and validate refresh token
  const refreshTokenDoc = await RefreshToken.findValidToken(token);

  if (!refreshTokenDoc || !refreshTokenDoc.user) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = refreshTokenDoc.user;

  // Check if user is still active
  if (!user.isActive) {
    await RefreshToken.revokeToken(token);
    clearAuthCookies(res);
    throw ApiError.unauthorized('Account has been deactivated');
  }

  // Rotate refresh token (revoke old, create new)
  const newRefreshTokenDoc = await RefreshToken.createToken(
    user._id,
    getClientIp(req),
    req.headers['user-agent']
  );
  await RefreshToken.revokeToken(token, newRefreshTokenDoc.token);

  // Generate new access token
  const accessToken = generateAccessToken(user);

  // Set new cookies
  setAuthCookies(res, accessToken, newRefreshTokenDoc.token);

  ApiResponse.success(res, {
    user: formatUser(user),
  }, 'Token refreshed');
});

/**
 * Get current user
 */
const getMe = asyncHandler(async (req, res) => {
  ApiResponse.success(res, { user: formatUser(req.user) });
});

/**
 * Get active sessions
 */
const getSessions = asyncHandler(async (req, res) => {
  const sessions = await RefreshToken.getActiveSessions(req.user._id);

  ApiResponse.success(res, { sessions });
});

/**
 * Revoke specific session
 */
const revokeSession = asyncHandler(async (req, res) => {
  const { tokenId } = req.params;

  const token = await RefreshToken.findOne({
    _id: tokenId,
    user: req.user._id,
  });

  if (!token) {
    throw ApiError.notFound('Session not found');
  }

  await RefreshToken.revokeToken(token.token);

  ApiResponse.success(res, null, 'Session revoked');
});

/**
 * Forgot password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  // TODO: Implement password reset email
  ApiResponse.success(res, null, 'If an account exists, a password reset email has been sent');
});

/**
 * Reset password
 */
const resetPassword = asyncHandler(async (req, res) => {
  // TODO: Implement password reset
  ApiResponse.success(res, null, 'Password reset successful');
});

/**
 * Update password
 */
const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  // Revoke all refresh tokens (force re-login on all devices)
  await RefreshToken.revokeAllUserTokens(user._id);

  // Generate new tokens for current session
  const accessToken = generateAccessToken(user);
  const refreshTokenDoc = await RefreshToken.createToken(
    user._id,
    getClientIp(req),
    req.headers['user-agent']
  );

  setAuthCookies(res, accessToken, refreshTokenDoc.token);

  ApiResponse.success(res, null, 'Password updated successfully');
});

module.exports = {
  register,
  login,
  logout,
  logoutAll,
  refreshToken,
  getMe,
  getSessions,
  revokeSession,
  forgotPassword,
  resetPassword,
  updatePassword,
};
