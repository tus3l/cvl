const fs = require('fs').promises;
const path = require('path');
const supabase = require('../supabase');
function safeNum(n, def = 0) {
  const x = typeof n === 'number' ? n : parseFloat(n);
  return Number.isFinite(x) ? x : def;
}

// Remove expired time-based items from inventory and clear expired active effects
function getExpiryCleanupFields(user) {
  const now = Date.now();
  const result = {};
  const inv = Array.isArray(user.inventory) ? [...user.inventory] : [];
  const filtered = inv.filter(it => {
    if (it && it.used && it.activatedUntil) {
      const exp = new Date(it.activatedUntil).getTime();
      if (Number.isFinite(exp) && exp <= now) {
        return false; // drop expired used items
      }
    }
    return true;
  });
  if (filtered.length !== inv.length) result.inventory = filtered;

  // Clear expired active_vpn
  if (user.active_vpn && user.active_vpn.expiresAt) {
    const exp = new Date(user.active_vpn.expiresAt).getTime();
    if (Number.isFinite(exp) && exp <= now) {
      result.active_vpn = null;
    }
  }
  // Clear expired active_flashhacker
  if (user.active_flashhacker && user.active_flashhacker.expiresAt) {
    const exp = new Date(user.active_flashhacker.expiresAt).getTime();
    if (Number.isFinite(exp) && exp <= now) {
      result.active_flashhacker = null;
    }
  }
  return result;
}

function getSpinCost(level) {
  const lvl = Math.max(1, level || 1);
  const step = Math.floor(lvl / 5); // 5->1, 10->2, ...
  return 150 * Math.pow(2, step); // L1-4:150, L5-9:300, L10-14:600, ...
}
const REWARD_DIR = path.join(__dirname, '../../public/SPIN_REWARD');

// Weighted RNG System (Total = 100%)
// زيادة احتمالات Items النادرة عشان اللاعب يشوفها أكثر!
const OUTCOME_WEIGHTS = {
  money: 35,        // 35% - Credits wins (أقل قليلًا لإبراز الندرة)
  common: 25,       // 25% - Common
  rare: 22,         // 22% - Rare (أزرق) يظهر بشكل مرضي
  epic: 9,          // 9%  - Epic
  legendary: 9      // 9%  - Legendary (ذهبي/أحمر) محسوس لكن غير مفرط
};

// Slot icon variants per outcome (so players can see possible items)
const SLOT_ICON_VARIANTS = {
  money: ['/rewards/bagMoney.png'],
  common: ['/rewards/trash.png', '/rewards/RustyRAM.png'],
  rare: ['/rewards/moneyreward.png', '/rewards/vpn_active_stick.png'],
  epic: ['/rewards/ddos_cannon_heavy.png'],
  legendary: ['/rewards/flashHacker.png']
};

// Simple emoji/icon mapping used for messages only
const SLOT_ICONS = {
  money: '💰',
  common: '📦',
  rare: '💎',
  epic: '⭐',
  legendary: '🔥'
};

