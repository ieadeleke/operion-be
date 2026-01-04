const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/response');
const ApiError = require('../utils/ApiError');
const User = require('../models/User.model');

const getProfile = asyncHandler(async (req, res) => {
  ApiResponse.success(res, { user: req.user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'phone', 'avatar'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  ApiResponse.success(res, { user }, 'Profile updated successfully');
});

const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, department, isActive } = req.query;

  const query = {};

  if (search) {
    query.$text = { $search: search };
  }

  if (role) {
    query.role = role;
  }

  if (department) {
    query.department = department;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  const users = await User.find(query)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  ApiResponse.paginated(res, users, { page: parseInt(page), limit: parseInt(limit), total });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  ApiResponse.success(res, { user });
});

const createUser = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone, role, department, permissions } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('User with this email already exists');
  }

  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    phone,
    role,
    department,
    permissions,
  });

  ApiResponse.created(res, { user }, 'User created successfully');
});

const updateUser = asyncHandler(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'phone', 'role', 'department', 'permissions', 'isActive'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  ApiResponse.success(res, { user }, 'User updated successfully');
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Soft delete - set isActive to false
  user.isActive = false;
  await user.save();

  ApiResponse.success(res, null, 'User deactivated successfully');
});

module.exports = {
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
