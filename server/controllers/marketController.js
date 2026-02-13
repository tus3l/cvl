const supabase = require('../supabase');
const { getIo } = require('../io');

// Utility to coerce positive integers safely
const safeInt = (n, def = 0) => {
  const x = parseInt(n, 10);
  return Number.isFinite(x) && x >= 0 ? x : def;
};

exports.listings = async (req, res) => {
  try {
    const { sort = 'listed_at_desc', rarity } = req.query;
    let query = supabase.from('market_listings').select('*');
    if (rarity) {
      query = query.contains('item_data', { rarity });
    }
    if (sort === 'price_asc') query = query.order('price', { ascending: true });
    else if (sort === 'price_desc') query = query.order('price', { ascending: false });
    else query = query.order('listed_at', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, listings: data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const { validateListingPrice, getCaps } = require('../middleware/validatePrice');

exports.sell = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'AUTH_REQUIRED' });

    const { itemIndex, price } = req.body; // using index for inventory items
    const sellPrice = safeInt(price, -1);
    if (sellPrice <= 0) return res.status(400).json({ success: false, message: 'INVALID_PRICE' });

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, username, inventory, crypto_credits')
      .eq('id', userId)
      .single();
    if (fetchError || !user) return res.status(404).json({ success: false, message: 'USER_NOT_FOUND' });

    const inventory = Array.isArray(user.inventory) ? [...user.inventory] : [];
    const idx = safeInt(itemIndex, -1);
    if (idx < 0 || idx >= inventory.length) return res.status(400).json({ success: false, message: 'ITEM_NOT_OWNED' });

    const item = inventory[idx];
    // Remove item from inventory
    inventory.splice(idx, 1);

    // Validate price caps by rarity
    const rarity = (item?.rarity || 'common').toLowerCase();
    const { ok, message } = validateListingPrice(rarity, sellPrice);
    if (!ok) {
      return res.status(400).json({ success: false, message });
    }

    // Limit: Max 5 active listings per player
    const { data: currentListings } = await supabase
      .from('market_listings')
      .select('id')
      .eq('seller_id', userId);
    if ((currentListings || []).length >= 5) {
      return res.status(400).json({ success: false, message: 'ERROR: LISTING_LIMIT_REACHED (max 5 active)' });
    }

    // Listing Fee: 5% non-refundable deposit
    const listingFeeRate = 0.05;
    const fee = Math.floor(sellPrice * listingFeeRate);
    if ((user.crypto_credits || 0) < fee) {
      return res.status(400).json({ success: false, message: `INSUFFICIENT_FUNDS_FOR_LISTING_FEE (${fee} CR required)` });
    }

    // Deduct fee immediately
    const { error: feeError } = await supabase
      .from('users')
      .update({ crypto_credits: user.crypto_credits - fee })
      .eq('id', userId);
    if (feeError) return res.status(500).json({ success: false, message: feeError.message });

    // Update user inventory first
    const { error: updateError } = await supabase
      .from('users')
      .update({ inventory })
      .eq('id', userId);
    if (updateError) return res.status(500).json({ success: false, message: updateError.message });

    // Create market listing snapshot
    const sellerName = user.username || 'Unknown';
    const snapshot = {
      name: item.name || item.fileName || 'Item',
      type: item.type || 'unknown',
      rarity: item.rarity || 'common',
      fileName: item.fileName || null,
      filePath: item.filePath || null,
      usable: !!item.usable,
      equippable: !!item.equippable,
      abilities: item.abilities || null,
      attack_power: item.attack_power || null,
      durability: item.durability || null,
    };

    const { data: listing, error: insertError } = await supabase
      .from('market_listings')
      .insert({ seller_id: userId, seller_name: sellerName, is_bot: false, item_data: snapshot, price: sellPrice })
      .select('*')
      .single();
    if (insertError) return res.status(500).json({ success: false, message: insertError.message });

    // Emit socket event for real-time market updates
    try {
      const io = getIo();
      io && io.emit('market_new_listing', listing);
    } catch {}

    res.json({ success: true, listing, listingFeeCharged: fee });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.buy = async (req, res) => {
  try {
    const buyerId = req.user?.id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'AUTH_REQUIRED' });

    const { listingId } = req.body;
    if (!listingId) return res.status(400).json({ success: false, message: 'MISSING_LISTING_ID' });

    const { data: listing, error: getError } = await supabase
      .from('market_listings')
      .select('*')
      .eq('id', listingId)
      .single();
    if (getError || !listing) return res.status(404).json({ success: false, message: 'LISTING_NOT_FOUND' });

    // Fetch buyer
    const { data: buyer, error: buyerError } = await supabase
      .from('users')
      .select('id, username, crypto_credits, inventory')
      .eq('id', buyerId)
      .single();
    if (buyerError || !buyer) return res.status(404).json({ success: false, message: 'BUYER_NOT_FOUND' });

    const price = safeInt(listing.price, 0);
    if ((buyer.crypto_credits || 0) < price) return res.status(400).json({ success: false, message: 'INSUFFICIENT_FUNDS' });

    // Deduct from buyer and add item to inventory
    const buyerInventory = Array.isArray(buyer.inventory) ? [...buyer.inventory] : [];
    buyerInventory.push({
      ...(listing.item_data || {}),
      timestamp: new Date().toISOString(),
      source: 'market',
    });

    const { error: buyerUpdateError } = await supabase
      .from('users')
      .update({ crypto_credits: buyer.crypto_credits - price, inventory: buyerInventory })
      .eq('id', buyerId);
    if (buyerUpdateError) return res.status(500).json({ success: false, message: buyerUpdateError.message });

    // Pay seller if real
    const taxRate = 0.10;
    if (listing.seller_id && !listing.is_bot) {
      const net = Math.floor(price * (1 - taxRate));
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
      // Note: If missing seller due to deletion, treat as money sink
    }

    // Remove listing
    await supabase
      .from('market_listings')
      .delete()
      .eq('id', listingId);

    // Emit removal event and sale notification
    try {
      const io = getIo();
      io && io.emit('market_listing_removed', { id: listingId });
      // Notify seller of sale
      const buyerName = buyer.username || 'Buyer';
      io && io.emit('market_sale', { seller_id: listing.seller_id, seller_name: listing.seller_name, buyer_name: buyerName, price, net: listing.seller_id && !listing.is_bot ? Math.floor(price * (1 - taxRate)) : 0 });
    } catch {}

    res.json({ success: true, message: 'PURCHASE_COMPLETE', item: listing.item_data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
