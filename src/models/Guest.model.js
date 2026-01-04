const mongoose = require('mongoose');

const communicationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['email', 'call', 'sms', 'whatsapp'],
    required: true,
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true,
  },
  subject: String,
  content: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

const guestSchema = new mongoose.Schema(
  {
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
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      index: true,
    },
    dateOfBirth: Date,
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    company: String,
    idType: {
      type: String,
      enum: ['passport', 'driving_license', 'national_id', 'other'],
    },
    idNumber: String,
    nationality: String,
    preferences: {
      roomType: String,
      floorPreference: {
        type: String,
        enum: ['low', 'mid', 'high', 'any'],
        default: 'any',
      },
      bedType: {
        type: String,
        enum: ['single', 'double', 'king', 'twin', 'any'],
        default: 'any',
      },
      smokingRoom: {
        type: Boolean,
        default: false,
      },
      specialNeeds: {
        accessibility: { type: Boolean, default: false },
        dietary: [String],
        allergies: [String],
      },
      occasions: [{
        type: {
          type: String,
          enum: ['birthday', 'anniversary', 'honeymoon', 'business', 'other'],
        },
        date: Date,
        notes: String,
      }],
    },
    communications: [communicationSchema],
    notes: String,
    tags: [String],
    vipStatus: {
      type: String,
      enum: ['regular', 'silver', 'gold', 'platinum', 'vip'],
      default: 'regular',
    },
    source: {
      type: String,
      enum: ['direct', 'booking.com', 'expedia', 'airbnb', 'phone', 'walk-in', 'referral', 'other'],
      default: 'direct',
    },
    marketingOptIn: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },
    // Calculated fields (updated via hooks)
    stats: {
      totalBookings: { type: Number, default: 0 },
      totalSpend: { type: Number, default: 0 },
      averageBookingValue: { type: Number, default: 0 },
      lastStay: Date,
      firstStay: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
guestSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for lifetime value tier
guestSchema.virtual('lifetimeValueTier').get(function () {
  if (this.stats.totalSpend >= 5000) return 'platinum';
  if (this.stats.totalSpend >= 2000) return 'gold';
  if (this.stats.totalSpend >= 1000) return 'silver';
  return 'bronze';
});

// Index for search
guestSchema.index({ firstName: 'text', lastName: 'text', email: 'text', phone: 'text' });
guestSchema.index({ 'stats.totalSpend': -1 });
guestSchema.index({ vipStatus: 1 });

// Static method to find or create guest
guestSchema.statics.findOrCreate = async function (guestData) {
  let guest = null;

  // Try to find by email first
  if (guestData.email) {
    guest = await this.findOne({ email: guestData.email });
  }

  // Try to find by phone if no email match
  if (!guest && guestData.phone) {
    guest = await this.findOne({ phone: guestData.phone });
  }

  // Create new guest if not found
  if (!guest) {
    guest = await this.create(guestData);
  }

  return guest;
};

// Method to update stats
guestSchema.methods.updateStats = async function (booking) {
  const Booking = mongoose.model('Booking');
  const bookings = await Booking.find({ guest: this._id, status: { $ne: 'cancelled' } });

  this.stats.totalBookings = bookings.length;
  this.stats.totalSpend = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  this.stats.averageBookingValue = this.stats.totalBookings > 0
    ? this.stats.totalSpend / this.stats.totalBookings
    : 0;

  const dates = bookings.map(b => b.checkIn).sort();
  this.stats.firstStay = dates[0] || null;
  this.stats.lastStay = dates[dates.length - 1] || null;

  // Auto-update VIP status based on spend
  if (this.stats.totalSpend >= 5000) {
    this.vipStatus = 'platinum';
  } else if (this.stats.totalSpend >= 2000) {
    this.vipStatus = 'gold';
  } else if (this.stats.totalBookings >= 5) {
    this.vipStatus = 'silver';
  }

  await this.save();
};

const Guest = mongoose.model('Guest', guestSchema);

module.exports = Guest;
