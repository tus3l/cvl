import React, { useMemo, useState } from 'react';
import './MySystem.css';
import { getCachedBackendBase } from '../backend';
import axios from 'axios';

// Helper: classify inventory items into slot categories
const getItemCategory = (item) => {
  const fp = (item?.filePath || '').toLowerCase();
  const type = (item?.type || '').toLowerCase();

  // Attack
  if (fp.includes('ddos_cannon') || type === 'ddos' || (item?.name || '').toLowerCase().includes('ddos')) {
    return 'attack:primaryWeapon';
  }
  if (type === 'exploit' || (item?.name || '').toLowerCase().includes('exploit') || (item?.name || '').toLowerCase().includes('brute')) {
    return 'attack:exploit';
  }

  // Defense
  if (fp.includes('vpn') || type === 'vpn' || (item?.name || '').toLowerCase().includes('vpn')) {
    return 'defense:stealth';
  }
  if (type === 'firewall' || (item?.name || '').toLowerCase().includes('firewall')) {
    return 'defense:firewall';
  }

  // Passive core modules (future items)
  if (type === 'cpu') return 'core:cpu';
  if (type === 'ram') return 'core:ram';
  if (type === 'cooling') return 'core:cooling';

  return null; // Not equipable in My System
};

const typeToCategoryFallback = (item) => {
  const t = (item?.type || '').toLowerCase();
  switch (t) {
    case 'ram': return 'core:ram';
    case 'cpu': return 'core:cpu';
    case 'cooling': return 'core:cooling';
    case 'vpn_active': return 'defense:stealth';
    case 'firewall': return 'defense:firewall';
    case 'ddos': return 'attack:primaryWeapon';
    case 'exploit': return 'attack:exploit';
    default: return null;
  }
};

const matchesSlot = (acceptTypes, item) => {
  const cat = getItemCategory(item) || typeToCategoryFallback(item);
  return !!cat && acceptTypes.includes(cat);
};

