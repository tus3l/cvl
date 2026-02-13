import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Market.css';
import { io } from 'socket.io-client';

const SellerBadge = ({ name, isBot }) => (
  <span className={`seller-badge ${isBot ? 'bot' : 'player'}`}>[{name}]</span>
);

const Market = ({ user, backendBase }) => {
  const [listings, setListings] = useState([]);
  const [sort, setSort] = useState('listed_at_desc');
  const [rarity, setRarity] = useState('');
  const [sellIndex, setSellIndex] = useState(null);
  const [sellPrice, setSellPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0); // re-render countdowns

  const EXPIRY_MS = 30 * 60 * 1000;
  const remainingMs = (l) => {
    const listedAtMs = l.listed_at ? new Date(l.listed_at).getTime() : Date.now();
    return Math.max(0, (listedAtMs + EXPIRY_MS) - Date.now());
  };
  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const loadListings = async () => {
    try {
      const params = {};
      if (sort) params.sort = sort;
      if (rarity) params.rarity = rarity;
      const res = await axios.get('/api/market/listings', { params });
      if (res.data.success) setListings(res.data.listings);
    } catch (e) {
      setMessage(e.response?.data?.message || 'Failed to load market');
    }
  };

  useEffect(() => { loadListings(); }, [sort, rarity]);

  // Tick every second for live countdowns
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Live updates via socket
  useEffect(() => {
    const base = backendBase || 'http://localhost:5001';
    const socket = io(base, { withCredentials: true });
    socket.on('market_new_listing', (listing) => {
      // Only add if matches current filter
      if (!rarity || (listing.item_data?.rarity || '').toLowerCase() === rarity) {
        setListings(prev => [listing, ...prev]);
      }
    });
    socket.on('market_listing_removed', ({ id }) => {
      setListings(prev => prev.filter(l => l.id !== id));
    });
    return () => socket.disconnect();
  }, [backendBase, rarity]);

  const sellItem = async () => {
    setLoading(true); setMessage('');
    try {
      const price = parseInt(sellPrice, 10);
      const res = await axios.post('/api/market/sell', { itemIndex: sellIndex, price });
      if (res.data.success) {
        setMessage('Listed for sale!');
        setSellIndex(null); setSellPrice('');
        loadListings();
      } else {
        setMessage(res.data.message);
      }
    } catch (e) {
      setMessage(e.response?.data?.message || 'Sell failed');
    } finally { setLoading(false); }
  };

  const buyListing = async (id) => {
    setLoading(true); setMessage('');
    try {
      const res = await axios.post('/api/market/buy', { listingId: id });
      if (res.data.success) {
        setMessage('Purchased!');
        loadListings();
      } else {
        setMessage(res.data.message);
      }
    } catch (e) {
      setMessage(e.response?.data?.message || 'Buy failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="market-container">
      <div className="market-global-banner">// GLOBAL MARKET — نفس العرض لكل اللاعبين</div>
      <div className="market-controls">
        <div>
          <label>Sort:</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="listed_at_desc">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
        <div>
          <label>Rarity:</label>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="">All</option>
            <option value="common">Common</option>
            <option value="rare">Rare</option>
            <option value="epic">Epic</option>
            <option value="legendary">Legendary</option>
          </select>
        </div>
      </div>

      {message && <div className="market-message">{message}</div>}

      <div className="market-grid">
        {listings.filter(l => remainingMs(l) > 0).map(l => (
          <div key={l.id} className={`market-card rarity-${(l.item_data?.rarity || 'common').toLowerCase()} code-${(l.item_data?.code || 'generic').toLowerCase()}`}>
            <div className="market-thumb">
              {l.item_data?.filePath && (
                <img src={`${backendBase || ''}${l.item_data.filePath}`} alt={l.item_data?.name} />
              )}
            </div>
            <div className="market-info">
              <div className="market-title">{l.item_data?.name}</div>
              {l.listed_at && (
                <div className="market-countdown">Expires in {fmtTime(remainingMs(l))}</div>
              )}
              <div className="market-meta">
                <SellerBadge name={l.seller_name} isBot={l.is_bot} />
                <span className="market-price">{l.price} CR</span>
              </div>
              <button disabled={loading} className="cyber-button" onClick={() => buyListing(l.id)}>
                BUY
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sell-panel">
        <h3>&gt;&gt; SELL AN ITEM</h3>
        <div className="sell-controls">
          <select value={sellIndex ?? ''} onChange={(e) => setSellIndex(parseInt(e.target.value, 10))}>
            <option value="">Select item</option>
            {(user?.inventory || []).map((it, idx) => (
              <option key={idx} value={idx}>{it.name || it.fileName} ({it.rarity})</option>
            ))}
          </select>
          <input type="number" placeholder="Price" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
          <button disabled={loading || sellIndex === null || !sellPrice} className="cyber-button" onClick={sellItem}>
            LIST FOR SALE
          </button>
        </div>
        <p className="tax-note">Note: 10% tax applies on sale proceeds.</p>
      </div>
    </div>
  );
};

export default Market;