function pickIconVariant(outcome, iconVariants) {
  const pool = iconVariants || SLOT_ICON_VARIANTS;
  const variants = pool[outcome] || pool.common;
  if (!variants || variants.length === 0) return '/rewards/trash.png';
  // Weighted pick using ICON_WEIGHT_MAP
  const weights = variants.map(v => Math.max(0.0001, ICON_WEIGHT_MAP[v] || 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < variants.length; i++) {
    if ((r -= weights[i]) <= 0) return variants[i];
  }
  return variants[variants.length - 1];
}

function isLegendaryIcon(icon, iconVariants) {
  const pool = iconVariants || SLOT_ICON_VARIANTS;
  return (pool.legendary || []).includes(icon);
}

// Dynamic icon cache built from reward manifest (so reels can show any item)
let ICON_RARITY_MAP = {};
let ICON_WEIGHT_MAP = {}; // per-icon weighted selection within an outcome
let DYNAMIC_SLOT_ICONS = null;
let dynamicIconsTs = 0;

async function getMergedIconVariants() {
  const now = Date.now();
  if (DYNAMIC_SLOT_ICONS && (now - dynamicIconsTs) < 5 * 60 * 1000) return DYNAMIC_SLOT_ICONS;
  try {
    let manifest = await scanRewardDirectory();
    manifest = injectSpecialItems(manifest);
    ICON_RARITY_MAP = {};
    ICON_WEIGHT_MAP = {};
    const merged = { ...SLOT_ICON_VARIANTS };
    ['common', 'rare', 'epic', 'legendary'].forEach(r => {
      const icons = (manifest[r] || []).map(it => {
        ICON_RARITY_MAP[it.filePath] = r;
        // Default weights: 1 for all
        ICON_WEIGHT_MAP[it.filePath] = 1;
        return it.filePath;
      });
      merged[r] = Array.from(new Set([...(merged[r] || []), ...icons]));
    });
    // Manual weighting for special icons
    // Make Zero-Day extremely rare as a reel icon but still visible sometimes
    ICON_WEIGHT_MAP['/rewards/Zero_Day.png'] = 0.5;
    // Keep FlashHacker more likely among legendary icons to represent typical legendary
    ICON_WEIGHT_MAP['/rewards/flashHacker.png'] = 25;
    DYNAMIC_SLOT_ICONS = merged;
    dynamicIconsTs = now;
    return merged;
  } catch (e) {
    return SLOT_ICON_VARIANTS;
  }
}

// Level System - Progressive XP Requirements
// Level 1: 0-99 XP, Level 2: 100-299 XP, Level 3: 300-599 XP...
function calculateLevel(xp) {
  if (xp < 100) return 1;
  if (xp < 300) return 2;
  if (xp < 600) return 3;
  if (xp < 1000) return 4;
  if (xp < 1500) return 5;
  if (xp < 2100) return 6;
  if (xp < 2800) return 7;
  if (xp < 3600) return 8;
  if (xp < 4500) return 9;
  if (xp < 5500) return 10;
  // After level 10: +1200 XP per level
  return 10 + Math.floor((xp - 5500) / 1200);
}

function getXPForLevel(level) {
  const xpTable = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
  if (level <= 10) return xpTable[level] || 0;
  return 5500 + ((level - 10) * 1200);
}

function getXPToNextLevel(currentXP, currentLevel) {
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  return nextLevelXP - currentXP;
}

async function scanRewardDirectory() {
  const manifest = {
    common: [],
    rare: [],
    epic: [],
    legendary: []
  };

  try {
    const rarities = ['common', 'rare', 'epic', 'legendary'];
    
    for (const rarity of rarities) {
      const rarityPath = path.join(REWARD_DIR, rarity);
      
      try {
        const files = await fs.readdir(rarityPath);
        const imageFiles = files.filter(file => 
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file) &&
          file !== 'bagMoney.png'  // Exclude icon-only images from rewards
        );
        
        manifest[rarity] = imageFiles.map(file => ({
          fileName: file,
          filePath: `/rewards/${rarity}/${file}`,
          rarity: rarity
        }));
      } catch (error) {
        console.warn(`>> WARNING: Directory not found: ${rarityPath}`);
      }
    }
    
    return manifest;
  } catch (error) {
    console.error('>> ERROR: Failed to scan reward directory:', error);
    throw error;
  }
}

// Inject special items that live in /img (served from /rewards)
function injectSpecialItems(manifest) {
  // --- Common Tier: Rusty Cooling ---
  manifest.common.push({
    fileName: 'rusty_cooling.png',
    filePath: '/rewards/rusty_cooling.png',
    rarity: 'common',
    type: 'cooling',
    code: 'rusty_cooling',
    name: 'Rusty Cooling',
    equippable: true,
    cooldown_reduction_percent: 5,
    stealth_penalty: -5,
    durability: 50
  });

  // --- Common Tier: Rusty CPU ---
  manifest.common.push({
    fileName: 'rusty_cpu.png',
    filePath: '/rewards/rusty_cpu.png',
    rarity: 'common',
    type: 'cpu',
    code: 'rusty_cpu',
    name: 'Rusty CPU',
    equippable: true,
    hack_speed: 8,
    overheat_risk_percent: 10,
    durability: 40
  });
  // Rusty RAM (common, equippable RAM with explicit stats)
  manifest.common.push({
    fileName: 'RustyRAM.png',
    filePath: '/rewards/RustyRAM.png',
    rarity: 'common',
    type: 'ram',
    code: 'rusty_ram',
    name: 'Rusty RAM',
    equippable: true,
    hack_speed: 5,
    stealth_penalty: -2,
    durability: 50
  });
  // VPN-ACTIVE (consumable, defensive) → classify as rare
  manifest.rare.push({
    fileName: 'Military_VPN.png',
    filePath: '/rewards/Military_VPN.png',
    rarity: 'rare',
    type: 'vpn_active',
    code: 'vpn_active',
    name: 'Military VPN',
    usable: true,
    buffs: { stealth_mode: true, detection_reduction_percent: 90, pvp_trace_success_override: 0 },
    abilities: { duration: 30 * 60 * 1000 }
  });

  // DDoS Cannon (equippable, offensive) → classify as epic
  manifest.epic.push({
    fileName: 'ddos_cannon_heavy.png',
    filePath: '/rewards/ddos_cannon_heavy.png',
    rarity: 'epic',
    type: 'equipment',
    code: 'ddos_cannon',
    name: 'DDoS Cannon',
    equippable: true,
    attack_power: 75,
    durability: { max: 15, current: 15 }
  });

  // --- Epic Tier: RTX 4090 Mining Rig ---
  manifest.epic.push({
    fileName: 'rtx_4090_minig.png',
    filePath: '/rewards/rtx_4090_minig.png',
    rarity: 'epic',
    type: 'gpu',
    code: 'rtx_4090_mining',
    name: 'RTX 4090 Mining Rig',
    equippable: true,
    passive_income_per_hour: 100,
    brute_force_boost_percent: 40
  });

  // FlashHacker (legendary, usable with bonuses)
  manifest.legendary.push({
    fileName: 'flashHacker.png',
    filePath: '/rewards/flashHacker.png',
    rarity: 'legendary',
    type: 'flashHacker',
    code: 'flashHacker',
    name: 'FlashHacker',
    usable: true,
    abilities: { missionBoost: 100, spinLuck: 50, pvpShield: true, duration: 30 * 60 * 1000 }
  });

  // --- Legendary Tier: Quantum CPU ---
  manifest.legendary.push({
    fileName: 'Quantum_CPU.png',
    filePath: '/rewards/Quantum_CPU.png',
    rarity: 'legendary',
    type: 'cpu',
    code: 'quantum_cpu',
    name: 'Quantum CPU',
    equippable: true,
    instant_hack: true,
    multitask: true,
    overheat_immunity: true,
    baseSpeed: 100
  });

  // --- Legendary Tier (Mythic-like): Zero-Day Exploit ---
  manifest.legendary.push({
    fileName: 'Zero_Day.png',
    filePath: '/rewards/Zero_Day.png',
    rarity: 'legendary',
    type: 'zero_day',
    code: 'zero_day',
    name: 'Zero-Day Exploit',
    usable: true,
    charges: 1,
    abilities: { autoWin: true }
  });

  return manifest;
}

