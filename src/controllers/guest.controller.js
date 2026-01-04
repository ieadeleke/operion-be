const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/response');
const ApiError = require('../utils/ApiError');
const Guest = require('../models/Guest.model');
const Booking = require('../models/Booking.model');

const getAllGuests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, vipStatus, source } = req.query;

  const query = { isActive: true };

  if (vipStatus) {
    query.vipStatus = vipStatus;
  }

  if (source) {
    query.source = source;
  }

  const guests = await Guest.find(query)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ 'stats.totalSpend': -1 });

  const total = await Guest.countDocuments(query);

  ApiResponse.paginated(res, guests, { page: parseInt(page), limit: parseInt(limit), total });
});

const searchGuests = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    throw ApiError.badRequest('Search query must be at least 2 characters');
  }

  const guests = await Guest.find({
    isActive: true,
    $or: [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ],
  })
    .limit(parseInt(limit))
    .select('firstName lastName email phone vipStatus');

  ApiResponse.success(res, { guests });
});

const getGuestById = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);

  if (!guest) {
    throw ApiError.notFound('Guest not found');
  }

  ApiResponse.success(res, { guest });
});

const createGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.create(req.body);

  ApiResponse.created(res, { guest }, 'Guest created successfully');
});

const updateGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!guest) {
    throw ApiError.notFound('Guest not found');
  }

  ApiResponse.success(res, { guest }, 'Guest updated successfully');
});

const deleteGuest = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id);

  if (!guest) {
    throw ApiError.notFound('Guest not found');
  }

  // Soft delete
  guest.isActive = false;
  await guest.save();

  ApiResponse.success(res, null, 'Guest deactivated successfully');
});

const getGuestBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const bookings = await Booking.find({ guest: req.params.id })
    .populate('room', 'roomNumber roomType')
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ checkIn: -1 });

  const total = await Booking.countDocuments({ guest: req.params.id });

  ApiResponse.paginated(res, bookings, { page: parseInt(page), limit: parseInt(limit), total });
});

const getGuestCommunications = asyncHandler(async (req, res) => {
  const guest = await Guest.findById(req.params.id).select('communications');

  if (!guest) {
    throw ApiError.notFound('Guest not found');
  }

  const communications = guest.communications.sort((a, b) => b.timestamp - a.timestamp);

  ApiResponse.success(res, { communications });
});

const updateGuestPreferences = asyncHandler(async (req, res) => {
  const guest = await Guest.findByIdAndUpdate(
    req.params.id,
    { preferences: req.body },
    { new: true, runValidators: true }
  );

  if (!guest) {
    throw ApiError.notFound('Guest not found');
  }

  ApiResponse.success(res, { guest }, 'Preferences updated successfully');
});

const mergeGuests = asyncHandler(async (req, res) => {
  const { primaryId, secondaryId } = req.body;

  if (!primaryId || !secondaryId) {
    throw ApiError.badRequest('Primary and secondary guest IDs are required');
  }

  const primary = await Guest.findById(primaryId);
  const secondary = await Guest.findById(secondaryId);

  if (!primary || !secondary) {
    throw ApiError.notFound('One or both guests not found');
  }

  // Update all bookings from secondary to primary
  await Booking.updateMany({ guest: secondaryId }, { guest: primaryId });

  // Merge communications
  primary.communications.push(...secondary.communications);

  // Merge notes
  if (secondary.notes) {
    primary.notes = primary.notes
      ? `${primary.notes}\n\n[Merged from ${secondary.fullName}]: ${secondary.notes}`
      : secondary.notes;
  }

  // Merge tags
  primary.tags = [...new Set([...primary.tags, ...secondary.tags])];

  // Keep higher VIP status
  const vipOrder = ['regular', 'silver', 'gold', 'platinum', 'vip'];
  if (vipOrder.indexOf(secondary.vipStatus) > vipOrder.indexOf(primary.vipStatus)) {
    primary.vipStatus = secondary.vipStatus;
  }

  await primary.save();

  // Deactivate secondary
  secondary.isActive = false;
  await secondary.save();

  // Update stats
  await primary.updateStats();

  ApiResponse.success(res, { guest: primary }, 'Guests merged successfully');
});

module.exports = {
  getAllGuests,
  searchGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
  getGuestBookings,
  getGuestCommunications,
  updateGuestPreferences,
  mergeGuests,
};
