const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const bookingRoutes = require('./booking.routes');
const roomRoutes = require('./room.routes');
const guestRoutes = require('./guest.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bookings', bookingRoutes);
router.use('/rooms', roomRoutes);
router.use('/guests', guestRoutes);

module.exports = router;
