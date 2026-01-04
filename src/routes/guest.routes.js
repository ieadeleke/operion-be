const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Guest CRUD
router.get('/', guestController.getAllGuests);
router.get('/search', guestController.searchGuests);
router.get('/:id', guestController.getGuestById);
router.post('/', guestController.createGuest);
router.patch('/:id', guestController.updateGuest);
router.delete('/:id', guestController.deleteGuest);

// Guest history and preferences
router.get('/:id/bookings', guestController.getGuestBookings);
router.get('/:id/communications', guestController.getGuestCommunications);
router.patch('/:id/preferences', guestController.updateGuestPreferences);

// Merge duplicates
router.post('/merge', guestController.mergeGuests);

module.exports = router;
