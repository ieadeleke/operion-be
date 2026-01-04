const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Room CRUD
router.get('/', roomController.getAllRooms);
router.get('/available', roomController.getAvailableRooms);
router.get('/types', roomController.getRoomTypes);
router.get('/:id', roomController.getRoomById);
router.post('/', authorize('owner', 'admin', 'manager'), roomController.createRoom);
router.patch('/:id', authorize('owner', 'admin', 'manager'), roomController.updateRoom);
router.delete('/:id', authorize('owner', 'admin'), roomController.deleteRoom);

// Bulk operations
router.post('/bulk', authorize('owner', 'admin'), roomController.bulkCreateRooms);

module.exports = router;
