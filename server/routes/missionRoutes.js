const express = require('express');
const router = express.Router();
const { getMissions, executeMission, getDailyMissions, updateDailyProgress, claimDailyMission } = require('../controllers/missionController');
const protect = require('../middleware/authMiddleware');

router.get('/list', protect, getMissions);
router.post('/execute', protect, executeMission);
// Daily missions
router.get('/daily', protect, getDailyMissions);
router.post('/daily/update', protect, updateDailyProgress);
router.post('/daily/claim', protect, claimDailyMission);

module.exports = router;
