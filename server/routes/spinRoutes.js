const express = require('express');
const router = express.Router();
const spinController = require('../controllers/spinController');
const authMiddleware = require('../middleware/authMiddleware');

// Debug: list available handlers
try {
	console.log('>> spinController handlers:', Object.keys(spinController));
} catch {}

router.get('/manifest', spinController.getManifest);
router.post('/hack', authMiddleware, spinController.executeSpin);
router.get('/inventory', authMiddleware, spinController.getInventory);
router.post('/use-item', authMiddleware, spinController.useItem);
if (typeof spinController.equipItem === 'function') {
	router.post('/equip-item', authMiddleware, spinController.equipItem);
} else {
	console.warn('>> WARNING: equipItem handler missing; route not registered');
}

module.exports = router;
