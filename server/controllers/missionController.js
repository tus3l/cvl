const supabase = require('../supabase');

// Mission Targets Database
const MISSION_TARGETS = {
  government: [
    {
      id: 'central_bank',
      name: 'Central Bank',
      sector: 'government',
      difficulty: 150,
      reward: { min: 5000, max: 15000 },
      gems: { min: 10, max: 50 },
      xp: 500,
      description: 'WARNING: FEDERAL JURISDICTION - High security vaults'
    },
    {
      id: 'secret_service',
      name: 'Secret Service Database',
      sector: 'government',
      difficulty: 180,
      reward: { min: 8000, max: 20000 },
      gems: { min: 20, max: 80 },
      xp: 750,
      description: 'CLASSIFIED - Maximum risk, maximum reward'
    }
  ],
  private: [
    {
      id: 'crypto_exchange',
      name: 'Crypto Exchange',
      sector: 'private',
      difficulty: 80,
      reward: { min: 2000, max: 8000 },
      gems: { min: 5, max: 20 },
      xp: 200,
      description: 'Corporate security - Medium risk'
    },
    {
      id: 'online_merchant',
      name: 'Online Merchant',
      sector: 'private',
      difficulty: 60,
      reward: { min: 1000, max: 5000 },
      gems: { min: 2, max: 10 },
      xp: 150,
      description: 'Weak encryption - Easy target'
    }
  ]
};

const getMissions = async (req, res) => {
  try {
    res.json({
      success: true,
      missions: MISSION_TARGETS
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '>> ERROR: Failed to load missions'
    });
  }
};