const InventorySidebar = ({ inventory }) => {
  const equipables = useMemo(() => (inventory || []).filter(i => getItemCategory(i)), [inventory]);

  return (
    <div className="inventory-sidebar">
      <div className="inv-header">// INVENTORY_MODULES</div>
      <div className="inv-list">
        {equipables.length === 0 && (
          <div className="inv-empty">&gt; No equipable modules detected...</div>
        )}
        {equipables.map((item, idxGlobal) => (
          <div
            key={(item.id || item.name || 'item') + '_' + idxGlobal}
            className={`inv-item ${getItemCategory(item)?.replace(':', '__')} code-${(item.code || item.type || 'module').toLowerCase()}`}
            draggable
            onDragStart={(e) => {
              const indexInInventory = (inventory || []).indexOf(item);
              e.dataTransfer.setData('application/json', JSON.stringify({ item, index: indexInInventory }));
              e.dataTransfer.effectAllowed = 'move';
            }}
            title={`${item.name || item.type} → ${getItemCategory(item)}`}
          >
            <div className="inv-item-thumb">
              {item.filePath ? (
                <img src={`${item.filePath?.startsWith('/') ? (getCachedBackendBase() || '') : ''}${item.filePath || ''}`} alt={item.name || 'module'} />
              ) : (
                <div className="pixel-box" />
              )}
            </div>
            <div className="inv-item-meta">
              <div className="inv-item-name">{item.name || item.type}</div>
              <div className="inv-item-cat">[{getItemCategory(item)}]</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Slot = ({ slotId, label, acceptTypes, equippedItem, onDropItem, onEject, onRequestPick }) => {
  const [hover, setHover] = useState(false);
  const [validHover, setValidHover] = useState(null); // true/false/null

  const handleDragOver = (e) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
      const cat = getItemCategory(payload.item);
      const isValid = !!cat && acceptTypes.includes(cat);
      setValidHover(isValid);
      e.dataTransfer.dropEffect = isValid ? 'move' : 'none';
    } catch {
      setValidHover(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
      const cat = getItemCategory(payload.item);
      const isValid = !!cat && acceptTypes.includes(cat);
      setValidHover(null);
      if (!isValid) return;
      onDropItem?.(slotId, payload.item, payload.index);
    } catch {
      // ignore
    }
  };

  const stateClass = equippedItem ? 'equipped' : 'empty';
  const codeClass = equippedItem ? `code-${(equippedItem.code || equippedItem.type || 'module').toLowerCase()}` : '';
  const hoverClass = hover ? 'hover' : '';
  const validityClass = validHover === null ? '' : (validHover ? 'valid' : 'invalid');

  return (
    <div
      className={`slot ${stateClass} ${hoverClass} ${validityClass} ${codeClass}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onRequestPick?.(slotId, acceptTypes)}
    >
      <div className="slot-label">{label}</div>
      {!equippedItem && (
        <div className="slot-placeholder">
          <div className="scanline" />
          <div className="placeholder-text">&gt; [ INSERT_MODULE ] &lt;</div>
        </div>
      )}
      {equippedItem && (
        <div className="slot-image-only">
          {equippedItem.filePath ? (
            <img src={`${equippedItem.filePath?.startsWith('/') ? (getCachedBackendBase() || '') : ''}${equippedItem.filePath || ''}`} alt={equippedItem.name || 'module'} />
          ) : (
            <div className="pixel-box" />
          )}
        </div>
      )}
      {validHover === false && (
        <div className="slot-error">[ ERROR: INVALID SOCKET TYPE ]</div>
      )}
      {validHover === true && (
        <div className="slot-ok">[ SOCKET READY ]</div>
      )}
    </div>
  );
};

const MySystem = ({ user }) => {
  const [equipped, setEquipped] = useState({
    'core:cpu': null,
    'core:ram': null,
    'core:cooling': null,
    'attack:primaryWeapon': null,
    'attack:exploit': null,
    'defense:firewall': null,
    'defense:stealth': null,
  });

  const [picker, setPicker] = useState({ open: false, slotId: null, acceptTypes: [] });
  // Local inventory state for hide-on-equip behavior
  const [inventory, setInventory] = useState(user?.inventory || []);
  React.useEffect(() => { setInventory(user?.inventory || []); }, [user]);

  const handleDropItem = async (slotId, item, index) => {
    // Optimistic UI update with rollback on failure
    const prevEquipped = { ...equipped };
    const prevInventory = [...inventory];

    // Apply optimistic state
    setEquipped(prev => {
      const prevItem = prev[slotId];
      if (prevItem) setInventory(inv => [...inv, prevItem]);
      return { ...prev, [slotId]: item };
    });
    if (typeof index === 'number' && index >= 0) {
      setInventory(inv => inv.filter((_, i) => i !== index));
    } else {
      setInventory(inv => {
        const idx = inv.indexOf(item);
        if (idx >= 0) return inv.filter((_, i) => i !== idx);
        return inv;
      });
    }

    // Persist defense equip if applicable (VPN ready-on-attack)
    if (slotId === 'defense:stealth' && (item?.type || '').toLowerCase() === 'vpn_active') {
      const durationMs = item?.abilities?.duration || (30 * 60 * 1000);
      const payload = {
        defenseItem: {
          kind: 'vpn',
          level: 50,
          expiresAt: new Date(Date.now() + durationMs).toISOString()
        }
      };
      axios.post('/api/pvp/defense', payload).catch(() => {});
    }

    try {
      await axios.post('/api/system/equip', { slotId, item });
    } catch (err) {
      // Roll back UI on failure
      setEquipped(prevEquipped);
      setInventory(prevInventory);
    }
  };

  const handleEject = async (slotId) => {
    const prevEquipped = { ...equipped };
    const prevInventory = [...inventory];
    setEquipped(prev => {
      const item = prev[slotId];
      if (item) setInventory(inv => [...inv, item]);
      return { ...prev, [slotId]: null };
    });

    try {
      await axios.post('/api/system/unequip', { slotId });
    } catch (err) {
      setEquipped(prevEquipped);
      setInventory(prevInventory);
    }
  };

  const openPicker = (slotId, acceptTypes) => {
    setPicker({ open: true, slotId, acceptTypes });
  };
  const closePicker = () => setPicker({ open: false, slotId: null, acceptTypes: [] });
  const selectItemForSlot = (item, idx) => {
    if (!picker.open || !picker.slotId) return;
    if (!matchesSlot(picker.acceptTypes, item)) return; // safety
    handleDropItem(picker.slotId, item, idx);
    closePicker();
  };

  // Persist equipped loadout whenever it changes
  React.useEffect(() => {
    const save = async () => {
      try {
        await axios.post('/api/system/loadout', { equipped });
      } catch {}
    };
    save();
  }, [equipped]);

  // Prefetch equipped loadout on mount to hydrate slots
  React.useEffect(() => {
    const fetchEquipped = async () => {
      try {
        const res = await axios.get('/api/system/loadout');
        if (res.data && res.data.success && res.data.equipped) {
          setEquipped(prev => ({ ...prev, ...res.data.equipped }));
        }
      } catch {}
      // Fallback: hydrate from auth payload if API not reachable
      if (user && user.equipped_loadout) {
        setEquipped(prev => ({ ...prev, ...user.equipped_loadout }));
      }
    };
    fetchEquipped();
  }, []);

  return (
    <div className="mysystem-container">
      <div className="sys-header">
        <div className="mysystem-title">// MY_SYSTEM — Loadout Control</div>
        <div className="sys-status">
          <span className="chip">Core: {['core:cpu','core:ram','core:cooling'].filter(k=>equipped[k]).length}/3</span>
          <span className="chip">Attack: {['attack:primaryWeapon','attack:exploit'].filter(k=>equipped[k]).length}/2</span>
          <span className="chip">Defense: {['defense:firewall','defense:stealth'].filter(k=>equipped[k]).length}/2</span>
        </div>
      </div>
      <div className="mysystem-grid">
        <div className="mysystem-left">
          <section className="sys-card">
            <div className="card-title">// SYSTEM_CORE_MODULES [Passive]</div>
            <div className="slots-grid">
              <Slot
                slotId="core:cpu"
                label="[ CPU SOCKET ]"
                acceptTypes={["core:cpu"]}
                equippedItem={equipped['core:cpu']}
                onDropItem={handleDropItem}
                onEject={handleEject}
                onRequestPick={openPicker}
              />
              <Slot
                slotId="core:ram"
                label="[ RAM SLOT ]"
                acceptTypes={["core:ram"]}
                equippedItem={equipped['core:ram']}
                onDropItem={handleDropItem}
                onEject={handleEject}
                onRequestPick={openPicker}
              />
              <Slot
                slotId="core:cooling"
                label="[ COOLING UNIT ]"
                acceptTypes={["core:cooling"]}
                equippedItem={equipped['core:cooling']}
                onDropItem={handleDropItem}
                onEject={handleEject}
                onRequestPick={openPicker}
              />
            </div>
          </section>

          <section className="sys-card">
            <div className="card-title">// ATTACK_VECTORS [Active]</div>
            <div className="slots-grid">
              <Slot
                slotId="attack:primaryWeapon"
                label="[ PRIMARY WEAPON ]"
                acceptTypes={["attack:primaryWeapon"]}
                equippedItem={equipped['attack:primaryWeapon']}
                onDropItem={handleDropItem}
                onEject={handleEject}
                onRequestPick={openPicker}
              />
              <Slot
                slotId="attack:exploit"
                label="[ EXPLOIT SCRIPT ]"
                acceptTypes={["attack:exploit"]}
                equippedItem={equipped['attack:exploit']}
                onDropItem={handleDropItem}
                onEject={handleEject}
                onRequestPick={openPicker}
              />
            </div>
          </section>

          <section className="sys-card">
            <div className="card-title">// SECURITY_FIREWALL [Defense]</div>
            <div className="slots-grid">
              <Slot
                slotId="defense:firewall"
                label="[ FIREWALL HARDWARE ]"
                acceptTypes={["defense:firewall"]}
                equippedItem={equipped['defense:firewall']}
                onDropItem={handleDropItem}
                onEject={handleEject}
                onRequestPick={openPicker}
              />
              <Slot
                slotId="defense:stealth"
                label="[ STEALTH PROTOCOL ]"
                acceptTypes={["defense:stealth"]}
                equippedItem={equipped['defense:stealth']}
                onDropItem={handleDropItem}
                onEject={handleEject}
                onRequestPick={openPicker}
              />
            </div>
          </section>
        </div>

        <div className="mysystem-right">
          <InventorySidebar inventory={inventory} />
        </div>
      </div>
      <div className="sys-hint">Click a slot to select from inventory or drag-and-drop.</div>

      {picker.open && (
        <div className="picker-overlay" onClick={closePicker}>
          <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="picker-header">
              <div className="picker-title">Select module for [{picker.slotId}]</div>
              <button className="picker-close" onClick={closePicker}>Close</button>
            </div>
            <div className="picker-body">
              <div className="picker-list">
                {inventory.map((it, idx) => ({ it, idx })).filter(({ it }) => matchesSlot(picker.acceptTypes, it)).map(({ it, idx }) => (
                  <div key={idx} className={`picker-item code-${(it.code || it.type || 'module').toLowerCase()}`} title={`${it.name || it.type}`}>
                    <div className="picker-thumb">
                      {it.filePath ? <img src={`${it.filePath?.startsWith('/') ? (getCachedBackendBase() || '') : ''}${it.filePath || ''}`} alt={it.name || 'module'} /> : <div className="pixel-box" />}
                    </div>
                    <div className="picker-meta">
                      <div className="picker-name">{it.name || it.type}</div>
                      <div className="picker-cat">[{getItemCategory(it)}]</div>
                    </div>
                    <button className="picker-select" onClick={() => selectItemForSlot(it, idx)}>Equip</button>
                  </div>
                ))}
              </div>
              {(inventory.filter(it => matchesSlot(picker.acceptTypes, it)).length === 0) && (
                <div className="picker-empty">No compatible modules available for this slot.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySystem;
