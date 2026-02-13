const express = require('express');
const router = express.Router();
const { getPlayers, attackPlayer, getIntrusionLogs, updateDefense } = require('../controllers/pvpController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/players', authMiddleware, getPlayers);
router.post('/attack', authMiddleware, attackPlayer);
router.get('/intrusion-logs', authMiddleware, getIntrusionLogs);
router.post('/defense', authMiddleware, updateDefense);

module.exports = router;
