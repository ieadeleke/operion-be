const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

// User profile routes
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);

// Admin routes
router.get('/', authorize('owner', 'admin'), userController.getAllUsers);
router.get('/:id', authorize('owner', 'admin'), userController.getUserById);
router.post('/', authorize('owner', 'admin'), userController.createUser);
router.patch('/:id', authorize('owner', 'admin'), userController.updateUser);
router.delete('/:id', authorize('owner'), userController.deleteUser);

module.exports = router;
