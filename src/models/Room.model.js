const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    roomType: {
      type: String,
      required: [true, 'Room type is required'],
      enum: ['single', 'double', 'twin', 'suite', 'deluxe', 'family', 'presidential'],
    },
    floor: {
      type: Number,
      required: true,
    },
    building: {
      type: String,
      default: 'main',
    },
    description: String,
    amenities: [{
      type: String,
      enum: [
        'wifi',
        'tv',
        'minibar',
        'safe',
        'air_conditioning',
        'heating',
        'balcony',
        'sea_view',
        'city_view',
        'garden_view',
        'bathtub',
        'shower',
        'jacuzzi',
        'kitchen',
        'living_room',
        'workspace',
        'iron',
        'coffee_maker',
        'room_service',
      ],
    }],
    bedConfiguration: {
      type: {
        type: String,
        enum: ['single', 'double', 'king', 'queen', 'twin', 'sofa_bed'],
      },
      count: { type: Number, default: 1 },
      extraBedAvailable: { type: Boolean, default: false },
    },
    maxOccupancy: {
      adults: { type: Number, default: 2 },
      children: { type: Number, default: 1 },
      total: { type: Number, default: 3 },
    },
    size: {
      value: Number,
      unit: {
        type: String,
        enum: ['sqm', 'sqft'],
        default: 'sqm',
      },
    },
    images: [{
      url: String,
      caption: String,
      isPrimary: { type: Boolean, default: false },
    }],
    pricing: {
      baseRate: {
        type: Number,
        required: [true, 'Base rate is required'],
      },
      currency: {
        type: String,
        default: 'GBP',
      },
      weekendRate: Number,
      seasonalRates: [{
        name: String,
        startDate: Date,
        endDate: Date,
        rate: Number,
        minimumStay: { type: Number, default: 1 },
      }],
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'blocked', 'cleaning'],
      default: 'available',
    },
    housekeepingStatus: {
      type: String,
      enum: ['clean', 'dirty', 'inspected', 'in_progress'],
      default: 'clean',
    },
    lastCleaned: Date,
    maintenanceNotes: String,
    isSmokingAllowed: {
      type: Boolean,
      default: false,
    },
    isAccessible: {
      type: Boolean,
      default: false,
    },
    isPetFriendly: {
      type: Boolean,
      default: false,
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

// Index for availability searches
roomSchema.index({ roomType: 1, status: 1, isActive: 1 });
roomSchema.index({ floor: 1 });
roomSchema.index({ 'pricing.baseRate': 1 });

// Virtual for display name
roomSchema.virtual('displayName').get(function () {
  return `Room ${this.roomNumber} - ${this.roomType.charAt(0).toUpperCase() + this.roomType.slice(1)}`;
});

// Method to get current rate based on date
roomSchema.methods.getRateForDate = function (date) {
  const checkDate = new Date(date);

  // Check seasonal rates first
  for (const seasonal of this.pricing.seasonalRates || []) {
    if (checkDate >= seasonal.startDate && checkDate <= seasonal.endDate) {
      return seasonal.rate;
    }
  }

  // Check weekend rate
  const dayOfWeek = checkDate.getDay();
  if ((dayOfWeek === 0 || dayOfWeek === 6) && this.pricing.weekendRate) {
    return this.pricing.weekendRate;
  }

  return this.pricing.baseRate;
};

// Static method to find available rooms for date range
roomSchema.statics.findAvailable = async function (checkIn, checkOut, roomType = null) {
  const Booking = mongoose.model('Booking');

  // Find all bookings that overlap with the date range
  const overlappingBookings = await Booking.find({
    status: { $nin: ['cancelled'] },
    $or: [
      { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
    ],
  }).select('room');

  const bookedRoomIds = overlappingBookings.map((b) => b.room);

  // Build query
  const query = {
    _id: { $nin: bookedRoomIds },
    status: { $in: ['available', 'cleaning'] },
    isActive: true,
  };

  if (roomType) {
    query.roomType = roomType;
  }

  return this.find(query).sort({ floor: 1, roomNumber: 1 });
};

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