// Weighted Random Selection
function selectOutcome() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  for (const [outcome, weight] of Object.entries(OUTCOME_WEIGHTS)) {
    cumulative += weight;
    if (rand <= cumulative) {
      return outcome;
    }
  }
  
  return 'common'; // Fallback
}

// Spin a single reel with smart matching system
function spinReel(previousReels = [], iconVariants) {
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  // SMART MATCH BOOST: إذا أول 2 reels متطابقين، ارفع احتمال الثالث بقوة!
  let adjustedWeights = { ...OUTCOME_WEIGHTS };
  
  // Check if first two reels match (any outcome)
  if (previousReels.length === 2 && previousReels[0] === previousReels[1]) {
    const matchedIcon = previousReels[0];
    const matchedOutcome = getOutcomeFromIcon(matchedIcon);
    
    console.log(`>> MATCH_BOOST: First 2 reels match (${matchedOutcome})! Increasing 3rd reel chance...`);
    
    // إذا أول 2 متطابقين، زيد احتمال الثالث من X% إلى 60%!
    // هذا يعطي اللاعب شعور "قريب من الفوز" ويزيد الإثارة
    const boostedChance = 60;
    const reduction = boostedChance - adjustedWeights[matchedOutcome];
    
    // Special case: Zero-Day triple should be extremely rare
    if (matchedOutcome === 'legendary' && matchedIcon === '/rewards/Zero_Day.png') {
      adjustedWeights[matchedOutcome] = 0.05; // 0.05% chance for third reel
    } else {
      // زيد احتمال المطابقة
      adjustedWeights[matchedOutcome] = boostedChance;
    }
    
    // قلل باقي الاحتمالات بشكل متناسب
    const otherOutcomes = Object.keys(adjustedWeights).filter(k => k !== matchedOutcome);
    otherOutcomes.forEach(outcome => {
      adjustedWeights[outcome] = Math.max(1, adjustedWeights[outcome] - (reduction / otherOutcomes.length));
    });
  }
  // LEGENDARY BOOST: إذا جا 🔥 في أول reel، احتمال الثاني يكون 🔥 يرتفع!
  else if (previousReels.length === 1 && isLegendaryIcon(previousReels[0], iconVariants)) {
    // إذا أول أيقونة Legendary عامة، نرفع فرصة الثانية
    // لكن لو كانت Zero-Day، لا نرفع، بل نقلل لإبقائها نادرة
    if (previousReels[0] === '/rewards/Zero_Day.png') {
      adjustedWeights.legendary = Math.min(adjustedWeights.legendary, 0.05);
      adjustedWeights.money = 35; // حافظ على المال قريب من الأصل
    } else {
      // أول reel طلع 🔥! زيد احتمال الثاني يكون 🔥 (من 7% إلى 15%!)
      adjustedWeights.legendary = 15;
      adjustedWeights.money = 32;
    }
  }
  
  for (const [outcome, weight] of Object.entries(adjustedWeights)) {
    cumulative += weight;
    if (rand <= cumulative) {
      return pickIconVariant(outcome, iconVariants);
    }
  }
  
  return pickIconVariant('common', iconVariants); // Fallback
}

