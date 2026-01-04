const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  method: {
    type: String,
    enum: ['card', 'cash', 'bank_transfer', 'stripe', 'other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  transactionId: String,
  paidAt: Date,
  notes: String,
});

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      unique: true,
      index: true,
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guest',
      required: [true, 'Guest is required'],
      index: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
      index: true,
    },
    checkIn: {
      type: Date,
      required: [true, 'Check-in date is required'],
      index: true,
    },
    checkOut: {
      type: Date,
      required: [true, 'Check-out date is required'],
      index: true,
    },
    nights: {
      type: Number,
      min: 1,
    },
    adults: {
      type: Number,
      default: 1,
      min: 1,
    },
    children: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
      default: 'pending',
      index: true,
    },
    source: {
      type: String,
      enum: ['direct', 'booking.com', 'expedia', 'airbnb', 'phone', 'email', 'walk-in', 'other'],
      default: 'direct',
    },
    pricing: {
      roomRate: {
        type: Number,
        required: true,
      },
      currency: {
        type: String,
        default: 'GBP',
      },
      subtotal: Number,
      taxes: {
        vat: { type: Number, default: 0 },
        cityTax: { type: Number, default: 0 },
        other: { type: Number, default: 0 },
      },
      extras: [{
        name: String,
        quantity: { type: Number, default: 1 },
        unitPrice: Number,
        total: Number,
      }],
      discounts: [{
        name: String,
        type: { type: String, enum: ['percentage', 'fixed'] },
        value: Number,
        amount: Number,
      }],
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'deposit_paid', 'paid', 'partially_refunded', 'refunded'],
      default: 'unpaid',
    },
    payments: [paymentSchema],
    specialRequests: String,
    internalNotes: String,
    cancellation: {
      cancelledAt: Date,
      cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: {
        type: String,
        enum: ['guest_requested', 'no_show', 'overbooking', 'emergency', 'policy_violation', 'other'],
      },
      notes: String,
      refundAmount: Number,
      refundStatus: {
        type: String,
        enum: ['pending', 'processed', 'denied'],
      },
    },
    checkInDetails: {
      actualTime: Date,
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      notes: String,
    },
    checkOutDetails: {
      actualTime: Date,
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      notes: String,
      lateCheckoutCharge: Number,
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmationEmailSent: {
      type: Boolean,
      default: false,
    },
    reminderEmailSent: {
      type: Boolean,
      default: false,
    },
    followUpEmailSent: {
      type: Boolean,
      default: false,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringParent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    groupBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupBooking',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for common queries
bookingSchema.index({ checkIn: 1, checkOut: 1 });
bookingSchema.index({ status: 1, checkIn: 1 });
bookingSchema.index({ guest: 1, checkIn: -1 });
bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 });

// Generate booking reference before saving
bookingSchema.pre('save', function (next) {
  if (!this.bookingReference) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().split('-')[0].toUpperCase();
    this.bookingReference = `OP-${timestamp}-${random}`;
  }

  // Calculate nights
  if (this.checkIn && this.checkOut) {
    const diffTime = Math.abs(this.checkOut - this.checkIn);
    this.nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  next();
});

// Update guest stats after booking changes
bookingSchema.post('save', async function () {
  try {
    const Guest = mongoose.model('Guest');
    const guest = await Guest.findById(this.guest);
    if (guest) {
      await guest.updateStats(this);
    }
  } catch (error) {
    console.error('Error updating guest stats:', error);
  }
});

// Virtual for balance due
bookingSchema.virtual('balanceDue').get(function () {
  return this.totalAmount - this.amountPaid;
});

// Virtual for isPaid
bookingSchema.virtual('isPaid').get(function () {
  return this.amountPaid >= this.totalAmount;
});

// Method to check for conflicts
bookingSchema.statics.checkConflict = async function (roomId, checkIn, checkOut, excludeBookingId = null) {
  const query = {
    room: roomId,
    status: { $nin: ['cancelled', 'no_show'] },
    $or: [
      { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
    ],
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBooking = await this.findOne(query);
  return conflictingBooking;
};

// Method to calculate totals
bookingSchema.methods.calculateTotals = function () {
  // Subtotal from room rate * nights
  this.pricing.subtotal = this.pricing.roomRate * this.nights;

  // Add extras
  let extrasTotal = 0;
  if (this.pricing.extras) {
    for (const extra of this.pricing.extras) {
      extra.total = extra.unitPrice * extra.quantity;
      extrasTotal += extra.total;
    }
  }

  // Calculate discounts
  let discountTotal = 0;
  if (this.pricing.discounts) {
    for (const discount of this.pricing.discounts) {
      if (discount.type === 'percentage') {
        discount.amount = (this.pricing.subtotal * discount.value) / 100;
      } else {
        discount.amount = discount.value;
      }
      discountTotal += discount.amount;
    }
  }

  // Calculate taxes
  const taxableAmount = this.pricing.subtotal + extrasTotal - discountTotal;
  const taxes = this.pricing.taxes;
  const totalTax = (taxes.vat || 0) + (taxes.cityTax || 0) + (taxes.other || 0);

  // Total
  this.totalAmount = taxableAmount + totalTax;

  return this.totalAmount;
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
