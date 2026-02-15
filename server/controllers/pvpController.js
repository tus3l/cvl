const supabase = require('../supabase');

const getPlayers = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: players, error } = await supabase
      .from('users')
      .select('id, username, level, reputation, exposed_until, active_defense')
      .neq('id', userId)
      .order('reputation', { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({
        success: false,
        message: '>> ERROR: Failed to load players'
      });
    }

    const now = new Date();
    const processedPlayers = players.map(p => ({
      ...p,
      is_exposed: p.exposed_until && new Date(p.exposed_until) > now,
      defense_level: p.active_defense?.level || 0
    }));

    res.json({
      success: true,
      players: processedPlayers
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '>> ERROR: ' + error.message
    });
  }
};

const attackPlayer = async (req, res) => {
  try {
    const { targetUserId, loadout } = req.body;
    const attackerId = req.user.id;

    // Loadout is optional now; miniGameScore may supplement base attack

    // Get attacker
    const { data: attacker } = await supabase
      .from('users')
      .select('*')
      .eq('id', attackerId)
      .single();

    // Get target
    const { data: target } = await supabase
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (!attacker || !target || attacker.crypto_credits < 100) {
      return res.status(400).json({
        success: false,
        message: '>> ERROR: Invalid attack'
      });
    }

    // Optional equipment: gear boosts attack power if present (no gating)
    const eqA = attacker.equipment || attacker.equipped_loadout || {};
    
    // Debug: Log equipment to verify DDoS is loaded
    console.log('=== PVP ATTACK DEBUG ===');
    console.log('Attacker:', attacker.username);
    console.log('Equipment:', JSON.stringify(eqA, null, 2));
    console.log('Primary Weapon:', eqA['attack:primaryWeapon']);
    console.log('========================');

    // Calculate scores
    const mgScore = typeof req.body.miniGameScore === 'number' ? req.body.miniGameScore : 0;
    const baseAttack = (loadout?.hardware?.level || 0) + (loadout?.software?.level || 0) + ((loadout?.crew?.skill_level || 0) * 2) + mgScore;
    let equipBoost = 0;
    
    // DDoS Cannon - primary weapon with durability
    let ddosUsed = false;
    let updatedInventory = null;
    const pw = eqA['attack:primaryWeapon'];
    if (pw) {
      equipBoost += (typeof pw.attack_power === 'number' ? pw.attack_power : 50);
      // Check if it's DDoS with durability
      if (pw.durability && typeof pw.durability.current === 'number' && pw.durability.current > 0) {
        ddosUsed = true;
        // Decrease durability
        pw.durability.current -= 1;
        // If durability reaches 0, remove from equipment
        if (pw.durability.current <= 0) {
          delete eqA['attack:primaryWeapon'];
          // Also remove from inventory
          updatedInventory = (attacker.inventory || []).filter(item => {
            return !(item.code === pw.code && item.filePath === pw.filePath);
          });
        }
      }
    }
    
    const ex = eqA['attack:exploit'];
    if (ex) equipBoost += 30;
    if (eqA['core:cpu']) equipBoost += 20;
    if (eqA['core:ram']) equipBoost += 10;
    if (eqA['core:cooling']) equipBoost += 5;
    if (eqA['defense:stealth']) equipBoost += 10;
    const attackScore = baseAttack + equipBoost;
    const nowTs = Date.now();
    const activeDefense = target.active_defense || {};
    const defenseActive = activeDefense.expiresAt ? (new Date(activeDefense.expiresAt).getTime() > nowTs) : !!activeDefense.level;
    const defenseLevel = defenseActive ? (activeDefense.level || 0) : 0;
    const eqT = target.equipment || target.equipped_loadout || {};
    let defenseEquipBoost = 0;
    if (eqT['defense:firewall']) defenseEquipBoost += 30;
    const defenseScore = defenseLevel + defenseEquipBoost + (target.level * 10);
    const isExposed = target.exposed_until && new Date(target.exposed_until) > new Date();
    const effectiveDefense = isExposed ? defenseScore * 0.5 : defenseScore;
    
    const successChance = Math.min(90, Math.max(10, (attackScore / (effectiveDefense + 1)) * 100));
    const roll = Math.random() * 100;

    const intrusionLog = {
      attacker_id: attackerId,
      attacker_name: attacker.username,
      time: new Date().toISOString(),
      result: roll <= successChance ? 'success' : 'blocked',
      attack_score: attackScore,
      defense_score: Math.floor(effectiveDefense)
    };

    let outcome = {};
    let attackerUpdate = { crypto_credits: attacker.crypto_credits - 100 };
    let targetUpdate = {
      intrusion_logs: [...(target.intrusion_logs || []), intrusionLog].slice(-10)
    };

    if (roll <= successChance) {
      // Success
      const stolenAmount = Math.floor(target.crypto_credits * 0.25);
      const stolenGems = Math.floor(target.rare_gems * 0.1);
      
      attackerUpdate.crypto_credits = attacker.crypto_credits - 100 + stolenAmount;
      attackerUpdate.rare_gems = attacker.rare_gems + stolenGems;
      attackerUpdate.reputation = attacker.reputation + 50;
      
      // Update equipment and inventory if DDoS was used
      if (ddosUsed) {
        attackerUpdate.equipment = eqA;
        if (updatedInventory) {
          attackerUpdate.inventory = updatedInventory;
        }
      }
      
      // Add DDoS freeze effect to target
      if (ddosUsed) {
        targetUpdate.ddos_freeze_until = new Date(Date.now() + 3000).toISOString(); // 3 seconds
      }

      targetUpdate.crypto_credits = target.crypto_credits - stolenAmount;
      targetUpdate.rare_gems = target.rare_gems - stolenGems;
      targetUpdate.reputation = Math.max(0, target.reputation - 25);

      outcome = {
        success: true,
        type: 'success',
        message: `>> BREACH_SUCCESSFUL: Extracted ${stolenAmount} Credits + ${stolenGems} Gems from ${target.username}`,
        stolen: { credits: stolenAmount, gems: stolenGems },
        ddosUsed: ddosUsed
      };
    } else {
      // Blocked
      attackerUpdate.reputation = Math.max(0, attacker.reputation - 10);
      
      // Update equipment if DDoS was used even on failed attack
      if (ddosUsed) {
        attackerUpdate.equipment = eqA;
        if (updatedInventory) {
          attackerUpdate.inventory = updatedInventory;
        }
      }
      
      targetUpdate.reputation = target.reputation + 25;

      outcome = {
        success: false,
        type: 'blocked',
        message: `>> ATTACK_BLOCKED: ${target.username}'s defense held strong${defenseActive && activeDefense.kind ? ` [${activeDefense.kind.toUpperCase()}]` : ''}`,
        ddosUsed: ddosUsed
      };
    }

    // Update both users
    await supabase.from('users').update(attackerUpdate).eq('id', attackerId);
    await supabase.from('users').update(targetUpdate).eq('id', targetUserId);

    const { data: updatedAttacker } = await supabase
      .from('users')
      .select('*')
      .eq('id', attackerId)
      .single();

    res.json({
      success: true,
      outcome,
      user: {
        id: updatedAttacker.id,
        username: updatedAttacker.username,
        crypto_credits: updatedAttacker.crypto_credits,
        rare_gems: updatedAttacker.rare_gems,
        reputation: updatedAttacker.reputation,
        equipment: updatedAttacker.equipment || {},
        equipped_loadout: updatedAttacker.equipped_loadout || {} // For backward compatibility
      },
      stats: {
        attack_score: attackScore,
        defense_score: Math.floor(effectiveDefense),
        success_chance: successChance.toFixed(1)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '>> ERROR: ' + error.message
    });
  }
};

const getIntrusionLogs = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user } = await supabase
      .from('users')
      .select('intrusion_logs')
      .eq('id', userId)
      .single();

    res.json({
      success: true,
      logs: user?.intrusion_logs || []
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '>> ERROR: ' + error.message
    });
  }
};

const updateDefense = async (req, res) => {
  try {
    const { defenseItem } = req.body;
    const userId = req.user.id;

    await supabase
      .from('users')
      .update({ active_defense: defenseItem })
      .eq('id', userId);

    res.json({
      success: true,
      message: '>> DEFENSE_SYSTEM_UPDATED'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '>> ERROR: ' + error.message
    });
  }
};

module.exports = {
  getPlayers,
  attackPlayer,
  getIntrusionLogs,
  updateDefense
};