// Map icon back to outcome type
function getOutcomeFromIcon(icon) {
  // First, check dynamic map built from manifest
  if (ICON_RARITY_MAP && ICON_RARITY_MAP[icon]) return ICON_RARITY_MAP[icon];
  const iconMap = {
    '/rewards/bagMoney.png': 'money',
    '📦': 'common',
    '/rewards/trash.png': 'common',
    '/rewards/RustyRAM.png': 'common',
    '💎': 'rare',
    '/rewards/moneyreward.png': 'rare',
    '/rewards/vpn_active_stick.png': 'rare',
    '⭐': 'epic',
    '/rewards/ddos_cannon_heavy.png': 'epic',
    '/rewards/flashHacker.png': 'legendary'
  };
  return iconMap[icon] || 'common';
}

exports.getManifest = async (req, res) => {
  try {
    let manifest = await scanRewardDirectory();
    manifest = injectSpecialItems(manifest);
    
    const stats = Object.entries(manifest).map(([rarity, items]) => ({
      rarity,
      count: items.length,
      chance: OUTCOME_WEIGHTS[rarity] + '%'
    }));
    
    res.json({
      success: true,
      message: '>> MANIFEST_LOADED: Reward database online',
      manifest,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '>> ERROR: Failed to load manifest'
    });
  }
};

