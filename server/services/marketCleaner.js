const supabase = require('../supabase');
const { getIo } = require('../io');

const CLEAN_INTERVAL_MS = 60 * 1000; // run every minute
const EXPIRY_MINUTES = 30;

async function fetchExpiredListings() {
  const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('market_listings')
    .select('*')
    .lte('listed_at', cutoff);
  if (error) throw new Error(error.message);
  return data || [];
}

async function removeListings(ids) {
  if (!ids.length) return;
  await supabase
    .from('market_listings')
    .delete()
    .in('id', ids);
}

class MarketCleaner {
  constructor(io) { this.io = io; this.timer = null; }
  async tick() {
    try {
      const expired = await fetchExpiredListings();
      if (!expired.length) return;
      const io = getIo();
      for (const listing of expired) {
        try {
          // If real seller, refund listing fee and return item to inventory
          if (listing.seller_id && !listing.is_bot) {
            const fee = Math.floor((listing.price || 0) * 0.05);
            const { data: seller } = await supabase
              .from('users')
              .select('id, crypto_credits, inventory, username')
              .eq('id', listing.seller_id)
              .single();
            if (seller) {
              const inventory = Array.isArray(seller.inventory) ? [...seller.inventory] : [];
              inventory.push({ ...(listing.item_data || {}), timestamp: new Date().toISOString(), source: 'market_expired' });
              await supabase
                .from('users')
                .update({ crypto_credits: (seller.crypto_credits || 0) + fee, inventory })
                .eq('id', seller.id);
              // Notify seller
              io && io.emit('market_listing_refunded', { seller_id: seller.id, seller_name: seller.username, listing_id: listing.id, refund: fee });
            }
          }
          // Remove listing
          await supabase
            .from('market_listings')
            .delete()
            .eq('id', listing.id);
          io && io.emit('market_listing_removed', { id: listing.id, expired: true });
        } catch (e) {
          console.warn('>> MARKET_CLEANER_REMOVE_FAIL:', e.message);
        }
      }
      console.log('>> MARKET_CLEANER: removed expired listings:', expired.length);
    } catch (e) {
      console.warn('>> MARKET_CLEANER_FAIL:', e.message);
    }
  }
  start() {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), CLEAN_INTERVAL_MS);
    console.log('>> MARKET_CLEANER: started');
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

module.exports = MarketCleaner;
