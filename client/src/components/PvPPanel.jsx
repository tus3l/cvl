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

  useEffect(() => {
    loadPlayers();
    loadIntrusionLogs();
  }, []);

  const loadPlayers = async () => {
    try {
      const res = await axios.get('/api/pvp/players');
      if (res.data.success) {
        setPlayers(res.data.players);
      }
    } catch (error) {
      console.error('Failed to load players:', error);
    }
  };

  const loadIntrusionLogs = async () => {
    try {
      const res = await axios.get('/api/pvp/intrusion-logs');
      if (res.data.success) {
        setIntrusionLogs(res.data.logs);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
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
        // Show outcome toast
        const o = res.data.outcome;
        const stats = res.data.stats;
        const msg = o.success
          ? `✓ تم الاختراق! تمت سرقة ${o.stolen?.credits ?? 0} كريدتس`
          : `✗ فشل الاختراق: الدفاع صامد. نسبة النجاح ${stats?.success_chance}%`;
        setToast({ message: msg, type: o.success ? 'success' : 'error' });
        setTimeout(() => setToast(null), 3500);
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
            <p>💰 Attack Cost: 100 Credits | 💎 Steal up to 15% of target's wealth</p>
          </div>

          <div className="players-grid">
            {players.map((player, index) => (
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

          {players.length === 0 && (
            <div className="no-players">
              <p>&gt;&gt; No other players found in the system</p>
            </div>
          )}
        </div>
      ) : (
        <div className="logs-section">
          <h2>&gt;&gt; INTRUSION_LOG_HISTORY</h2>
          <p className="logs-subtitle">Players who tried to hack you:</p>

          {intrusionLogs.length > 0 ? (
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
    </div>
  );
};

export default PvPPanel;