exports.executeSpin = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('\n========================================');
    console.log('>> SLOT_MACHINE: Spin initiated');
    console.log('========================================');
    
    // Get user data
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
        // Auto-purge expired items/effects before proceeding
        try {
          const cleanup = getExpiryCleanupFields(user);
          const keys = Object.keys(cleanup);
          if (keys.length) {
            const { data: cleanedUser } = await supabase
              .from('users')
              .update(cleanup)
              .eq('id', userId)
              .select()
              .single();
            if (cleanedUser) Object.assign(user, cleanedUser);
          }
        } catch (e) {
          console.warn('>> EXPIRY_CLEANUP_FAILED:', e.message);
        }
    
    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        message: '>> ERROR: User not found'
      });
    }
    
    const SPIN_COST = getSpinCost(user.level);
    const currentCredits = safeNum(user.crypto_credits, safeNum(user.wallet?.crypto_credits, 0));
    // Check balance using sanitized currentCredits
    if (currentCredits < SPIN_COST) {
      return res.status(400).json({
        success: false,
        message: `>> INSUFFICIENT_FUNDS: Need ${SPIN_COST} crypto_credits`,
        currentBalance: currentCredits
      });
    }
    
    // Build dynamic icon pool so reels can display any item
    const iconVariants = await getMergedIconVariants();
    // Spin 3 reels with legendary boost system
    const slot1 = spinReel([], iconVariants);
    const slot2 = spinReel([slot1], iconVariants);
    const slot3 = spinReel([slot1, slot2], iconVariants);
    const slots = [slot1, slot2, slot3];
    
    console.log('>> Reels spun:', slots);
    
    // Always give 5 XP per spin!
    const baseXP = 5;
    const newXP = user.xp + baseXP;
    const newLevel = calculateLevel(newXP);
    const oldLevel = user.level || 1;
    const leveledUp = newLevel > oldLevel;
    
    // Level Up Reward: +500 credits for each level gained
    const levelUpBonus = leveledUp ? (newLevel - oldLevel) * 500 : 0;
    
    let updateData = {
      crypto_credits: currentCredits - SPIN_COST + levelUpBonus,
      xp: safeNum(newXP),
      level: safeNum(newLevel, 1)
    };
    
    console.log('>> BALANCE_BEFORE:', user.crypto_credits);
    console.log('>> BALANCE_AFTER_DEDUCTION:', updateData.crypto_credits);
    console.log('>> XP_GAINED: +5 XP (Total:', newXP, ')');
    if (leveledUp) {
      console.log('>> LEVEL_UP! New Level:', newLevel, '| Bonus:', levelUpBonus, 'credits');
    }
    
    let responseData = {
      success: true,
      slots: slots,
      outcome: {},
      spinCost: SPIN_COST,
      levelUp: leveledUp ? {
        newLevel: newLevel,
        oldLevel: oldLevel,
        bonus: levelUpBonus,
        xpToNext: getXPToNextLevel(newXP, newLevel)
      } : null,
      xpProgress: {
        current: newXP,
        toNext: getXPToNextLevel(newXP, newLevel),
        currentLevel: newLevel
      }
    };
    
    // Check if all 3 match (WIN!)
    if (slot1 === slot2 && slot2 === slot3) {
      const outcome = getOutcomeFromIcon(slot1);
      const matchedIcon = slot1;
      console.log('>> WIN! Outcome:', outcome);
      
      // TRIPLE MATCH BONUS: 50 XP for ANY triple match!
      const tripleMatchXP = 50;
      const totalTripleXP = user.xp + tripleMatchXP;
      const tripleLevelUp = calculateLevel(totalTripleXP) > oldLevel;
      const tripleLevelBonus = tripleLevelUp ? (calculateLevel(totalTripleXP) - oldLevel) * 500 : 0;
      
      if (outcome === 'money') {
        // WIN CRYPTO CREDITS
        const moneyAmount = Math.floor(Math.random() * (500 - 100 + 1)) + 100; // 100-500
        updateData.crypto_credits = safeNum(currentCredits - SPIN_COST + moneyAmount + levelUpBonus + tripleLevelBonus);
        updateData.xp = totalTripleXP;
        updateData.level = calculateLevel(totalTripleXP);
        
        responseData.outcome = {
          type: 'money',
          amount: moneyAmount,
          message: `💰💰💰 TRIPLE MATCH! ${moneyAmount} Credits + ${tripleMatchXP} XP!${tripleLevelUp ? ' 🎉 LEVEL UP!' : ''}`,
          netGain: moneyAmount - SPIN_COST + levelUpBonus + tripleLevelBonus,
          xpGained: tripleMatchXP
        };
        
        console.log(`>> Money win: ${moneyAmount} credits`);
        
      } else if (outcome === 'common' && matchedIcon === '/rewards/trash.png') {
        // TRIPLE TRASH = penalty
        const penalty = 200;
        updateData.crypto_credits = safeNum(currentCredits - SPIN_COST - penalty + levelUpBonus + tripleLevelBonus);
        updateData.xp = totalTripleXP; // still grant triple XP to keep consistency
        updateData.level = calculateLevel(totalTripleXP);

        responseData.outcome = {
          type: 'penalty',
          amount: -penalty,
          message: `🗑️🗑️🗑️ TRASH PENALTY! -${penalty} Credits + ${tripleMatchXP} XP!${tripleLevelUp ? ' \uD83C\uDF89 LEVEL UP!' : ''}`,
          netGain: -SPIN_COST - penalty + levelUpBonus + tripleLevelBonus,
          xpGained: tripleMatchXP
        };

        console.log(`>> Trash penalty applied: -${penalty} credits`);

      } else if (outcome === 'rare' && (matchedIcon === '💎' || matchedIcon === '/rewards/moneyreward.png')) {
        // TRIPLE DIAMOND (rare icon variant) = big money reward
        const bigMoneyAmount = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
        updateData.crypto_credits = safeNum(currentCredits - SPIN_COST + bigMoneyAmount + levelUpBonus + tripleLevelBonus);
        updateData.xp = totalTripleXP;
        updateData.level = calculateLevel(totalTripleXP);

        responseData.outcome = {
          type: 'money',
          amount: bigMoneyAmount,
          message: `💎💎💎 TRIPLE DIAMOND! ${bigMoneyAmount} Credits + ${tripleMatchXP} XP!${tripleLevelUp ? ' 🎉 LEVEL UP!' : ''}`,
          netGain: bigMoneyAmount - SPIN_COST + levelUpBonus + tripleLevelBonus,
          isDiamond: true,
          xpGained: tripleMatchXP
        };

        console.log(`>> Diamond win: ${bigMoneyAmount} credits`);

      } else {
        // WIN ITEM (common, rare, epic, legendary) — match the exact icon shown
        let manifest = await scanRewardDirectory();
        manifest = injectSpecialItems(manifest);
        const availableRewards = manifest[outcome];
        
        if (!availableRewards || availableRewards.length === 0) {
          // Fallback: give money instead
          const fallbackMoney = 150;
          updateData.crypto_credits = user.crypto_credits - SPIN_COST + fallbackMoney;
          
          responseData.outcome = {
            type: 'money',
            amount: fallbackMoney,
            message: `💰 COMPENSATION: ${fallbackMoney} Credits`,
            netGain: fallbackMoney - SPIN_COST
          };
        } else {
          // Prefer the item whose image matches the reels
          let reward = availableRewards.find(r => r.filePath === matchedIcon);
          if (!reward) {
            const randomIndex = Math.floor(Math.random() * availableRewards.length);
            reward = availableRewards[randomIndex];
          }
          
          // XP based on rarity - LEGENDARY gives MASSIVE XP!
          const xpGain = {
            common: 50,
            rare: 50,
            epic: 50,
            legendary: 1000  // All legendary triples grant +1000 XP
          }[outcome] || 50;
          
          // Update inventory
          // Carry over extended item properties if present
          const itemData = {
            fileName: reward.fileName,
            filePath: reward.filePath,
            rarity: reward.rarity,
            timestamp: new Date().toISOString(),
            type: reward.type,
            code: reward.code,
            name: reward.name,
            usable: reward.usable,
            equippable: reward.equippable,
            abilities: reward.abilities,
            attack_power: reward.attack_power,
            durability: reward.durability,
            hack_speed: reward.hack_speed,
            stealth_penalty: reward.stealth_penalty
          };
          
          // FlashHacker special properties + HUGE MONEY BONUS!
          let flashHackerBonus = 0;
          const isFlashHacker = (reward.type === 'flashHacker') || (reward.fileName === 'flashHacker.png');
          if (isFlashHacker) {
            itemData.type = 'flashHacker';
            itemData.abilities = {
              missionBoost: 100,        // +100% Mission Success Rate
              spinLuck: 50,              // +50% Better Spin Odds
              pvpShield: true,           // Immune to PvP attacks
              duration: 1800000          // 30 minutes (in milliseconds)
            };
            itemData.usable = true;
            itemData.used = false;
                      // If item is VPN (consumable), ensure flags
                      if (reward.type === 'vpn_active' || reward.code === 'vpn_active') {
                        itemData.type = 'vpn_active';
                        itemData.usable = true;
                        itemData.abilities = itemData.abilities || { duration: 30 * 60 * 1000 };
                      }

                      // If item is DDoS Cannon (equippable)
                      if (reward.code === 'ddos_cannon') {
                        itemData.equippable = true;
                        itemData.attack_power = itemData.attack_power || 75;
                        itemData.durability = itemData.durability || { max: 15, current: 15 };
                      }
            
            // 🔥 FLASHHACKER BONUS: 25,000 - 120,000 Credits
            flashHackerBonus = Math.floor(Math.random() * (120000 - 25000 + 1)) + 25000;
            console.log(`>> 🔥🔥🔥 FLASHHACKER BONUS: +${flashHackerBonus} credits!`);
          }
          
          const newInventory = [...(user.inventory || []), itemData];
          
          // Add TRIPLE MATCH XP (50 or 1000 for legendary)
          const bonusXP = xpGain;
          const totalXP = user.xp + bonusXP;
          const totalLevel = calculateLevel(totalXP);
          const itemLevelUp = totalLevel > oldLevel;
          const itemLevelBonus = itemLevelUp ? (totalLevel - oldLevel) * 500 : 0;
          
          updateData.xp = totalXP;
          updateData.level = totalLevel;
          updateData.crypto_credits = safeNum(currentCredits - SPIN_COST + itemLevelBonus + flashHackerBonus);
          updateData.inventory = newInventory;
          
          // Update response data for level up
          if (itemLevelUp) {
            responseData.levelUp = {
              newLevel: totalLevel,
              oldLevel: oldLevel,
              bonus: itemLevelBonus,
              xpToNext: getXPToNextLevel(totalXP, totalLevel)
            };
          }
          responseData.xpProgress = {
            current: totalXP,
            toNext: getXPToNextLevel(totalXP, totalLevel),
            currentLevel: totalLevel
          };
          
          const legendaryMsg = isFlashHacker
            ? `🔥🔥🔥 TRIPLE FLASHHACKER! +${bonusXP} XP + ${flashHackerBonus} Credits!${itemLevelUp ? ' 🎉 LEVEL UP!' : ''}`
            : `🔥🔥🔥 TRIPLE LEGENDARY! ${reward.name} +${bonusXP} XP!${itemLevelUp ? ' 🎉 LEVEL UP!' : ''}`;

          responseData.outcome = {
            type: 'item',
            rarity: outcome,
            item: reward,
            xpGained: bonusXP,
            creditsBonus: flashHackerBonus,
            message: outcome === 'legendary'
              ? legendaryMsg
              : `${SLOT_ICONS[outcome]}${SLOT_ICONS[outcome]}${SLOT_ICONS[outcome]} TRIPLE MATCH! ${outcome.toUpperCase()} item + ${bonusXP} XP!${itemLevelUp ? ' 🎉 LEVEL UP!' : ''}`,
            levelUp: itemLevelUp
          };
          
          console.log(`>> Item win: ${outcome} - ${reward.fileName}`);
        }
      }
    } else {
      // LOSE - No matching symbols
      console.log('>> LOSS: No match');
      
      // Check if player saw any rare/epic/legendary items (encouraging messages!)
      const outcomesSeen = slots.map(getOutcomeFromIcon);
      const hasLegendary = outcomesSeen.includes('legendary');
      const hasEpic = outcomesSeen.includes('epic');
      const hasRare = outcomesSeen.includes('rare');
      
      let lossMessage = '❌ BREACH_FAILED: Security detected!';
      
      if (hasLegendary) {
        const legendaryCount = outcomesSeen.filter(o => o === 'legendary').length;
        if (legendaryCount === 2) {
          lossMessage = '🔥🔥 SO CLOSE! Two FlashHackers! Next time...';
        } else {
          lossMessage = '🔥 FlashHacker spotted! Keep trying!';
        }
      } else if (hasEpic) {
        lossMessage = '⭐ Epic item detected! Almost there!';
      } else if (hasRare) {
        lossMessage = '💎 Rare item spotted! Try again!';
      }
      
      responseData.outcome = {
        type: 'loss',
        message: lossMessage + ` +${baseXP} XP`,
        netGain: -SPIN_COST,
        hasLegendary: hasLegendary,
        hasEpic: hasEpic,
        hasRare: hasRare,
        xpGained: baseXP
      };
    }
    
    // Track period earnings (add only positive credit gains)
    let earningsGain = 0;
    if (responseData.outcome.type === 'money') {
      earningsGain += responseData.outcome.amount || 0;
    }
    if (responseData.outcome.type === 'item' && (responseData.outcome.creditsBonus || 0) > 0) {
      earningsGain += responseData.outcome.creditsBonus;
    }
    // Level-up bonus is not counted as earnings here

    // Sanitize numeric fields before DB update
    updateData.crypto_credits = Math.max(0, Math.floor(safeNum(updateData.crypto_credits, currentCredits)));
    updateData.xp = Math.max(0, Math.floor(safeNum(updateData.xp, user.xp || 0)));
    updateData.level = Math.max(1, Math.floor(safeNum(updateData.level, user.level || 1)));

    // Update database
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      console.error('>> UPDATE ERROR:', updateError);
      return res.status(500).json({
        success: false,
        message: `>> SYSTEM_ERROR: Update failed (${updateError.message || 'unknown'})`
      });
    }
    
    // --- Update period earnings & Daily Missions Progress (if states exist) ---
    try {
      const logs = updatedUser.intrusion_logs || {};
      // Period earnings
      const now = new Date();
      const period = logs.leaderboard || { periodStart: now.toISOString(), earnings: 0 };
      const start = new Date(period.periodStart);
      const diffMs = now - start;
      if (diffMs >= 2 * 60 * 60 * 1000) {
        // reset period on user upon expiry
        period.periodStart = now.toISOString();
        period.earnings = 0;
      }
      period.earnings = Math.max(0, (period.earnings || 0) + Math.max(0, earningsGain));

      const daily = logs.daily_state;
      if (daily && Array.isArray(daily.missions)) {
        const xpDelta = (updateData.xp || updatedUser.xp) - (user.xp || 0);
        const isTripleMoney = (slot1 === slot2 && slot2 === slot3 && getOutcomeFromIcon(slot1) === 'money');
        const newMissions = daily.missions.map(m => {
          if (m.id === 'daily_spin') {
            const prog = Math.min(m.target, (m.progress || 0) + 1);
            return { ...m, progress: prog };
          }
          if (m.id === 'daily_xp_grind') {
            const prog = Math.min(m.target, (m.progress || 0) + Math.max(0, xpDelta));
            return { ...m, progress: prog };
          }
          if (m.id === 'daily_money_win' && isTripleMoney) {
            const prog = Math.min(m.target, (m.progress || 0) + 1);
            return { ...m, progress: prog };
          }
          return m;
        });
        const newLogs = { ...logs, leaderboard: period, daily_state: { lastReset: daily.lastReset, missions: newMissions } };
        await supabase
          .from('users')
          .update({ intrusion_logs: newLogs })
          .eq('id', userId);
      }
      else {
        // Persist leaderboard period even if no daily state
        const newLogs = { ...logs, leaderboard: period };
        await supabase
          .from('users')
          .update({ intrusion_logs: newLogs })
          .eq('id', userId);
      }
    } catch (e) {
      console.warn('>> DAILY_PROGRESS_UPDATE_FAILED:', e.message);
    }

    responseData.user = {
      id: updatedUser.id,
      username: updatedUser.username,
      wallet: {
        crypto_credits: updatedUser.crypto_credits,
        rare_gems: updatedUser.rare_gems
      },
      xp: updatedUser.xp,
      level: updatedUser.level,
      inventory: updatedUser.inventory || []
    };
    
    console.log('>> Spin complete!');
    console.log('========================================\n');
    
    res.json(responseData);
    
  } catch (error) {
    console.error('>> SPIN_ERROR:', error.stack || error);
    res.status(500).json({
      success: false,
      message: `>> SYSTEM_ERROR: Hack failed (${error.message || 'unknown'})`
    });
  }
};

