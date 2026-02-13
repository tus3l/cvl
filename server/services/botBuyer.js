const supabase = require('../supabase');
const { getCaps } = require('../middleware/validatePrice');

const SLEEP_MS = 20 * 60 * 1000; // Every 20 minutes
const MAX_PER_RUN = 3; // buy up to 3 deals per run

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    const g = map.get(k) || [];
    g.push(x);
    map.set(k, g);
  }
  return map;
}

async function fetchListings() {
  const { data, error } = await supabase.from('market_listings').select('*');
  if (error) throw new Error(error.message);
  return data || [];
}

function computeAveragePrice(listings) {
  if (!listings.length) return 0;
  const sum = listings.reduce((a, l) => a + (l.price || 0), 0);
  return Math.floor(sum / listings.length);
}

function pickDeals(listings) {
  const deals = [];
  const groups = groupBy(listings, (l) => `${(l.item_data?.type || 'unknown')}:${(l.item_data?.name || 'Item')}`);
  for (const [key, arr] of groups.entries()) {
    const avg = computeAveragePrice(arr);
    if (avg <= 0) continue;
    const rarity = (arr[0].item_data?.rarity || 'common').toLowerCase();
    const caps = getCaps(rarity);
    // choose listings 10-20% below average and not near max cap
    const minAccept = Math.floor(avg * 0.8);
    const maxAccept = Math.floor(avg * 0.9);
    for (const l of arr) {
      const p = l.price || 0;
      const nearCap = p >= Math.floor(caps.max * 0.85);
      if (!nearCap && p >= minAccept && p <= maxAccept) deals.push(l);
    }
  }
  // Sort best deals first (lowest price)
  deals.sort((a, b) => a.price - b.price);
  return deals.slice(0, MAX_PER_RUN);
}

// Fallback logic: if no average (e.g., new item type), bots consider listings at or below rarity min as good deals
function pickFallbackDeals(listings) {
  const deals = [];
  for (const l of listings) {
    const rarity = (l.item_data?.rarity || 'common').toLowerCase();
    const caps = getCaps(rarity);
    const nearCap = (l.price || 0) >= Math.floor(caps.max * 0.85);
    if (!nearCap && (l.price || 0) <= caps.min) deals.push(l);
  }
  deals.sort((a, b) => a.price - b.price);
  return deals.slice(0, MAX_PER_RUN);
}

async function executePurchase(listing) {
  try {
    // Pay seller (net of 10% tax), remove listing, do not add item to any user (bot inventory ignored)
    const taxRate = 0.10;
    const net = Math.floor((listing.price || 0) * (1 - taxRate));
    if (listing.seller_id && !listing.is_bot) {
      const { data: seller } = await supabase
        .from('users')
        .select('id, crypto_credits')
        .eq('id', listing.seller_id)
        .single();
      if (seller) {
        await supabase
          .from('users')
          .update({ crypto_credits: (seller.crypto_credits || 0) + net })
          .eq('id', seller.id);
      }
    }
    await supabase
      .from('market_listings')
      .delete()
      .eq('id', listing.id);
    console.log('>> BOT_BUYER: purchased', listing.item_data?.name, 'for', listing.price, 'net to seller', net);
  } catch (e) {
    console.warn('>> BOT_BUYER_FAIL:', e.message);
  }
}

class BotBuyer {
  constructor(io) { this.io = io; this.timer = null; }
  async tick() {
    try {
      const listings = await fetchListings();
      let deals = pickDeals(listings);
      if (!deals.length) deals = pickFallbackDeals(listings);
      for (const l of deals) {
        await executePurchase(l);
      }
    } catch (e) {
      console.warn('>> BOT_BUYER_TICK_FAIL:', e.message);
    }
  }
  start() {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), SLEEP_MS);
    console.log('>> BOT_BUYER: started');
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

module.exports = BotBuyer;
