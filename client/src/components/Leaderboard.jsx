import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Leaderboard = ({ metric = 'earnings', refresh = 0 }) => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [prizes, setPrizes] = useState([]);

  const fetchTop = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/leaderboard/top?metric=${metric}&limit=20`);
      if (res.data.ok) {
        setPlayers(res.data.players || []);
        setSecondsLeft(res.data.secondsLeft ?? null);
      }
      else setError(res.data.error || 'Failed to load leaderboard');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTop();
  }, [metric, refresh]);
  
  // For earnings, poll status endpoint every ~15s for countdown
  useEffect(() => {
    let t;
    const poll = async () => {
      if (metric !== 'earnings') return;
      try {
        const res = await axios.get('/api/leaderboard/status');
        if (res.data.ok) {
          setSecondsLeft(res.data.secondsLeft);
          setPrizes(res.data.prizes || []);
        }
      } catch {}
      t = setTimeout(poll, 15000);
    };
    poll();
    return () => { if (t) clearTimeout(t); };
  }, [metric]);

  // Local 1-second countdown tick for smoother UX
  useEffect(() => {
    if (metric !== 'earnings') return;
    const ticker = setInterval(() => {
      setSecondsLeft((s) => (typeof s === 'number' && s > 0 ? s - 1 : s));
    }, 1000);
    return () => clearInterval(ticker);
  }, [metric]);

  const formatTime = (s) => {
    if (typeof s !== 'number' || s == null) return '';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  return (
    <div className="leaderboard-panel">
      <h2>> LEADERBOARD (2-HOUR EARNINGS)</h2>
      {metric === 'earnings' && secondsLeft !== null && (
        <p style={{ color: '#ffaa00' }}>Period ends in: {formatTime(secondsLeft)}</p>
      )}
      {metric === 'earnings' && prizes && prizes.length > 0 && (
        <div style={{ margin: '8px 0', color: '#00ff00' }}>
          <strong>Prizes (scaled by level):</strong>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: 6 }}>
            {prizes.map(p => (
              <span key={p.rank}>
                {p.rank === 1 ? '1st' : p.rank === 2 ? '2nd' : '3rd'}: {p.min} ~ {p.max}
              </span>
            ))}
          </div>
        </div>
      )}
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#f33' }}>{error}</p>}
      {!loading && !error && (
        <div className="leaderboard-table">
          <div className="lb-header">
            <span>#</span>
            <span>User</span>
            <span>Level</span>
            <span>XP</span>
            <span>Earnings</span>
          </div>
          {players.map((p, i) => (
            <div key={p.username + i} className="lb-row">
              <span>{i + 1}</span>
              <span>{p.username}</span>
              <span>{p.level}</span>
              <span>{p.xp}</span>
              <span>{p.earnings || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;