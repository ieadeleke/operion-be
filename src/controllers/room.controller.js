const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/response');
const ApiError = require('../utils/ApiError');
const Room = require('../models/Room.model');

const getAllRooms = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, roomType, status, floor, isActive } = req.query;

  const query = {};

  if (roomType) {
    query.roomType = roomType;
  }

  if (status) {
    query.status = status;
  }

  if (floor) {
    query.floor = parseInt(floor);
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  const rooms = await Room.find(query)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ floor: 1, roomNumber: 1 });

  const total = await Room.countDocuments(query);

  ApiResponse.paginated(res, rooms, { page: parseInt(page), limit: parseInt(limit), total });
});

const getAvailableRooms = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, roomType } = req.query;

  if (!checkIn || !checkOut) {
    throw ApiError.badRequest('Check-in and check-out dates are required');
  }

  const availableRooms = await Room.findAvailable(
    new Date(checkIn),
    new Date(checkOut),
    roomType
  );

  ApiResponse.success(res, { rooms: availableRooms });
});

const getRoomTypes = asyncHandler(async (req, res) => {
  const roomTypes = await Room.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$roomType',
        count: { $sum: 1 },
        minRate: { $min: '$pricing.baseRate' },
        maxRate: { $max: '$pricing.baseRate' },
      },
    },
    { $sort: { minRate: 1 } },
  ]);

  ApiResponse.success(res, { roomTypes });
});

const getRoomById = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);

  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  ApiResponse.success(res, { room });
});

const createRoom = asyncHandler(async (req, res) => {
  const room = await Room.create(req.body);

  ApiResponse.created(res, { room }, 'Room created successfully');
});

const updateRoom = asyncHandler(async (req, res) => {
  const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  ApiResponse.success(res, { room }, 'Room updated successfully');
});

const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);

  if (!room) {
    throw ApiError.notFound('Room not found');
  }

  // Soft delete
  room.isActive = false;
  await room.save();

  ApiResponse.success(res, null, 'Room deactivated successfully');
});

const bulkCreateRooms = asyncHandler(async (req, res) => {
  const { rooms } = req.body;

  if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
    throw ApiError.badRequest('Rooms array is required');
  }

  const createdRooms = await Room.insertMany(rooms, { ordered: false });

  ApiResponse.created(res, { rooms: createdRooms, count: createdRooms.length }, 'Rooms created successfully');
});

module.exports = {
  getAllRooms,
  getAvailableRooms,
  getRoomTypes,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  bulkCreateRooms,
};
