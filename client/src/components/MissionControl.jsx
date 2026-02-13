import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import './MissionControl.css';
import LoadoutModal from './LoadoutModal';

const MissionControl = ({ user, updateUser }) => {
  const [missions, setMissions] = useState({ government: [], private: [] });
  const [daily, setDaily] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showLoadout, setShowLoadout] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMissions();
    loadDaily();
  }, []);

  const loadMissions = async () => {
    // Government/Private sectors hidden per request; skip loading list
    setMissions({ government: [], private: [] });
  };

  const loadDaily = async () => {
    try {
      const res = await axios.get('/api/mission/daily');
      if (res.data.success) setDaily(res.data.missions);
    } catch (e) {
      console.error('Failed to load daily missions:', e);
    }
  };

  const claimDaily = async (missionId) => {
    try {
      const res = await axios.post('/api/mission/daily/claim', { missionId });
      if (res.data.success) {
        setDaily(res.data.missions);
        updateUser(res.data.user);
      }
    } catch (e) {
      console.error('Failed to claim daily mission:', e);
    }
  };

  const selectMission = (mission) => {
    setSelectedMission(mission);
    setShowLoadout(true);
  };

  const executeMission = async (loadout) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/mission/execute', {
        targetId: selectedMission.id,
        loadout
      });

      if (res.data.success) {
        updateUser(res.data.user);
        return res.data.outcome;
      } else {
        return { success: false, message: res.data.message };
      }
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '>> ERROR: Mission failed'
      };
    } finally {
      setLoading(false);
    }
  };

  const isExposed = user.exposed_until && new Date(user.exposed_until) > new Date();

  return (
    <div className="mission-control">
      <motion.div
        className="mission-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="neon-title">&gt;&gt; MISSION_CONTROL</h1>
        <div className="hacker-stats">
          <div className="stat">
            <span className="stat-label">REPUTATION:</span>
            <span className="stat-value">{user.reputation}</span>
          </div>
          <div className="stat">
            <span className="stat-label">LEVEL:</span>
            <span className="stat-value">{user.level}</span>
          </div>
          <div className="stat">
            <span className="stat-label">XP:</span>
            <span className="stat-value">{user.xp}</span>
          </div>
        </div>
        {isExposed && (
          <div className="exposure-warning">
            ⚠️ &gt;&gt; WARNING: YOU ARE EXPOSED! Defense systems offline until {new Date(user.exposed_until).toLocaleTimeString()}
          </div>
        )}
      </motion.div>

      <div className="mission-sectors">
        {/* Daily Missions */}
        <motion.div
          className="sector daily-sector"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="sector-header">
            <h2>🗓️ DAILY MISSIONS</h2>
            <p className="sector-subtitle">Resets at midnight</p>
          </div>
          <div className="mission-list">
            {daily.map((m, idx) => {
              const pct = Math.floor(((m.progress || 0) / m.target) * 100);
              const canClaim = (m.progress || 0) >= m.target && !m.claimed;
              const lvl = user.level || 1;
              const levelDifficulty = lvl < 5 ? 'EASY' : (lvl < 15 ? 'MEDIUM' : (lvl < 30 ? 'HARD' : 'INSANE'));
              return (
                <motion.div
                  key={m.id}
                  className={`mission-card ${canClaim ? 'claimable' : ''}`}
                  whileHover={{ scale: 1.03 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                >
                  <div className="mission-name">{m.name}</div>
                  <div className="mission-desc">{m.description}</div>
                  <div className="mission-difficulty">DIFFICULTY: <span className="value-medium">{levelDifficulty}</span></div>
                  <div className="mission-progress">Progress: {m.progress}/{m.target} ({pct}%)</div>
                  <div className="mission-rewards">
                    <div>💰 +{m.reward.credits}</div>
                    <div>💎 +{m.reward.gems}</div>
                    <div>⭐ +{m.reward.xp}</div>
                  </div>
                  <div className="mission-actions">
                    <button className="cyber-button" onClick={loadDaily}>
                      REFRESH
                    </button>
                    <button className="cyber-button" disabled={!canClaim} onClick={() => claimDaily(m.id)}>
                      CLAIM
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
        {/* Government and Private sectors removed per request */}
      </div>

      <AnimatePresence>
        {showLoadout && (
          <LoadoutModal
            mission={selectedMission}
            user={user}
            onClose={() => setShowLoadout(false)}
            onExecute={executeMission}
            loading={loading}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MissionControl;
