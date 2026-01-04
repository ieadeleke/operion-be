const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    createdByIp: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
    },
    replacedByToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate opaque token
refreshTokenSchema.statics.generateToken = function () {
  return crypto.randomBytes(64).toString('hex');
};

// Create a new refresh token for user
refreshTokenSchema.statics.createToken = async function (userId, ip, userAgent) {
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const refreshToken = await this.create({
    token,
    user: userId,
    expiresAt,
    createdByIp: ip,
    userAgent,
  });

  return refreshToken;
};

// Find valid token
refreshTokenSchema.statics.findValidToken = async function (token) {
  return this.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).populate('user');
};

// Revoke token
refreshTokenSchema.statics.revokeToken = async function (token, replacedByToken = null) {
  return this.findOneAndUpdate(
    { token },
    {
      isRevoked: true,
      revokedAt: new Date(),
      replacedByToken,
    }
  );
};

// Revoke all tokens for user (logout from all devices)
refreshTokenSchema.statics.revokeAllUserTokens = async function (userId) {
  return this.updateMany(
    { user: userId, isRevoked: false },
    {
      isRevoked: true,
      revokedAt: new Date(),
    }
  );
};

// Get active sessions for user
refreshTokenSchema.statics.getActiveSessions = async function (userId) {
  return this.find({
    user: userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).select('createdAt createdByIp userAgent');
};

// Virtual to check if expired
refreshTokenSchema.virtual('isExpired').get(function () {
  return new Date() >= this.expiresAt;
});

// Virtual to check if active
refreshTokenSchema.virtual('isActive').get(function () {
  return !this.isRevoked && !this.isExpired;
});

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