const executeMission = async (req, res) => {
  try {
    const { targetId, loadout } = req.body;
    const userId = req.user.id;

    // If client-provided mission prep is missing, we'll later fall back to equipped system
    const clientLoadoutValid = !!(loadout && loadout.hardware && loadout.software && loadout.crew);

    // Find target
    let target = null;
    Object.values(MISSION_TARGETS).forEach(sector => {
      const found = sector.find(t => t.id === targetId);
      if (found) target = found;
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: '>> ERROR: Target not found'
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user || user.crypto_credits < 50) {
      return res.status(400).json({
        success: false,
        message: '>> ERROR: Insufficient funds'
      });
    }

    // Calculate outcome (with equipment/buff effects)
    // Prefer player's saved system loadout if available; else use mission prep loadout
    const equipped = user.equipped_loadout || {};
    const coreCPU = equipped['core:cpu'];
    const coreRAM = equipped['core:ram'];
    const coreCooling = equipped['core:cooling'];
    const atkPrimary = equipped['attack:primaryWeapon'];
    const atkExploit = equipped['attack:exploit'];
    const defFirewall = equipped['defense:firewall'];
    const defStealth = equipped['defense:stealth'];

    // Validate rig completeness if using equipped system
    if (!clientLoadoutValid) {
      if (!coreCPU || !coreRAM || !coreCooling) {
        return res.status(400).json({
          success: false,
          message: '>> SYSTEM_INCOMPLETE: Equip CPU, RAM, and Cooling in MY_SYSTEM.'
        });
      }
    }

    // Derive attack score
    let attackScore;
    if (clientLoadoutValid) {
      attackScore = (loadout.hardware?.level || 0) + (loadout.software?.level || 0) + ((loadout.crew?.skill_level || 0) * 2);
    } else {
      const cpuSpeed = (coreCPU?.hack_speed || 12);
      const ramSpeed = (coreRAM?.hack_speed || 6);
      const exploitBoost = atkExploit ? 15 : 0;
      const ddosBoost = (atkPrimary && ((atkPrimary.code || '').includes('ddos') || (atkPrimary.type || '').toLowerCase() === 'ddos')) ? 40 : 0;
      attackScore = cpuSpeed + ramSpeed + exploitBoost + ddosBoost;
    }

    let baseSkill = Math.min(95, Math.max(5, (attackScore / target.difficulty) * 100));

    // Defense readiness
    const nowTs = Date.now();
    const activeDefense = user.active_defense || {};
    const hasActiveVPN = (activeDefense.kind === 'vpn') && activeDefense.expiresAt && (new Date(activeDefense.expiresAt).getTime() > nowTs);
    const hasFirewall = !!defFirewall;
    const hasDDoS = !!(user.equipment?.primary_weapon && user.equipment.primary_weapon.code === 'ddos_cannon' && (user.equipment.primary_weapon.durability?.current || 0) > 0) || (!!atkPrimary && ((atkPrimary.code || '').includes('ddos') || (atkPrimary.type || '').toLowerCase() === 'ddos'));

    const WinChance = Math.min(95, Math.max(5, baseSkill + (hasDDoS ? 10 : 0))); // smaller flat top-up; ddos already counted if using equipped
    const BaseRisk = Math.min(95, Math.max(5, Math.floor(target.difficulty / 2))); // higher difficulty => higher detection risk
    const DetectionReduction = (hasActiveVPN ? 90 : 0) + (hasFirewall ? 25 : 0);
    const DetectionChance = Math.max(0, Math.min(95, BaseRisk - DetectionReduction));

    const rollWin = Math.random() * 100;
    const rollDetect = Math.random() * 100;

    let updateData = { crypto_credits: user.crypto_credits - 50 };
    // consume DDoS durability if used
    if (hasDDoS) {
      const dur = user.equipment.primary_weapon.durability || { max: 10, current: 10 };
      user.equipment.primary_weapon.durability = { max: dur.max, current: Math.max(0, (dur.current || 0) - 1) };
      updateData.equipment = user.equipment;
    }

    let outcome = {};
    if (rollWin <= WinChance) {
      // Success
      const reward = Math.floor(Math.random() * (target.reward.max - target.reward.min) + target.reward.min);
      const gems = Math.floor(Math.random() * (target.gems.max - target.gems.min) + target.gems.min);

      updateData.crypto_credits = user.crypto_credits - 50 + reward;
      updateData.rare_gems = user.rare_gems + gems;
      updateData.xp = user.xp + target.xp;
      updateData.reputation = user.reputation + Math.floor(target.xp / 10);

      outcome = {
        success: true,
        type: 'success',
        reward,
        gems,
        xp: target.xp,
        message: `>> BREACH_SUCCESSFUL: Extracted ${reward} Crypto Credits + ${gems} Rare Gems`,
        attackScore,
        targetDifficulty: target.difficulty,
        successChance: WinChance.toFixed(1),
        detectionChance: DetectionChance.toFixed(1)
      };

      // Daily mission progress: private sector success
      if (target.sector === 'private') {
        try {
          const { data: u2 } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
          const updatedUser2 = await ensureDailyState(u2);
          const missions = updatedUser2.intrusion_logs.daily_state.missions.map(m => m.id === 'daily_private_success' ? { ...m, progress: Math.min(m.target, (m.progress || 0) + 1) } : m);
          const logs = { ...updatedUser2.intrusion_logs, daily_state: { lastReset: todayKey(), missions } };
          await supabase.from('users').update({ intrusion_logs: logs }).eq('id', userId);
        } catch {}
      }
    } else if (rollDetect < DetectionChance) {
      // Compromised (detection)
      const exposedUntil = new Date();
      exposedUntil.setHours(exposedUntil.getHours() + 1);
      updateData.exposed_until = exposedUntil.toISOString();
      updateData.reputation = Math.max(0, user.reputation - Math.floor(target.xp / 2));

      outcome = {
        success: false,
        type: 'compromised',
        message: '>> TRACE_DETECTED: You are EXPOSED for 1 hour!',
        reputationLoss: Math.floor(target.xp / 2),
        attackScore,
        targetDifficulty: target.difficulty,
        successChance: WinChance.toFixed(1),
        detectionChance: DetectionChance.toFixed(1)
      };
    } else {
      // Failure (no detection)
      outcome = {
        success: false,
        type: 'failure',
        message: '>> CONNECTION_SEVERED: Firewall too strong.',
        attackScore,
        targetDifficulty: target.difficulty,
        successChance: WinChance.toFixed(1),
        detectionChance: DetectionChance.toFixed(1)
      };
    }

    // Update user
    const { data: updatedUser } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    res.json({
      success: true,
      outcome,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        crypto_credits: updatedUser.crypto_credits,
        rare_gems: updatedUser.rare_gems,
        xp: updatedUser.xp,
        level: updatedUser.level,
        reputation: updatedUser.reputation,
        exposed_until: updatedUser.exposed_until
      }
    });

  } catch (error) {
    console.error('Mission error:', error);
    res.status(500).json({
      success: false,
      message: '>> ERROR: ' + error.message
    });
  }
};

// --- Daily Missions System ---
function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function generateDailySet(user) {
  const baseLevel = user.level || 1;
  // Scale targets more aggressively with level
  const spinTarget = Math.min(30, 5 + Math.floor(baseLevel / 2));
  const xpTarget = Math.min(5000, 300 + baseLevel * 40);

  return [
    {
      id: 'daily_spin',
      name: 'Spin Hacker',
      description: `Spin the slot machine ${spinTarget} times`,
      type: 'spin_count',
      target: spinTarget,
      progress: 0,
      reward: { credits: 1200 + baseLevel * 80, xp: 150 + baseLevel * 12, gems: 0 },
      claimed: false
    },
    {
      id: 'daily_money_win',
      name: 'Big Earner',
      description: 'Hit a triple money match once',
      type: 'money_triple',
      target: 1,
      progress: 0,
      reward: { credits: 3500 + baseLevel * 120, xp: 250 + baseLevel * 12, gems: 0 },
      claimed: false
    },
    {
      id: 'daily_xp_grind',
      name: 'XP Grinder',
      description: `Accumulate ${xpTarget} XP today`,
      type: 'xp_accumulate',
      target: xpTarget,
      progress: 0,
      reward: { credits: 1800 + baseLevel * 80, xp: 0, gems: 6 },
      claimed: false
    },
    {
      id: 'daily_private_success',
      name: 'Contractor',
      description: 'Complete one Private sector mission',
      type: 'private_success',
      target: 1,
      progress: 0,
      reward: { credits: 5000 + baseLevel * 200, xp: 300, gems: 3 },
      claimed: false
    }
  ];
}

