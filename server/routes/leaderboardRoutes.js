const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
// Engine accessed via app.locals; no direct require needed here

// GET /api/leaderboard/top?metric=credits|level|xp|earnings&limit=20
router.get('/top', async (req, res) => {
  try {
    const metric = (req.query.metric || 'credits').toLowerCase();
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);

    let orderColumn = 'crypto_credits';
    if (metric === 'level') orderColumn = 'level';
    else if (metric === 'xp') orderColumn = 'xp';
    else if (metric === 'earnings') {
      // Period earnings ranking based on intrusion_logs.leaderboard.earnings
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username, level, xp, crypto_credits, intrusion_logs')
          .limit(10000); // fetch broad set then sort client-side
        if (error) throw new Error(error.message);
        const players = (data || [])
          .map(p => ({
            username: p.username,
            level: p.level,
            xp: p.xp,
            crypto_credits: p.crypto_credits,
            earnings: p.intrusion_logs?.leaderboard?.earnings || 0,
            periodStart: p.intrusion_logs?.leaderboard?.periodStart || null
          }))
          .sort((a, b) => (b.earnings || 0) - (a.earnings || 0))
          .slice(0, limit);
        let secondsLeft = null;
        const ps = players[0]?.periodStart;
        if (ps) {
          const diff = (new Date(ps).getTime() + 2 * 60 * 60 * 1000) - Date.now();
          secondsLeft = Math.max(0, Math.floor(diff / 1000));
        }
        return res.json({ ok: true, metric: 'earnings', players, secondsLeft });
      } catch (e) {
        // Fallback: if intrusion_logs column doesn't exist yet, return credits-only with zero earnings
        const { data, error } = await supabase
          .from('users')
          .select('username, level, xp, crypto_credits')
          .order('crypto_credits', { ascending: false })
          .limit(limit);
        if (error) return res.status(500).json({ ok: false, error: error.message });
        const players = (data || []).map(p => ({ ...p, earnings: 0 }));
        return res.json({ ok: true, metric: 'earnings', players, secondsLeft: null, note: 'earnings disabled until intrusion_logs column is added' });
      }
    }

    const { data, error } = await supabase
      .from('users')
      .select('username, level, xp, crypto_credits')
      .order(orderColumn, { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, metric: orderColumn, players: data || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/status', (req, res) => {
  try {
    const engine = req.app.locals.leaderboardEngine;
    if (!engine) return res.status(500).json({ ok: false, error: 'LeaderboardEngine not initialized' });
    return res.json({ ok: true, ...engine.status() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
