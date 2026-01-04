const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 12,
      select: false,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager', 'staff'],
      default: 'staff',
    },
    department: {
      type: String,
      enum: ['front_desk', 'housekeeping', 'fnb', 'events', 'maintenance', 'accounts', 'marketing', 'hr'],
      default: 'front_desk',
    },
    permissions: {
      email: {
        view: { type: Boolean, default: true },
        send: { type: Boolean, default: false },
        manage: { type: Boolean, default: false },
      },
      bookings: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        cancel: { type: Boolean, default: false },
        viewRevenue: { type: Boolean, default: false },
      },
      guests: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
      },
      invoices: {
        view: { type: Boolean, default: false },
        approve: { type: Boolean, default: false },
        export: { type: Boolean, default: false },
      },
      analytics: {
        viewOwn: { type: Boolean, default: true },
        viewDepartment: { type: Boolean, default: false },
        viewAll: { type: Boolean, default: false },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Index for search
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 10 failed attempts for 30 minutes
  if (this.loginAttempts + 1 >= 10) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
  }

  return this.updateOne(updates);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
