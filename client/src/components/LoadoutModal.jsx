import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './LoadoutModal.css';

const LoadoutModal = ({ mission, user, onClose, onExecute, loading }) => {
  const [loadout, setLoadout] = useState({
    hardware: null,
    software: null,
    crew: null
  });
  const [outcome, setOutcome] = useState(null);
  const [executing, setExecuting] = useState(false);

  // Mock inventory items (you'll replace this with real inventory)
  const mockInventory = {
    hardware: [
      { id: 'h1', name: 'USB FlashHacker', level: 20, type: 'hardware' },
      { id: 'h2', name: 'Quantum Laptop', level: 50, type: 'hardware' },
      { id: 'h3', name: 'Neural Interface', level: 80, type: 'hardware' }
    ],
    software: [
      { id: 's1', name: 'Brute Force Script', level: 15, type: 'software' },
      { id: 's2', name: 'SQL Injector Pro', level: 40, type: 'software' },
      { id: 's3', name: 'Zero-Day Exploit', level: 70, type: 'software' }
    ],
    crew: [
      { id: 'c1', name: 'Ghost', skill_level: 10, role: 'Decryptor', type: 'crew' },
      { id: 'c2', name: 'Cipher', skill_level: 25, role: 'Infiltrator', type: 'crew' },
      { id: 'c3', name: 'Phoenix', skill_level: 40, role: 'Elite Hacker', type: 'crew' }
    ]
  };

  const selectItem = (slot, item) => {
    setLoadout(prev => ({ ...prev, [slot]: item }));
  };

  const canExecute = loadout.hardware && loadout.software && loadout.crew;

  const handleExecute = async () => {
    if (!canExecute) return;

    setExecuting(true);
    const result = await onExecute(loadout);
    setOutcome(result);
    setExecuting(false);
  };

  const handleClose = () => {
    setOutcome(null);
    onClose();
  };

  const totalPower = (loadout.hardware?.level || 0) + (loadout.software?.level || 0) + ((loadout.crew?.skill_level || 0) * 2);

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
    >
      <motion.div
        className="loadout-modal"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {!outcome ? (
          <>
            <div className="modal-header">
              <h2>&gt;&gt; MISSION_PREP</h2>
              <button className="close-btn" onClick={handleClose}>✕</button>
            </div>

            <div className="mission-info">
              <h3>{mission.name}</h3>
              <p>Target Difficulty: <span className="difficulty-value">{mission.difficulty}</span></p>
              <p>Your Attack Power: <span className="power-value">{totalPower}</span></p>
              <p className="mission-cost">Cost: 50 Crypto Credits</p>
            </div>

            <div className="loadout-slots">
              {/* Hardware Slot */}
              <div className="slot-section">
                <h4>🖥️ HARDWARE</h4>
                <div className="item-grid">
                  {mockInventory.hardware.map(item => (
                    <div
                      key={item.id}
                      className={`item-card ${loadout.hardware?.id === item.id ? 'selected' : ''}`}
                      onClick={() => selectItem('hardware', item)}
                    >
                      <div className="item-name">{item.name}</div>
                      <div className="item-level">Level {item.level}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Software Slot */}
              <div className="slot-section">
                <h4>💾 SOFTWARE</h4>
                <div className="item-grid">
                  {mockInventory.software.map(item => (
                    <div
                      key={item.id}
                      className={`item-card ${loadout.software?.id === item.id ? 'selected' : ''}`}
                      onClick={() => selectItem('software', item)}
                    >
                      <div className="item-name">{item.name}</div>
                      <div className="item-level">Level {item.level}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crew Slot */}
              <div className="slot-section">
                <h4>👤 CREW MEMBER</h4>
                <div className="item-grid">
                  {mockInventory.crew.map(item => (
                    <div
                      key={item.id}
                      className={`item-card ${loadout.crew?.id === item.id ? 'selected' : ''}`}
                      onClick={() => selectItem('crew', item)}
                    >
                      <div className="item-name">{item.name}</div>
                      <div className="item-role">{item.role}</div>
                      <div className="item-level">Skill {item.skill_level}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="execute-btn"
                onClick={handleExecute}
                disabled={!canExecute || executing || user.crypto_credits < 50}
              >
                {executing ? 'EXECUTING...' : '> INITIATE_ATTACK'}
              </button>
              {!canExecute && <p className="warning-text">⚠️ All 3 slots required!</p>}
              {user.crypto_credits < 50 && <p className="warning-text">⚠️ Insufficient funds!</p>}
            </div>
          </>
        ) : (
          <div className="outcome-screen">
            <h2 className={outcome.success ? 'outcome-success' : 'outcome-failure'}>
              {outcome.success ? '✓ MISSION SUCCESSFUL' : '✗ MISSION FAILED'}
            </h2>
            <div className="outcome-message">{outcome.message}</div>
            
            {outcome.success && (
              <div className="outcome-rewards">
                <div className="reward-item">💰 +{outcome.reward} Credits</div>
                <div className="reward-item">💎 +{outcome.gems} Gems</div>
                <div className="reward-item">⭐ +{outcome.xp} XP</div>
                {outcome.levelUp && (
                  <div className="level-up">🎉 LEVEL UP! Now Level {outcome.newLevel}</div>
                )}
              </div>
            )}

            {outcome.type === 'compromised' && (
              <div className="compromised-warning">
                ⚠️ YOU ARE NOW EXPOSED FOR 1 HOUR!
                <br />
                Reputation Lost: {outcome.reputationLoss}
              </div>
            )}

            <div className="outcome-stats">
              <p>Your Attack Score: {outcome.attackScore}</p>
              <p>Target Difficulty: {outcome.targetDifficulty}</p>
              <p>Success Chance: {outcome.successChance}%</p>
            </div>

            <button className="close-btn-outcome" onClick={handleClose}>
              &gt; CONTINUE
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default LoadoutModal;
