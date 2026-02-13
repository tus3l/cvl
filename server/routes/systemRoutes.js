const express = require('express');
const router = express.Router();
const { getLoadout, saveLoadout, equipItem, unequipItem } = require('../controllers/systemController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/loadout', authMiddleware, getLoadout);
router.post('/loadout', authMiddleware, saveLoadout);
router.post('/equip', authMiddleware, equipItem);
router.post('/unequip', authMiddleware, unequipItem);

module.exports = router;