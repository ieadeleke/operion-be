const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/response');
const ApiError = require('../utils/ApiError');
const Booking = require('../models/Booking.model');
const Room = require('../models/Room.model');
const Guest = require('../models/Guest.model');

const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, startDate, endDate, guestId, roomId } = req.query;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (startDate && endDate) {
    query.checkIn = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  if (guestId) {
    query.guest = guestId;
  }

  if (roomId) {
    query.room = roomId;
  }

  const bookings = await Booking.find(query)
    .populate('guest', 'firstName lastName email phone')
    .populate('room', 'roomNumber roomType')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ checkIn: -1 });

  const total = await Booking.countDocuments(query);

  ApiResponse.paginated(res, bookings, { page: parseInt(page), limit: parseInt(limit), total });
});

const getCalendarBookings = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw ApiError.badRequest('Start date and end date are required');
  }

  const bookings = await Booking.find({
    status: { $nin: ['cancelled'] },
    $or: [
      { checkIn: { $gte: new Date(startDate), $lte: new Date(endDate) } },
      { checkOut: { $gte: new Date(startDate), $lte: new Date(endDate) } },
      { checkIn: { $lte: new Date(startDate) }, checkOut: { $gte: new Date(endDate) } },
    ],
  })
    .populate('guest', 'firstName lastName')
    .populate('room', 'roomNumber roomType')
    .select('bookingReference guest room checkIn checkOut status paymentStatus');

  ApiResponse.success(res, { bookings });
});

const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('guest')
    .populate('room')
    .populate('createdBy', 'firstName lastName')
    .populate('assignedStaff', 'firstName lastName');

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  ApiResponse.success(res, { booking });
});

const createBooking = asyncHandler(async (req, res) => {
  const { guestId, guestData, roomId, checkIn, checkOut, adults, children, source, specialRequests, pricing } = req.body;

  // Validate dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkInDate < new Date().setHours(0, 0, 0, 0)) {
    throw ApiError.badRequest('Check-in date cannot be in the past');
  }

  if (checkOutDate <= checkInDate) {
    throw ApiError.badRequest('Check-out date must be after check-in date');
  }

  // Check room availability
  const conflict = await Booking.checkConflict(roomId, checkInDate, checkOutDate);
  if (conflict) {
    throw ApiError.conflict('Room is not available for the selected dates');
  }

  // Get or create guest
  let guest;
  if (guestId) {
    guest = await Guest.findById(guestId);
    if (!guest) {
      throw ApiError.notFound('Guest not found');
    }
  } else if (guestData) {
    guest = await Guest.findOrCreate(guestData);
  } else {
    throw ApiError.badRequest('Guest ID or guest data is required');
  }

  // Get room
  const room = await Room.findById(roomId);
  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  // Calculate room rate for dates
  const roomRate = pricing?.roomRate || room.pricing.baseRate;

  // Create booking
  const booking = await Booking.create({
    guest: guest._id,
    room: room._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    adults,
    children,
    source,
    specialRequests,
    pricing: {
      roomRate,
      currency: room.pricing.currency,
      ...pricing,
    },
    totalAmount: 0,
    createdBy: req.user._id,
  });

  // Calculate totals
  booking.calculateTotals();
  await booking.save();

  // Populate and return
  await booking.populate('guest', 'firstName lastName email phone');
  await booking.populate('room', 'roomNumber roomType');

  ApiResponse.created(res, { booking }, 'Booking created successfully');
});

const updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  // Don't allow updates to cancelled bookings
  if (booking.status === 'cancelled') {
    throw ApiError.badRequest('Cannot update a cancelled booking');
  }

  const allowedFields = ['checkIn', 'checkOut', 'adults', 'children', 'specialRequests', 'internalNotes', 'pricing', 'assignedStaff'];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      booking[field] = req.body[field];
    }
  }

  // If dates changed, check availability
  if (req.body.checkIn || req.body.checkOut) {
    const conflict = await Booking.checkConflict(
      booking.room,
      booking.checkIn,
      booking.checkOut,
      booking._id
    );
    if (conflict) {
      throw ApiError.conflict('Room is not available for the new dates');
    }
  }

  // Recalculate totals
  booking.calculateTotals();
  await booking.save();

  await booking.populate('guest', 'firstName lastName email phone');
  await booking.populate('room', 'roomNumber roomType');

  ApiResponse.success(res, { booking }, 'Booking updated successfully');
});

const deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  await booking.deleteOne();

  ApiResponse.success(res, null, 'Booking deleted successfully');
});

const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  booking.status = 'confirmed';
  await booking.save();

  ApiResponse.success(res, { booking }, 'Booking confirmed');
});

const cancelBooking = asyncHandler(async (req, res) => {
  const { reason, notes } = req.body;

  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  booking.status = 'cancelled';
  booking.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: req.user._id,
    reason: reason || 'other',
    notes,
  };
  await booking.save();

  ApiResponse.success(res, { booking }, 'Booking cancelled');
});

const checkIn = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  if (booking.status !== 'confirmed') {
    throw ApiError.badRequest('Only confirmed bookings can be checked in');
  }

  booking.status = 'checked_in';
  booking.checkInDetails = {
    actualTime: new Date(),
    processedBy: req.user._id,
    notes,
  };

  // Update room status
  await Room.findByIdAndUpdate(booking.room, { status: 'occupied' });

  await booking.save();

  ApiResponse.success(res, { booking }, 'Check-in successful');
});

const checkOut = asyncHandler(async (req, res) => {
  const { notes, lateCheckoutCharge } = req.body;

  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  if (booking.status !== 'checked_in') {
    throw ApiError.badRequest('Only checked-in bookings can be checked out');
  }

  booking.status = 'checked_out';
  booking.checkOutDetails = {
    actualTime: new Date(),
    processedBy: req.user._id,
    notes,
    lateCheckoutCharge,
  };

  if (lateCheckoutCharge) {
    booking.totalAmount += lateCheckoutCharge;
  }

  // Update room status
  await Room.findByIdAndUpdate(booking.room, {
    status: 'cleaning',
    housekeepingStatus: 'dirty',
  });

  await booking.save();

  ApiResponse.success(res, { booking }, 'Check-out successful');
});

const checkAvailability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, roomType } = req.query;

  if (!checkIn || !checkOut) {
    throw ApiError.badRequest('Check-in and check-out dates are required');
  }

  const availableRooms = await Room.findAvailable(
    new Date(checkIn),
    new Date(checkOut),
    roomType
  );

  ApiResponse.success(res, { availableRooms });
});

module.exports = {
  getAllBookings,
  getCalendarBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  confirmBooking,
  cancelBooking,
  checkIn,
  checkOut,
  checkAvailability,
};
