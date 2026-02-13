const supabase = require('../supabase');

// GET /api/system/loadout
async function getLoadout(req, res) {
  try {
    const userId = req.user.id;
    const { data: user, error } = await supabase
      .from('users')
      .select('equipment')
      .eq('id', userId)
      .single();
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, equipped: user?.equipment || {} });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// POST /api/system/loadout
async function saveLoadout(req, res) {
  try {
    const userId = req.user.id;
    const { equipped } = req.body;
    if (!equipped || typeof equipped !== 'object') {
      return res.status(400).json({ success: false, message: 'INVALID_EQUIPPED_PAYLOAD' });
    }
    const { error } = await supabase
      .from('users')
      .update({ equipment: equipped })
      .eq('id', userId);
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// POST /api/system/equip
async function equipItem(req, res) {
  try {
    const userId = req.user.id;
    const { slotId, slotName, itemId, item } = req.body;
    const slot = slotId || slotName;
    if (!slot) return res.status(400).json({ success: false, message: 'MISSING_SLOT' });

    const { data: user, error } = await supabase
      .from('users')
      .select('inventory, equipment, active_defense')
      .eq('id', userId)
      .single();
    if (error) return res.status(500).json({ success: false, message: error.message });

    const inv = Array.isArray(user.inventory) ? [...user.inventory] : [];
    const eq = user.equipment && typeof user.equipment === 'object' ? { ...user.equipment } : {};

    // Resolve item from inventory
    let index = -1;
    let selected = null;
    if (itemId != null) {
      index = inv.findIndex((it) => it && it.id === itemId);
      selected = index >= 0 ? inv[index] : null;
    }
    if (!selected && item && typeof item === 'object') {
      index = inv.findIndex((it) => it && ((item.id && it.id === item.id) || (it.name === item.name && (it.type || '') === (item.type || ''))));
      selected = index >= 0 ? inv[index] : null;
    }
    if (!selected) {
      return res.status(400).json({ success: false, message: 'ITEM_NOT_IN_INVENTORY' });
    }

    // Swap logic: move existing equipped back to inventory
    const prevEquipped = eq[slot] || null;
    if (prevEquipped) {
      inv.push(prevEquipped);
    }

    // Remove selected from inventory and set equipment
    inv.splice(index, 1);
    eq[slot] = selected;

    // Optional: if equipping VPN in stealth slot, set active_defense readiness
    let active_defense = user.active_defense || null;
    if (slot === 'defense:stealth' && ((selected.type || '').toLowerCase() === 'vpn_active' || (selected.name || '').toLowerCase().includes('vpn'))) {
      const durationMs = (selected.abilities && selected.abilities.duration) || (30 * 60 * 1000);
      active_defense = {
        kind: 'vpn',
        level: selected.level || 50,
        expiresAt: new Date(Date.now() + durationMs).toISOString()
      };
    }

    const { error: updErr } = await supabase
      .from('users')
      .update({ inventory: inv, equipment: eq, active_defense })
      .eq('id', userId);
    if (updErr) return res.status(500).json({ success: false, message: updErr.message });

    const { data: updated } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    res.json({ success: true, user: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

// POST /api/system/unequip
async function unequipItem(req, res) {
  try {
    const userId = req.user.id;
    const { slotId, slotName } = req.body;
    const slot = slotId || slotName;
    if (!slot) return res.status(400).json({ success: false, message: 'MISSING_SLOT' });

    const { data: user, error } = await supabase
      .from('users')
      .select('inventory, equipment')
      .eq('id', userId)
      .single();
    if (error) return res.status(500).json({ success: false, message: error.message });

    const inv = Array.isArray(user.inventory) ? [...user.inventory] : [];
    const eq = user.equipment && typeof user.equipment === 'object' ? { ...user.equipment } : {};

    const current = eq[slot] || null;
    if (!current) {
      return res.status(400).json({ success: false, message: 'SLOT_EMPTY' });
    }

    inv.push(current);
    eq[slot] = null;

    const { error: updErr } = await supabase
      .from('users')
      .update({ inventory: inv, equipment: eq })
      .eq('id', userId);
    if (updErr) return res.status(500).json({ success: false, message: updErr.message });

    const { data: updated } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    res.json({ success: true, user: updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
}

module.exports = { getLoadout, saveLoadout, equipItem, unequipItem };