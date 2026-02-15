import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import './PvPPanel.css';
import MatrixMiniGame from './MatrixMiniGame';
import MatrixBreach from './MatrixBreach';

const PvPPanel = ({ user, updateUser }) => {
  const [players, setPlayers] = useState([]);
  const [intrusionLogs, setIntrusionLogs] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [hacking, setHacking] = useState(false);
  const [showMiniGame, setShowMiniGame] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [attackResult, setAttackResult] = useState(null);

  useEffect(() => {
    loadPlayers();
    loadIntrusionLogs();
  }, []);

  const loadPlayers = async () => {
    try {
      const res = await axios.get('/api/pvp/players');
      if (res.data.success) {
        // Ensure players is an array
        const players = Array.isArray(res.data.players) ? res.data.players : [];
        setPlayers(players);
      }
    } catch (error) {
      console.error('Failed to load players:', error);
      setPlayers([]); // Set empty array on error
    }
  };

  const loadIntrusionLogs = async () => {
    try {
      const res = await axios.get('/api/pvp/intrusion-logs');
      if (res.data.success) {
        // Ensure logs is an array
        const logs = Array.isArray(res.data.logs) ? res.data.logs : [];
        setIntrusionLogs(logs);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setIntrusionLogs([]); // Set empty array on error
    }
  };

  const attackPlayer = async ({ miniGameScore }) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/pvp/attack', {
        targetUserId: selectedTarget.id,
        miniGameScore
      });

      if (res.data.success) {
        updateUser(res.data.user);
        loadPlayers(); // Refresh player list
        // Show detailed result panel
        const o = res.data.outcome;
        const stats = res.data.stats;
        setAttackResult({
          success: o.success,
          target: selectedTarget.username,
          stolen: o.stolen?.credits ?? 0,
          xpGained: o.xp_gained || 0,
          repGained: o.rep_gained || 0,
          attackScore: stats?.attack_score || 0,
          defenseScore: stats?.defense_score || 0,
          successChance: stats?.success_chance || 0,
          ddosUsed: o.ddosUsed || false
        });
        return {
          ...res.data.outcome,
          stats: res.data.stats
        };
      } else {
        setToast({ message: res.data.message || 'خطأ في العملية', type: 'error' });
        setTimeout(() => setToast(null), 3500);
        return { success: false, message: res.data.message };
      }
    } catch (error) {
      setToast({ message: error.response?.data?.message || 'فشل الاتصال بالسيرفر', type: 'error' });
      setTimeout(() => setToast(null), 3500);
      return {
        success: false,
        message: error.response?.data?.message || '>> ERROR: Attack failed'
      };
    } finally {
      setLoading(false);
    }
  };

  const selectTarget = (player) => {
    setSelectedTarget(player);
    setHacking(true);
    setTimeout(() => {
      setHacking(false);
      setShowMiniGame(true);
    }, 900);
  };

  const revengeAttack = (log) => {
    const target = players.find(p => p.id === log.attacker_id);
    if (target) {
      selectTarget(target);
    }
  };

  return (
    <div className="pvp-panel">
      <div className="pvp-header">
        <h1 className="neon-title">&gt;&gt; PVP_COMBAT_ZONE</h1>
        <div className="pvp-actions">
          <button 
            className="cyber-button" 
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? '👥 SHOW PLAYERS' : '📋 INTRUSION LOGS'}
          </button>
          <button className="cyber-button" onClick={loadPlayers}>
            🔄 REFRESH
          </button>
        </div>
      </div>

      {!showLogs ? (
        <div className="players-section">
          <div className="section-info">
            <p>💰 Attack Cost: 100 Credits | 💎 Steal up to 25% of target's wealth</p>
          </div>

          <div className="players-grid">
            {Array.isArray(players) && players.map((player, index) => (
              <motion.div
                key={player.id}
                className={`player-card ${player.is_exposed ? 'exposed' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.03 }}
              >
                <div className="player-header">
                  <h3>{player.username}</h3>
                  {player.is_exposed && (
                    <span className="exposed-badge">🔴 EXPOSED</span>
                  )}
                </div>

                <div className="player-stats">
                  <div className="stat-row">
                    <span>Level:</span>
                    <span className="stat-value">{player.level}</span>
                  </div>
                  <div className="stat-row">
                    <span>Reputation:</span>
                    <span className="stat-value">{player.reputation}</span>
                  </div>
                  <div className="stat-row">
                    <span>Defense:</span>
                    <span className="stat-value">{player.defense_level}</span>
                  </div>
                </div>

                <button
                  className="attack-btn"
                  onClick={() => selectTarget(player)}
                  disabled={user.crypto_credits < 100}
                  title={user.crypto_credits < 100 ? 'ERROR: Insufficient credits' : 'Initiate attack'}
                >
                  ⚔️ ATTACK
                </button>

                {player.is_exposed && (
                  <div className="exposed-note">
                    ⚡ 50% Weaker Defense!
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {(!Array.isArray(players) || players.length === 0) && (
            <div className="no-players">
              <p>&gt;&gt; No other players found in the system</p>
            </div>
          )}
        </div>
      ) : (
        <div className="logs-section">
          <h2>&gt;&gt; INTRUSION_LOG_HISTORY</h2>
          <p className="logs-subtitle">Players who tried to hack you:</p>

          {Array.isArray(intrusionLogs) && intrusionLogs.length > 0 ? (
            <div className="logs-list">
              {intrusionLogs.slice().reverse().map((log, index) => (
                <motion.div
                  key={index}
                  className={`log-entry ${log.result === 'success' ? 'log-failure' : 'log-success'}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="log-header">
                    <span className="log-attacker">👤 {log.attacker_name}</span>
                    <span className={`log-result ${log.result === 'success' ? 'result-breach' : 'result-blocked'}`}>
                      {log.result === 'success' ? '✗ BREACHED' : '✓ BLOCKED'}
                    </span>
                  </div>

                  <div className="log-details">
                    <span>⏰ {new Date(log.time).toLocaleString()}</span>
                    <span>⚔️ Attack: {log.attack_score}</span>
                    <span>🛡️ Defense: {log.defense_score}</span>
                  </div>

                  {log.result === 'blocked' && (
                    <button
                      className="revenge-btn"
                      onClick={() => revengeAttack(log)}
                    >
                      ⚡ REVENGE
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="no-logs">
              <p>&gt;&gt; No intrusion attempts recorded</p>
              <p className="hint">Your system is secure... for now.</p>
            </div>
          )}
        </div>
      )}

      {hacking && (
        <div className="mini-overlay" onClick={() => setHacking(false)}>
          <div className="mini-card">
            <div className="mini-header">&gt;&gt; جاري التهكير</div>
            <div className="mini-body">يتم فتح قنوات الاختراق...</div>
          </div>
        </div>
      )}

      {showMiniGame && selectedTarget && (
        (() => {
          const eq = user?.equipped_loadout || user?.equipment || {};
          let cpuTier = 0;
          const cpu = eq['core:cpu'];
          if (cpu && (cpu.code === 'quantum_cpu' || /quantum/i.test(cpu.name || ''))) cpuTier = 3;
          else if (cpu && (cpu.code === 'rusty_cpu' || /rusty/i.test(cpu.name || ''))) cpuTier = 1;
          const firewallLevel = selectedTarget.defense_level || 0;
          return (
            <MatrixBreach
              cpuTier={cpuTier}
              firewallLevel={firewallLevel}
              user={user}
              onFail={() => { setShowMiniGame(false); setSelectedTarget(null); }}
              onSuccess={async (score) => {
                // After solving the sequence, show hacking status then execute
                setShowMiniGame(false);
                setHacking(true);
                const outcome = await attackPlayer({ miniGameScore: score });
                setHacking(false);
                console.log('>> MATRIX_BREACH_OUTCOME:', outcome);
              }}
            />
          );
        })()
      )}

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 10000 }}>
          <div style={{
            background: toast.type === 'success' ? '#153e15' : '#3e1515',
            border: `1px solid ${toast.type === 'success' ? '#2cfb4b' : '#ff4b4b'}`,
            color: '#eaffea',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: `0 0 12px ${toast.type === 'success' ? '#2cfb4b' : '#ff4b4b'}`,
            fontFamily: 'monospace'
          }}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Attack Result Panel */}
      <AnimatePresence>
        {attackResult && (
          <motion.div
            className="attack-result-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAttackResult(null)}
          >
            <motion.div
              className={`attack-result-panel ${attackResult.success ? 'result-success' : 'result-failed'}`}
              initial={{ scale: 0, y: -50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="result-header">
                <h2 className="neon-glow">
                  {attackResult.success ? '🔓 BREACH SUCCESSFUL' : '🛡️ ATTACK BLOCKED'}
                </h2>
                <div className="result-target">Target: {attackResult.target}</div>
                {attackResult.ddosUsed && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #ff0000, #ff4400)',
                    borderRadius: '6px',
                    fontSize: '0.9em',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    boxShadow: '0 0 20px rgba(255, 0, 0, 0.6)',
                    animation: 'pulse 1s infinite'
                  }}>
                    ⚠️ DDoS ATTACK DEPLOYED ⚠️<br/>
                    <span style={{ fontSize: '0.85em', opacity: 0.9 }}>Target frozen for 3 seconds</span>
                  </div>
                )}
              </div>

              <div className="result-stats">
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-info">
                    <div className="stat-label">Credits Stolen</div>
                    <div className="stat-value" style={{ color: attackResult.success ? '#00ff00' : '#ff4444' }}>
                      {attackResult.success ? `+${attackResult.stolen}` : '0'}
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">⚔️</div>
                  <div className="stat-info">
                    <div className="stat-label">Attack Power</div>
                    <div className="stat-value">{attackResult.attackScore}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">🛡️</div>
                  <div className="stat-info">
                    <div className="stat-label">Defense Power</div>
                    <div className="stat-value">{attackResult.defenseScore}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-info">
                    <div className="stat-label">Success Rate</div>
                    <div className="stat-value">{attackResult.successChance}%</div>
                  </div>
                </div>

                {attackResult.success && (
                  <>
                    <div className="stat-card">
                      <div className="stat-icon">✨</div>
                      <div className="stat-info">
                        <div className="stat-label">XP Gained</div>
                        <div className="stat-value" style={{ color: '#00ffff' }}>+{attackResult.xpGained}</div>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-icon">🏆</div>
                      <div className="stat-info">
                        <div className="stat-label">Reputation</div>
                        <div className="stat-value" style={{ color: '#ffd700' }}>+{attackResult.repGained}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                className="cyber-button result-close-btn"
                onClick={() => setAttackResult(null)}
              >
                [ CONTINUE ]
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PvPPanel;
