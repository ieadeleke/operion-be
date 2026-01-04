const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Booking CRUD
router.get('/', bookingController.getAllBookings);
router.get('/calendar', bookingController.getCalendarBookings);
router.get('/:id', bookingController.getBookingById);
router.post('/', bookingController.createBooking);
router.patch('/:id', bookingController.updateBooking);
router.delete('/:id', authorize('owner', 'admin', 'manager'), bookingController.deleteBooking);

// Booking actions
router.post('/:id/confirm', bookingController.confirmBooking);
router.post('/:id/cancel', bookingController.cancelBooking);
router.post('/:id/check-in', bookingController.checkIn);
router.post('/:id/check-out', bookingController.checkOut);

// Availability check (can be public)
router.get('/availability/check', bookingController.checkAvailability);

module.exports = router;
