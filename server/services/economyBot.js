const supabase = require('../supabase');

const BOT_NAMES = ['Trader_X', 'Ghost_Seller', 'Dark_Trader', 'Cipher_Merchant', 'ByteBroker'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate a bot item according to rarity roll
function generateBotListing() {
  const roll = Math.random() * 100;
  if (roll < 40) {
    // Common: Rusty RAM
    return {
      seller_name: pick(BOT_NAMES),
      is_bot: true,
      item_data: {
        name: 'Rusty RAM',
        type: 'ram',
        rarity: 'common',
        fileName: 'RustyRAM.png',
        filePath: '/rewards/RustyRAM.png',
        equippable: true,
        hack_speed: 5,
        stealth_penalty: -2,
        durability: 50
      },
      price: randInt(6000, 12000)
    };
  } else if (roll < 60) {
    // Common: Rusty Cooling
    return {
      seller_name: pick(BOT_NAMES),
      is_bot: true,
      item_data: {
        name: 'Rusty Cooling',
        type: 'cooling',
        rarity: 'common',
        fileName: 'rusty_cooling.png',
        filePath: '/rewards/rusty_cooling.png',
        equippable: true,
        cooldown_reduction_percent: 5,
        stealth_penalty: -5,
        durability: 50
      },
      price: randInt(5000, 10000)
    };
  } else if (roll < 75) {
    // Common: Rusty CPU
    return {
      seller_name: pick(BOT_NAMES),
      is_bot: true,
      item_data: {
        name: 'Rusty CPU',
        type: 'cpu',
        rarity: 'common',
        fileName: 'rusty_cpu.png',
        filePath: '/rewards/rusty_cpu.png',
        equippable: true,
        hack_speed: 8,
        overheat_risk_percent: 10,
        durability: 40
      },
      price: randInt(8000, 15000)
    };
  } else if (roll < 90) {
    // Rare: Military VPN
    return {
      seller_name: pick(BOT_NAMES),
      is_bot: true,
      item_data: {
        name: 'Military VPN',
        type: 'vpn_active',
        rarity: 'rare',
        fileName: 'Military_VPN.png',
        filePath: '/rewards/Military_VPN.png',
        usable: true,
        abilities: { duration: 30 * 60 * 1000 }
      },
      price: randInt(60000, 120000)
    };
  } else if (roll < 97) {
    // Epic: RTX 4090 Mining Rig
    return {
      seller_name: pick(BOT_NAMES),
      is_bot: true,
      item_data: {
        name: 'RTX 4090 Mining Rig',
        type: 'gpu',
        rarity: 'epic',
        fileName: 'rtx_4090_minig.png',
        filePath: '/rewards/rtx_4090_minig.png',
        equippable: true,
        passive_income_per_hour: 100,
        brute_force_boost_percent: 40
      },
      price: randInt(200000, 500000)
    };
  } else if (roll < 99) {
    // Legendary: Quantum CPU
    return {
      seller_name: pick(BOT_NAMES),
      is_bot: true,
      item_data: {
        name: 'Quantum CPU',
        type: 'cpu',
        rarity: 'legendary',
        fileName: 'Quantum_CPU.png',
        filePath: '/rewards/Quantum_CPU.png',
        equippable: true,
        abilities: { instant_hack: true, multitask: true, baseSpeed: 100 }
      },
      price: randInt(1200000, 3000000)
    };
  } else {
    // Legendary: Zero-Day Exploit (consumable, auto-win)
    return {
      seller_name: pick(BOT_NAMES),
      is_bot: true,
      item_data: {
        name: 'Zero-Day Exploit',
        type: 'zero_day',
        rarity: 'legendary',
        fileName: 'Zero_Day.png',
        filePath: '/rewards/Zero_Day.png',
        usable: true,
        abilities: { autoWin: true },
        charges: 1
      },
      price: randInt(1200000, 3000000)
    };
  }
}

async function injectBotListing() {
  const listing = generateBotListing();
  try {
    await supabase
      .from('market_listings')
      .insert({ ...listing });
    console.log('>> ECONOMY_BOT: listed', listing.item_data.name, 'for', listing.price);
  } catch (e) {
    console.warn('>> ECONOMY_BOT_FAIL:', e.message);
  }
}

class EconomyBot {
  constructor(io) {
    this.io = io;
    this.timer = null;
  }
  start() {
    if (this.timer) return;
    // Run now and then every 30 minutes
    injectBotListing();
    this.timer = setInterval(injectBotListing, 30 * 60 * 1000);
    console.log('>> ECONOMY_BOT: started');
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = EconomyBot;