exports.useItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemIndex } = req.body; // Index of item in inventory array
    
    console.log('\n========================================');
    console.log('>> ITEM_ACTIVATION: Item use requested');
    console.log('>> Item Index:', itemIndex);
    console.log('========================================');
    
    // Get user data
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        message: '>> ERROR: User not found'
      });
    }
    
    const inventory = user.inventory || [];
    const item = inventory[itemIndex];
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '>> ERROR: Item not found in inventory'
      });
    }
    
    if (!item.usable) {
      return res.status(400).json({
        success: false,
        message: '>> ERROR: This item cannot be used'
      });
    }
    
    if (item.used) {
      return res.status(400).json({
        success: false,
        message: '>> ERROR: Item already used'
      });
    }
    
    // Activate FlashHacker
    if (item.type === 'flashHacker') {
      const activatedUntil = new Date(Date.now() + item.abilities.duration).toISOString();
      
      // Mark item as used
      inventory[itemIndex].used = true;
      inventory[itemIndex].activatedAt = new Date().toISOString();
      inventory[itemIndex].activatedUntil = activatedUntil;
      
      // Update user with active FlashHacker
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          inventory: inventory,
          active_flashhacker: {
            abilities: item.abilities,
            activatedAt: new Date().toISOString(),
            expiresAt: activatedUntil
          }
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (updateError) {
        console.error('>> UPDATE ERROR:', updateError);
        return res.status(500).json({
          success: false,
          message: '>> SYSTEM_ERROR: Activation failed'
        });
      }
      
      console.log('>> FlashHacker ACTIVATED!');
      console.log('>> Expires at:', activatedUntil);
      console.log('========================================\n');
      
      return res.json({
        success: true,
        message: '🔥 FLASHHACKER ACTIVATED! +100% Mission Success, +50% Spin Luck, PvP Shield for 30 minutes!',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          wallet: {
            crypto_credits: updatedUser.crypto_credits,
            rare_gems: updatedUser.rare_gems
          },
          xp: updatedUser.xp,
          level: updatedUser.level,
          inventory: updatedUser.inventory,
          active_flashhacker: updatedUser.active_flashhacker
        }
      });
    }

    // Activate VPN-ACTIVE (consumable, keep item to show greyed with timer)
    if (item.code === 'vpn_active' || item.type === 'vpn_active') {
      const durationMs = item.buff_duration || (item.abilities?.duration) || (30 * 60 * 1000);
      const nowIso = new Date().toISOString();
      const activatedUntil = new Date(Date.now() + durationMs).toISOString();

      // Mark item as used and attach activation timestamps
      const newInventory = [...inventory];
      newInventory[itemIndex] = {
        ...newInventory[itemIndex],
        used: true,
        activatedAt: nowIso,
        activatedUntil
      };

      const active_vpn = {
        buffs: item.buffs || { stealth_mode: true, detection_reduction_percent: 90, pvp_trace_success_override: 0 },
        activatedAt: nowIso,
        expiresAt: activatedUntil
      };

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ inventory: newInventory, active_vpn })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('>> UPDATE ERROR:', updateError);
        return res.status(500).json({ success: false, message: '>> SYSTEM_ERROR: VPN activation failed' });
      }

      return res.json({
        success: true,
        message: '🛡️ VPN ACTIVATED! Stealth mode ON for 30 minutes.',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          wallet: { crypto_credits: updatedUser.crypto_credits, rare_gems: updatedUser.rare_gems },
          xp: updatedUser.xp,
          level: updatedUser.level,
          inventory: updatedUser.inventory,
          active_vpn: updatedUser.active_vpn
        }
      });
    }
    
    res.status(400).json({
      success: false,
      message: '>> ERROR: Unknown item type'
    });
    
  } catch (error) {
    console.error('>> USE_ITEM_ERROR:', error);
    res.status(500).json({
      success: false,
      message: '>> SYSTEM_ERROR: Item activation failed'
    });
  }
};

