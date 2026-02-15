import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { getBackendBase, getCachedBackendBase } from '../backend';
import { io } from 'socket.io-client';
import './GameDashboard.css';
import MissionControl from './MissionControl';
import PvPPanel from './PvPPanel';
import Leaderboard from './Leaderboard';
import Market from './Market';
import MySystem from './MySystem';

const GameDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const [backendBase, setBackendBase] = useState(getCachedBackendBase());
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState(null);
  const [message, setMessage] = useState('');
  const [showReward, setShowReward] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null);
  const [xpProgress, setXpProgress] = useState({ current: 0, toNext: 100, currentLevel: 1 });
  const [hackingText, setHackingText] = useState('');
  const [activeTab, setActiveTab] = useState('spin');
  const [lbMetric, setLbMetric] = useState('earnings');
  const [lbRefreshTick, setLbRefreshTick] = useState(0);
  const [slots, setSlots] = useState(['?', '?', '?']); // The 3 slot machine reels
  const [slotsStopped, setSlotsStopped] = useState([false, false, false]); // Track which slots have stopped
  const [timeTick, setTimeTick] = useState(0); // re-render timer overlays
  const [isAutoSpinning, setIsAutoSpinning] = useState(false); // Auto spin state
  const [autoSpinCount, setAutoSpinCount] = useState(0); // Count auto spins

  const getSpinCostClient = (level) => {
    const lvl = Math.max(1, level || 1);
    const step = Math.floor(lvl / 5);
    return 150 * Math.pow(2, step);
  };

  // Calculate hack duration based on equipped items
  const calculateHackDuration = () => {
    let baseDuration = 2; // 2 seconds base
    const equipment = user?.equipment || {};
    
    // Check each equipment slot
    Object.values(equipment).forEach(item => {
      if (!item || !item.code) return;
      
      // Rusty items: +0.3s each (CPU, RAM, Cooling)
      if (item.code === 'rusty_cpu' || item.code === 'rusty_ram' || item.code === 'rusty_cooling') {
        baseDuration += 0.3;
      }
      
      // Quantum CPU: +1.5s
      if (item.code === 'quantum_cpu') {
        baseDuration += 1.5;
      }
    });
    
    return baseDuration;
  };

  // Discover backend base and set axios defaults
  useEffect(() => {
    (async () => {
      const base = await getBackendBase();
      if (base) {
        setBackendBase(base);
        axios.defaults.baseURL = base;
        axios.defaults.withCredentials = true;
      }
    })();
  }, []);

  // Tick every second to update remaining time overlays on items
  useEffect(() => {
    const id = setInterval(() => setTimeTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Periodically refresh inventory to reflect server-side expiry cleanup
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await axios.get('/api/spin/inventory');
        if (res.data && res.data.success) {
          updateUser({ inventory: res.data.inventory });
        }
      } catch (e) {
        // ignore transient errors
      }
    }, 10000);
    return () => clearInterval(id);
  }, [updateUser]);

  // Ghost broadcasts via Socket.io
  useEffect(() => {
    const base = backendBase || 'https://cvl-backend-n5p6.onrender.com';
    const socket = io(base, { withCredentials: true });
    socket.on('ghost_level_up', (payload) => {
      // Show ephemeral toast and refresh leaderboard
      addToast(payload.message, 'level');
      if (activeTab === 'leaderboard') setLbRefreshTick((x) => x + 1);
    });
    socket.on('ghost_big_win', (payload) => {
      addToast(payload.message, 'win');
      if (activeTab === 'leaderboard') setLbRefreshTick((x) => x + 1);
    });
    socket.on('leaderboard_winner', (payload) => {
      addToast(payload.message, 'win');
      if (activeTab === 'leaderboard') setLbRefreshTick((x) => x + 1);
    });
    // Market live notifications
    socket.on('market_sale', (payload) => {
      if (payload && payload.seller_id && user && payload.seller_id === user.id) {
        addToast(`SALE: ${payload.buyer_name} bought for ${payload.price}CR (Net: ${payload.net})`, 'win');
      }
    });
    socket.on('market_listing_refunded', (payload) => {
      if (payload && payload.seller_id && user && payload.seller_id === user.id) {
        addToast(`LISTING EXPIRED: Refund ${payload.refund}CR returned`, 'info');
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [activeTab, backendBase]);

  const executeHack = async () => {
    setSpinning(true);
    setShowReward(false);
    setReward(null);
    setMessage('');
    setSlots(['?', '?', '?']);
    setSlotsStopped([false, false, false]);

    // Check if user is DDoS frozen
    const isDDoSFrozen = user?.ddos_freeze_until && new Date(user.ddos_freeze_until) > new Date();

    // Pre-check: إذا الرصيد أقل من تكلفة السبن، لا تنفذ الطلب وخفظ رسالة
    const requiredCost = getSpinCostClient(user?.level || 1);
    const currentCredits = user?.wallet?.crypto_credits || 0;
    if (currentCredits < requiredCost) {
      setSpinning(false);
      setHackingText('');
      setMessage(`>> INSUFFICIENT_FUNDS: Need ${requiredCost} crypto_credits (Current: ${currentCredits})`);
      // لا تُظهر X X X — خليها رموز توقعية
      setSlots(['?', '?', '?']);
      setSlotsStopped([true, true, true]);
      return;
    }
    
    const hackTexts = [
      '> Initializing slot machine...',
      '> Bypassing RNG protocols...',
      '> Injecting luck algorithm...',
      '> Spinning reels...',
      '> Calculating outcome...'
    ];

    // Animate hacking text
    let i = 0;
    const textInterval = setInterval(() => {
      if (i < hackTexts.length) {
        setHackingText(hackTexts[i]);
        i++;
      }
    }, 400);

    // Animate slots spinning (random icons cycling)
    const slotOptions = ['💰', '📦', '💎', '🔥', '?'];
    const spinInterval = setInterval(() => {
      setSlots([
        slotOptions[Math.floor(Math.random() * slotOptions.length)],
        slotOptions[Math.floor(Math.random() * slotOptions.length)],
        slotOptions[Math.floor(Math.random() * slotOptions.length)]
      ]);
    }, 100);

    try {
      let base = backendBase;
      if (!base) {
        base = await getBackendBase();
        if (base) setBackendBase(base);
      }
      const url = base ? `${base}/api/spin/hack` : '/api/spin/hack';
      const res = await axios.post(url);
      clearInterval(textInterval);
      clearInterval(spinInterval);
      
      // Stop slots sequentially (suspense effect!)
      const finalSlots = res.data.slots || ['?', '?', '?'];
      
      // Stop slot 1 (faster!)
      setTimeout(() => {
        setSlots([finalSlots[0], '?', '?']);
        setSlotsStopped([true, false, false]);
      }, 250);
      
      // Stop slot 2 (faster!)
      setTimeout(() => {
        setSlots([finalSlots[0], finalSlots[1], '?']);
        setSlotsStopped([true, true, false]);
      }, 500);
      
      // Stop slot 3 and show result (faster!)
      setTimeout(() => {
        setSlots(finalSlots);
        setSlotsStopped([true, true, true]);
        
        // Process outcome
        const outcome = res.data.outcome;
        
        if (outcome.type === 'money') {
          setMessage(outcome.message + ` (Net: ${outcome.netGain >= 0 ? '+' : ''}${outcome.netGain})`);
          setReward({ type: 'money', amount: outcome.amount, isDiamond: outcome.isDiamond || false });
          setShowReward(true);
        } else if (outcome.type === 'item') {
          setMessage(outcome.message);
          setReward({ 
            type: 'item', 
            ...outcome.item, 
            xpGained: outcome.xpGained,
            creditsBonus: outcome.creditsBonus || 0
          });
          setShowReward(true);
        } else if (outcome.type === 'penalty') {
          // Show red penalty message, no reward card
          setMessage(outcome.message + ` (Net: ${outcome.netGain})`);
          setReward(null);
          setShowReward(false);
        } else if (outcome.type === 'loss') {
          // Player lost - show encouraging message based on what they saw
          setMessage(outcome.message);
          setReward(null);
          setShowReward(false);
          
          // Visual feedback for near-misses with rare items
          if (outcome.hasLegendary || outcome.hasEpic) {
            // Flash the screen briefly for legendary/epic sightings
            setTimeout(() => {
              setMessage(outcome.message + ' 🎲 Keep spinning!');
            }, 800);
          }
        }
        
        // Update XP Progress
        if (res.data.xpProgress) {
          setXpProgress(res.data.xpProgress);
        }
        
        // Check for Level Up
        if (res.data.levelUp) {
          setLevelUpData(res.data.levelUp);
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 5000); // Hide after 5 seconds
        }
        
        updateUser(res.data.user);
        setSpinning(false);
        setHackingText('');
        
        // Continue auto spin if enabled
        if (isAutoSpinning) {
          setAutoSpinCount(prev => prev + 1);
          // Check credits immediately
          const currentCredits = res.data.user?.crypto_credits || 0;
          const spinCost = getSpinCostClient(res.data.user?.level || 1);
          
          if (currentCredits >= spinCost) {
            // Auto-close reward and continue spinning
            setTimeout(() => {
              setShowReward(false);
              executeHack();
            }, 800); // Quick delay then continue
          } else {
            setIsAutoSpinning(false);
            setAutoSpinCount(0);
            setMessage('>> Auto spin stopped: Insufficient credits');
          }
        }
      }, 750);
      
    } catch (error) {
      clearInterval(textInterval);
      clearInterval(spinInterval);
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.message || '>> ERROR: Hack failed';
      // Friendly hint on auth issues
      const friendly = msg.includes('ACCESS_DENIED') ? '>> ACCESS_REQUIRED: Please login again.' : msg;
      setMessage(friendly);
      setSpinning(false);
      setHackingText('');
      // لا تُظهر X X X في أخطاء متوقعة مثل نقص الرصيد
      if (status === 400) {
        setSlotsStopped([true, true, true]);
        setSlots(['?', '?', '?']);
      } else {
        setSlots(['❌', '❌', '❌']);
      }
    }
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: '#808080',
      uncommon: '#00ff00',
      rare: '#0080ff',
      epic: '#a335ee',
      legendary: '#ff8000'
    };
    return colors[rarity] || '#0f0';
  };
  
  const activateItem = async (itemIndex) => {
    try {
      const res = await axios.post('/api/spin/use-item', { itemIndex });
      if (res.data.success) {
        setMessage(res.data.message);
        updateUser(res.data.user);
      } else {
        setMessage(res.data.message);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || '>> ERROR: Failed to use item');
    }
  };

  // Simple toast system
  const [toasts, setToasts] = useState([]);
  const addToast = (text, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter(t => t.id !== id));
    }, 5000);
  };

  return (
    <div className="game-dashboard">
      {/* DDoS Attack Warning */}
      {user?.ddos_freeze_until && new Date(user.ddos_freeze_until) > new Date() && (
        <div className="ddos-attack-warning">
          <div className="ddos-content">
            <div className="ddos-icon">⚠️</div>
            <div className="ddos-text">
              <div className="ddos-title">⚡ DDOS ATTACK ⚡</div>
              <div className="ddos-subtitle">System Frozen - {Math.max(0, Math.ceil((new Date(user.ddos_freeze_until).getTime() - Date.now())/1000))}s</div>
            </div>
            <div className="ddos-icon">⚠️</div>
          </div>
        </div>
      )}
      
      <div className="dashboard-header">
        <div className="user-info">
          <h1 className="neon-glow">&gt;&gt; WELCOME: {user?.username}</h1>
          <div className="stats">
            <span>Level: {user?.level}</span>
            <span>XP: {user?.xp}</span>
            <span>Rep: {user?.reputation}</span>
            {user?.active_vpn && user.active_vpn.expiresAt && (new Date(user.active_vpn.expiresAt) > new Date()) && (
              <span style={{ color: '#00aaff' }}>VPN: Active</span>
            )}
          </div>
          {/* XP Progress Bar */}
          <div className="xp-progress-container">
            <div className="xp-progress-bar">
              <div 
                className="xp-progress-fill"
                style={{ 
                  width: `${Math.min(100, Math.max(0, ((user?.xp || 0) % 1000) / 10))}%` 
                }}
              />
            </div>
            <span className="xp-progress-text">{xpProgress.toNext || 100} XP to Level {(user?.level || 1) + 1}</span>
          </div>
          {user?.active_vpn && user.active_vpn.expiresAt && (
            <div style={{ marginTop: 6, color: '#00aaff' }}>
              Stealth time left: {Math.max(0, Math.floor((new Date(user.active_vpn.expiresAt).getTime() - Date.now())/1000))}s
            </div>
          )}
        </div>
        <button onClick={logout} className="cyber-button logout-btn">
          &gt; DISCONNECT
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'spin' ? 'active' : ''}`}
          onClick={() => setActiveTab('spin')}
        >
          🎰 SPIN_HACK
        </button>
        <button 
          className={`tab-button ${activeTab === 'missions' ? 'active' : ''}`}
          onClick={() => setActiveTab('missions')}
        >
          🎯 MISSIONS
        </button>
        <button 
          className={`tab-button ${activeTab === 'pvp' ? 'active' : ''}`}
          onClick={() => setActiveTab('pvp')}
        >
          ⚔️ PVP_ATTACK
        </button>
        <button 
          className={`tab-button ${activeTab === 'defense' ? 'active' : ''}`}
          onClick={() => setActiveTab('defense')}
        >
          💾 My System
        </button>
        <button 
          className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 LEADERBOARD
        </button>
        <button 
          className={`tab-button ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => setActiveTab('market')}
        >
          💹 MARKET
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'spin' && (
        <div className="dashboard-content">{/* Original Spin Content */}
        <div className="wallet-panel">
          <h2>&gt;&gt; WALLET</h2>
          <div className="wallet-item">
            <span>Crypto Credits:</span>
            <span className="neon-glow">{user?.wallet?.crypto_credits || 0}</span>
          </div>
          <div className="wallet-item">
            <span>Rare Gems:</span>
            <span style={{color: '#ff00ff'}}>{user?.wallet?.rare_gems || 0}</span>
          </div>
        </div>

        <div className="hack-panel">
          <h2 className="neon-glow">&gt;&gt; SLOT_MACHINE</h2>
          <p className="cost-info">COST: {getSpinCostClient(user?.level || 1)} CRYPTO_CREDITS</p>
          
          {/* The 3 Slot Reels */}
          <div className="slot-machine">
            <div className="slots-container">
              {slots.map((icon, index) => {
                // Check if icon is an image path or emoji
                const isImage = typeof icon === 'string' && icon.startsWith('/');
                const isMoneyBag = isImage && icon.includes('bagMoney');
                const isFlashHacker = isImage && icon.includes('flashHacker');
                const isBlueDiamondImg = isImage && icon.includes('moneyreward');
                const isVPNImg = isImage && (icon.includes('vpn_active_stick') || icon.includes('Military_VPN'));
                const isDDOSImg = isImage && icon.includes('ddos_cannon');
                const isRustyCooling = isImage && icon.includes('rusty_cooling');
                const isRustyCPU = isImage && icon.includes('rusty_cpu');
                const isRTX4090 = isImage && icon.includes('rtx_4090_minig');
                const isQuantumCPU = isImage && icon.includes('Quantum_CPU');
                const isZeroDay = isImage && icon.includes('Zero_Day');
                
                // Add special class for rare icons
                let iconClass = '';
                if (slotsStopped[index]) {
                  // Legendary: FlashHacker image
                  if (isFlashHacker) iconClass = 'legendary-icon';
                  // Money bag icon image
                  else if (isMoneyBag) iconClass = 'money-icon';
                  // Epic emoji star
                  else if (icon === '⭐') iconClass = 'epic-icon';
                  // Rare emoji diamond
                  else if (icon === '💎') iconClass = 'rare-icon';
                  // Rare VPN image
                  else if (isImage && icon.includes('vpn_active_stick')) iconClass = 'rare-icon';
                  // Rare Diamond image replacement
                  else if (isImage && icon.includes('moneyreward')) iconClass = 'rare-icon';
                  // Epic DDoS Cannon image
                  else if (isImage && icon.includes('ddos_cannon')) iconClass = 'epic-icon';
                  // Custom item color overrides
                  else if (isRustyCooling || isRustyCPU) iconClass = 'green-icon';
                  else if (isVPNImg) iconClass = 'blue-icon';
                  else if (isRTX4090) iconClass = 'gold-icon';
                  else if (isQuantumCPU) iconClass = 'purple-icon';
                  else if (isZeroDay) iconClass = 'rainbow-icon';
                }
                
                return (
                  <motion.div
                    key={index}
                    className={`slot-reel ${slotsStopped[index] ? 'stopped' : 'spinning'} ${iconClass}`}
                    animate={spinning && !slotsStopped[index] ? {
                      y: [0, -10, 0],
                      scale: [1, 1.1, 1]
                    } : {}}
                    transition={{
                    duration: 0.3,
                    repeat: spinning && !slotsStopped[index] ? Infinity : 0
                  }}
                >
                  {isImage ? (
                    <img 
                      src={`${backendBase || ''}${icon}`} 
                      alt={
                        isFlashHacker ? 'FlashHacker' : (
                          isMoneyBag ? 'Money Bag' : (
                            isBlueDiamondImg ? 'Diamond' : (
                              isVPNImg ? 'Military VPN' : (
                                isDDOSImg ? 'DDoS Cannon' : (
                                  isRustyCooling ? 'Rusty Cooling' : (
                                    isRustyCPU ? 'Rusty CPU' : (
                                      isRTX4090 ? 'RTX 4090 Mining Rig' : (
                                        isQuantumCPU ? 'Quantum CPU' : (
                                          isZeroDay ? 'Zero-Day Exploit' : 'Icon'
                                        )
                                      )
                                    )
                                  )
                                )
                              )
                            )
                          )
                        )
                      } 
                      className={`slot-icon slot-image ${isMoneyBag ? 'money-bag-image' : ''} ${isBlueDiamondImg ? 'diamond-image' : ''} ${isVPNImg ? 'vpn-image' : ''} ${isDDOSImg ? 'ddos-image' : ''} ${isFlashHacker ? 'flashhacker-image' : ''} ${isRustyCooling || isRustyCPU ? 'rusty-image' : ''} ${isRTX4090 ? 'rtx-image' : ''} ${isQuantumCPU ? 'quantum-image' : ''} ${isZeroDay ? 'zero-day-image' : ''}`}
                    />
                  ) : (
                    <span className="slot-icon">{icon}</span>
                  )}
                </motion.div>
                );
              })}
            </div>
          </div>
          
          {/* Hacking Animation Text */}
          <AnimatePresence>
            {spinning && (
              <motion.div 
                className="hacking-animation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="hack-screen">
                  <motion.div 
                    className="hack-text"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    {hackingText}
                  </motion.div>
                  <div className="progress-bar" style={{ position: 'relative' }}>
                    <motion.div 
                      className="progress-fill"
                      initial={{ width: 0 }}
                      animate={user?.ddos_freeze_until && new Date(user.ddos_freeze_until) > new Date() ?
                        { width: ['0%', '50%', '50%', '100%'] } :
                        { width: '100%' }
                      }
                      transition={user?.ddos_freeze_until && new Date(user.ddos_freeze_until) > new Date() ?
                        { duration: calculateHackDuration() + 3, times: [0, 0.2, 0.8, 1] } :
                        { duration: calculateHackDuration() }
                      }
                    />
                    {user?.ddos_freeze_until && new Date(user.ddos_freeze_until) > new Date() && (
                      <motion.div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: '#ff0000',
                          fontWeight: 'bold',
                          fontSize: '1.2em',
                          textShadow: '0 0 10px #ff0000',
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        <span style={{ fontSize: '1.5em' }}>⚠️</span>
                        DDoS ATTACK
                        <span style={{ fontSize: '1.5em' }}>⚠️</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!spinning && !showReward && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.button 
                className="cyber-button hack-button"
                onClick={executeHack}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={
                  spinning || isAutoSpinning || ((user?.wallet?.crypto_credits || 0) < getSpinCostClient(user?.level || 1))
                }
              >
                <span style={{ position: 'relative', zIndex: 2 }}>
                  ⚡ EXECUTE HACK ({getSpinCostClient(user?.level || 1)}💰)
                </span>
              </motion.button>
              
              <motion.button 
                className={`cyber-button auto-spin-btn ${isAutoSpinning ? 'auto-spin-active' : ''}`}
                onClick={() => {
                  if (isAutoSpinning) {
                    setIsAutoSpinning(false);
                    setAutoSpinCount(0);
                  } else {
                    setIsAutoSpinning(true);
                    setAutoSpinCount(0);
                    executeHack();
                  }
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={spinning || ((user?.wallet?.crypto_credits || 0) < getSpinCostClient(user?.level || 1))}
              >
                <span style={{ position: 'relative', zIndex: 2, fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {isAutoSpinning ? `🛑 STOP AUTO (${autoSpinCount} spins)` : '🤖 AUTO HACK MODE'}
                </span>
              </motion.button>
            </div>
          )}

          <AnimatePresence>
            {showReward && reward && (
              <motion.div 
                className="reward-display"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                {reward.type === 'money' ? (
                  <div className={`reward-card money-reward ${reward.isDiamond ? 'diamond-reward' : ''}`}>
                    <h3 className="neon-glow">
                      {reward.isDiamond ? '💎💎💎 DIAMOND JACKPOT 💎💎💎' : '💰 CRYPTO_JACKPOT 💰'}
                    </h3>
                    <p className="reward-amount" style={reward.isDiamond ? {
                      color: '#0080ff',
                      textShadow: '0 0 30px #0080ff',
                      fontSize: '3rem'
                    } : {}}>
                      +{reward.amount} Credits
                    </p>
                    <p className="success-msg">{message}</p>
                  </div>
                ) : (
                  <div 
                    className="reward-card"
                    style={{ borderColor: getRarityColor(reward.rarity) }}
                  >
                    <h3 style={{ color: getRarityColor(reward.rarity) }}>
                      {reward.rarity?.toUpperCase()}
                    </h3>
                    <img 
                      src={`${backendBase || ''}${reward.filePath}`} 
                      alt={reward.fileName}
                      className={`reward-image ${reward.filePath?.includes('vpn_active_stick') ? 'vpn-image' : ''} ${reward.filePath?.includes('ddos_cannon') ? 'ddos-image' : ''} ${(reward.type === 'flashHacker' || reward.filePath?.includes('flashHacker')) ? 'flashhacker-image' : ''}`}
                    />
                    <p className="reward-name">{reward.fileName}</p>
                    {reward.xpGained && <p className="xp-gain">+{reward.xpGained} XP</p>}
                    {reward.creditsBonus > 0 && (
                      <p className="credits-bonus" style={{
                        color: '#FFD700',
                        fontSize: '1.8rem',
                        fontWeight: 'bold',
                        textShadow: '0 0 20px #FFD700',
                        margin: '10px 0'
                      }}>
                        🔥 +{reward.creditsBonus} CREDITS! 🔥
                      </p>
                    )}
                    <p className="success-msg neon-glow">{message}</p>
                  </div>
                )}
                <button 
                  className="cyber-button"
                  onClick={() => setShowReward(false)}
                >
                  &gt; CONTINUE
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {message && !showReward && !spinning && (
            <p className="error-msg" style={{color: '#ff0000'}}>{message}</p>
          )}

          {/* Toast notifications */}
          <div className="toast-container">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div key={t.id} className={`toast ${t.type}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {t.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {/* Level Up Notification */}
          <AnimatePresence>
            {showLevelUp && levelUpData && (
              <motion.div
                className="level-up-notification"
                initial={{ scale: 0, opacity: 0, y: -50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: 50 }}
                transition={{ type: "spring", duration: 0.8 }}
              >
                <h2 className="neon-glow" style={{color: '#FFD700'}}>🎉 LEVEL UP! 🎉</h2>
                <p style={{fontSize: '2rem', color: '#00ff00'}}>Level {levelUpData.oldLevel} &gt;&gt; Level {levelUpData.newLevel}</p>
                <p style={{color: '#0ff'}}>Bonus: +{levelUpData.bonus} Credits!</p>
                <p style={{color: '#fff', fontSize: '0.9rem'}}>{levelUpData.xpToNext} XP to next level</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="inventory-panel">
          <h2>&gt;&gt; INVENTORY</h2>
          
          {/* Active FlashHacker Status */}
          {user?.active_flashhacker && new Date(user.active_flashhacker.expiresAt) > new Date() && (
            <div className="flashhacker-status" style={{
              background: 'linear-gradient(135deg, #ff8000, #ff0000)',
              padding: '10px',
              marginBottom: '15px',
              borderRadius: '5px',
              textAlign: 'center',
              animation: 'pulse 2s infinite'
            }}>
              <h3 style={{margin: 0, color: '#fff'}}>🔥 FLASHHACKER ACTIVE</h3>
              <p style={{margin: '5px 0', fontSize: '12px'}}>
                +100% Missions | +50% Spins | PvP Shield
              </p>
              <p style={{margin: 0, fontSize: '11px', opacity: 0.8}}>
                Expires: {new Date(user.active_flashhacker.expiresAt).toLocaleTimeString()}
              </p>
            </div>
          )}
          
          <div className="inventory-count">
            Items: {user?.inventory?.length || 0}
          </div>
          <div className="inventory-grid">
            {user?.inventory?.slice(-12).reverse().map((item, realIndex) => {
              const itemIndex = user.inventory.length - 1 - realIndex; // Calculate actual index
              const isFlashHacker = item.type === 'flashHacker';
              const isUsed = item.used;
              const expiresAt = item.activatedUntil ? new Date(item.activatedUntil) : null;
              const remainingMs = expiresAt ? (expiresAt.getTime() - Date.now()) : 0;
              const remainingPositive = remainingMs > 0;
              const fmtTime = (ms) => {
                const s = Math.max(0, Math.floor(ms / 1000));
                const m = Math.floor(s / 60);
                const sec = s % 60;
                return `${m}:${sec.toString().padStart(2,'0')}`;
              };
              
              return (
                <motion.div 
                  key={realIndex}
                  className={`inventory-item rarity-${item.rarity || 'common'}`}
                  style={{ 
                    borderColor: getRarityColor(item.rarity),
                    position: 'relative',
                    opacity: isUsed ? 0.5 : 1
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: isUsed ? 0.5 : 1, scale: 1 }}
                  transition={{ delay: realIndex * 0.05 }}
                >
                  <img 
                    src={`${backendBase || ''}${item.filePath}`} 
                    alt={item.fileName}
                    className={`inv-img ${item.filePath?.includes('vpn_active_stick') ? 'vpn-image' : ''} ${item.filePath?.includes('ddos_cannon') ? 'ddos-image' : ''} ${(item.type === 'flashHacker' || item.filePath?.includes('flashHacker')) ? 'flashhacker-image' : ''}`}
                    style={{ filter: isUsed ? 'grayscale(100%)' : 'none' }}
                  />
                  {item.usable && !isUsed && (
                    <button 
                      className="use-item-btn"
                      onClick={() => activateItem(itemIndex)}
                      style={{
                        position: 'absolute',
                        bottom: '5px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#ff8000',
                        color: '#000',
                        border: 'none',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        borderRadius: '3px',
                        zIndex: 10
                      }}
                    >
                      USE
                    </button>
                  )}
                  {remainingPositive && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#00ffff',
                      padding: '2px 6px',
                      fontSize: '10px',
                      border: '1px solid #00ffff',
                      borderRadius: '4px',
                      textShadow: '0 0 5px #000'
                    }}>
                      {fmtTime(remainingMs)}
                    </div>
                  )}
                  {isUsed && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textShadow: '0 0 5px #000'
                    }}>
                      USED
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Missions Tab */}
      {activeTab === 'missions' && (
        <MissionControl user={user} updateUser={updateUser} />
      )}

      {/* PvP Tab */}
      {activeTab === 'pvp' && (
        <PvPPanel user={user} updateUser={updateUser} />
      )}

      {/* My System Tab (replacing Defense) */}
      {activeTab === 'defense' && (
        <div className="defense-panel">
          <MySystem user={user} />
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="leaderboard-container">
          <Leaderboard metric={'earnings'} refresh={lbRefreshTick} />
        </div>
      )}

      {/* Market Tab */}
      {activeTab === 'market' && (
        <Market user={user} backendBase={backendBase} />
      )}
    </div>
  );
};

export default GameDashboard;