async function ensureDailyState(user) {
  let logs = user.intrusion_logs || [];
  let stateObj;
  if (Array.isArray(logs)) {
    // Convert to object if previously an array
    stateObj = {};
  } else {
    stateObj = logs || {};
  }
  const key = todayKey();
  const last = stateObj.daily_state?.lastReset;
  if (!stateObj.daily_state || last !== key) {
    stateObj.daily_state = {
      lastReset: key,
      missions: generateDailySet(user)
    };
    // Persist
    const { data: updated } = await supabase
      .from('users')
      .update({ intrusion_logs: stateObj })
      .eq('id', user.id)
      .select()
      .single();
    return updated;
  }
  return user;
}

const getDailyMissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const updatedUser = await ensureDailyState(user);
    const missions = (updatedUser.intrusion_logs?.daily_state?.missions) || [];
    res.json({ success: true, missions });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const updateDailyProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { missionId, delta = 1 } = req.body;
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    const updatedUser = await ensureDailyState(user);
    const missions = updatedUser.intrusion_logs.daily_state.missions.map(m => {
      if (m.id === missionId) {
        const newProg = Math.min(m.target, (m.progress || 0) + delta);
        return { ...m, progress: newProg };
      }
      return m;
    });
    const logs = { ...updatedUser.intrusion_logs, daily_state: { lastReset: todayKey(), missions } };
    const { data: saved } = await supabase
      .from('users')
      .update({ intrusion_logs: logs })
      .eq('id', userId)
      .select()
      .single();
    res.json({ success: true, missions: logs.daily_state.missions });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const claimDailyMission = async (req, res) => {
  try {
    const userId = req.user.id;
    const { missionId } = req.body;
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    const updatedUser = await ensureDailyState(user);
    const missions = updatedUser.intrusion_logs.daily_state.missions;
    const idx = missions.findIndex(m => m.id === missionId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Mission not found' });
    const m = missions[idx];
    if ((m.progress || 0) < m.target) return res.status(400).json({ success: false, message: 'Mission incomplete' });
    if (m.claimed) return res.status(400).json({ success: false, message: 'Already claimed' });

    // Reward calculation (apply FlashHacker bonuses if active)
    let credits = m.reward.credits || 0;
    let xp = m.reward.xp || 0;
    let gems = m.reward.gems || 0;
    const fh = updatedUser.active_flashhacker;
    if (fh && new Date(fh.expiresAt) > new Date()) {
      credits = Math.floor(credits * 1.5);
      xp = Math.floor(xp * 1.5);
      gems = Math.floor(gems * 1.2);
    }

    const newWallet = {
      crypto_credits: (updatedUser.crypto_credits || 0) + credits,
      rare_gems: (updatedUser.rare_gems || 0) + gems
    };

    missions[idx] = { ...m, claimed: true };
    const logs = { ...updatedUser.intrusion_logs, daily_state: { lastReset: todayKey(), missions } };

    const { data: saved } = await supabase
      .from('users')
      .update({ intrusion_logs: logs, crypto_credits: newWallet.crypto_credits, rare_gems: newWallet.rare_gems, xp: (updatedUser.xp || 0) + xp })
      .eq('id', userId)
      .select()
      .single();

    // Track period earnings for mission credits
    try {
      const lb = (saved.intrusion_logs && saved.intrusion_logs.leaderboard) || { periodStart: new Date().toISOString(), earnings: 0 };
      const start = new Date(lb.periodStart);
      const now = new Date();
      if ((now - start) >= 2 * 60 * 60 * 1000) {
        lb.periodStart = now.toISOString();
        lb.earnings = 0;
      }
      lb.earnings = Math.max(0, (lb.earnings || 0) + Math.max(0, credits));
      await supabase
        .from('users')
        .update({ intrusion_logs: { ...(saved.intrusion_logs || {}), leaderboard: lb } })
        .eq('id', userId);
    } catch (e) {
      console.warn('>> LB_MISSION_EARNINGS_UPDATE_FAILED:', e.message);
    }

    res.json({ success: true, missions, user: saved });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = {
  getMissions,
  executeMission,
  getDailyMissions,
  updateDailyProgress,
  claimDailyMission
};