// Equip item into equipment slots (e.g., DDoS Cannon -> primary_weapon)
exports.equipItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemIndex, slot = 'primary_weapon' } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !user) return res.status(404).json({ success: false, message: 'User not found' });

    const inventory = user.inventory || [];
    const item = inventory[itemIndex];
    if (!item) return res.status(404).json({ success: false, message: 'Item not found in inventory' });
    if (!item.equippable) return res.status(400).json({ success: false, message: 'Item is not equippable' });

    const equipment = user.equipment || {};
    // Only handling primary weapon for now
    equipment[slot] = {
      code: item.code || 'unknown',
      name: item.name,
      attack_power: item.attack_power || 0,
      durability: item.durability || { max: 10, current: 10 },
      rarity: item.rarity,
      filePath: item.filePath
    };

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ equipment })
      .eq('id', userId)
      .select()
      .single();
    if (updateError) return res.status(500).json({ success: false, message: updateError.message });

    res.json({ success: true, message: `Equipped ${item.name} to ${slot}`, user: updatedUser });
  } catch (e) {
    console.error('>> EQUIP_ERROR:', e.message);
    res.status(500).json({ success: false, message: 'Equip failed' });
  }
};

exports.getInventory = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('inventory')
      .eq('id', req.user.id)
      .single();
    
    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: '>> ERROR: Failed to fetch inventory'
      });
    }
    // Remove expired used items on fetch
    const now = Date.now();
    const inv = Array.isArray(user.inventory) ? user.inventory : [];
    const filtered = inv.filter(it => {
      if (it && it.used && it.activatedUntil) {
        const exp = new Date(it.activatedUntil).getTime();
        return !(Number.isFinite(exp) && exp <= now);
      }
      return true;
    });
    if (filtered.length !== inv.length) {
      await supabase
        .from('users')
        .update({ inventory: filtered })
        .eq('id', req.user.id);
    }
    res.json({ success: true, inventory: filtered });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '>> ERROR: Failed to fetch inventory'
    });
  }
};
