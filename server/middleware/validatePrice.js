// Price cap validation for marketplace listings

const CAPS = {
  // Encourage spins by keeping market prices high but reasonable
  common: { min: 5000, max: 15000 },
  uncommon: { min: 15000, max: 35000 },
  rare: { min: 60000, max: 120000 },
  epic: { min: 200000, max: 500000 },
  legendary: { min: 1200000, max: 3000000 }
};

function getCaps(rarity) {
  const key = (rarity || 'common').toLowerCase();
  return CAPS[key] || CAPS.common;
}

function validateListingPrice(itemRarity, price) {
  const caps = getCaps(itemRarity);
  const p = parseInt(price, 10);
  if (!Number.isFinite(p)) return { ok: false, message: 'ERROR: INVALID_PRICE' };
  if (p < caps.min) {
    return { ok: false, message: `ERROR: PRICE_UNDERFLOW. Min allowed for ${capitalize(itemRarity)} items is ${caps.min} Credits.` };
  }
  if (p > caps.max) {
    return { ok: false, message: `ERROR: PRICE_OVERFLOW. Max allowed for ${capitalize(itemRarity)} items is ${caps.max} Credits.` };
  }
  return { ok: true };
}

function capitalize(s) {
  if (!s) return 'Common';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Express middleware wrapper for POST /sell
async function validatePriceMiddleware(req, res, next) {
  try {
    const { itemIndex, price } = req.body;
    if (itemIndex === undefined || price === undefined) {
      return res.status(400).json({ success: false, message: 'MISSING_FIELDS' });
    }

    // We need the item rarity; marketController will re-fetch inventory.
    // To avoid double fetch, accept rarity if client sends, else proceed and check in controller.
    req._listingPrice = parseInt(price, 10);
    next();
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
}

module.exports = {
  CAPS,
  getCaps,
  validateListingPrice,
  validatePriceMiddleware
};
