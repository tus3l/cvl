const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const marketController = require('../controllers/marketController');
const { validatePriceMiddleware } = require('../middleware/validatePrice');

// Public: list marketplace items with sorting and rarity filter
router.get('/listings', marketController.listings);

// Auth: sell an item (remove from inventory and list)
router.post('/sell', authMiddleware, validatePriceMiddleware, marketController.sell);

// Auth: buy a listing
router.post('/buy', authMiddleware, marketController.buy);

module.exports = router;
