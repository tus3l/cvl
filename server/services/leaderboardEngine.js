const supabase = require('../supabase');

// Level-based scaling: prevent huge prizes at low levels by narrowing the usable range.
// Factor starts at 0.25 at level 1 and ramps up to 1.0 by ~level 50.
function levelFactor(level) {
  const lvl = Math.max(1, level || 1);
  return Math.max(0.25, Math.min(1, 0.25 + (lvl - 1) * 0.015));
}

// Prize ranges by rank (requested):
// 1st: 500,000 ~ 2,500,000
// 2nd: 250,000 ~   500,000
// 3rd: 100,000 ~   250,000
function getPrizeRangeByRank(level, rank) {
  const ranges = {
    1: { min: 500000, max: 2500000 },
    2: { min: 250000, max: 500000 },
    3: { min: 100000, max: 250000 }
  };
  const base = ranges[rank] || ranges[3];
  const f = levelFactor(level);
  // Scale the usable max within the bracket based on level
  const usableMax = Math.floor(base.min + (base.max - base.min) * f);
  return { min: base.min, max: Math.max(base.min, usableMax) };
}

function pickPrizeByRank(level, rank) {
  const { min, max } = getPrizeRangeByRank(level, rank);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class LeaderboardEngine {
  constructor(io) {
    this.io = io;
    this._running = false;
    this.timer = null;
    this.periodMs = 2 * 60 * 60 * 1000; // 2 hours
    this.nextEvalAt = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.schedule();
    console.log('>> LEADERBOARD_ENGINE: Started (2h periods)');
  }

  stop() {
    this._running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    console.log('>> LEADERBOARD_ENGINE: Stopped');
  }

  schedule() {
    if (!this._running) return;
    const now = Date.now();
    this.nextEvalAt = new Date(now + this.periodMs);
    this.timer = setTimeout(() => this.evaluatePeriod(), this.periodMs);
  }

  async evaluatePeriod() {
    try {
      // Fetch users with leaderboard state
      const { data: users, error } = await supabase
        .from('users')
        .select('id, username, level, crypto_credits, intrusion_logs')
        .limit(10000);
      if (error) {
        console.warn('>> LB: Fetch error', error.message);
        this.schedule();
        return;
      }
      // Sort by earnings descending
      const ranked = (users || [])
        .map(u => ({ id: u.id, username: u.username, level: u.level || 1, earnings: u.intrusion_logs?.leaderboard?.earnings || 0 }))
        .filter(u => (u.earnings || 0) > 0)
        .sort((a, b) => (b.earnings || 0) - (a.earnings || 0));

      const winners = ranked.slice(0, 3);
      if (winners.length === 0) {
        console.log('>> LB: No earnings this period');
      } else {
        for (let i = 0; i < winners.length; i++) {
          const w = winners[i];
          const rank = i + 1;
          const prize = pickPrizeByRank(w.level, rank);
          const { data: current } = await supabase
            .from('users')
            .select('crypto_credits, intrusion_logs')
            .eq('id', w.id)
            .single();

          const logs = current?.intrusion_logs || {};
          // Reset winner's period earnings
          logs.leaderboard = { periodStart: new Date().toISOString(), earnings: 0 };
          await supabase
            .from('users')
            .update({ crypto_credits: ((current?.crypto_credits || 0) + prize), intrusion_logs: logs })
            .eq('id', w.id);

          if (this.io) {
            const icons = { 1: '🏆', 2: '🥈', 3: '🥉' };
            this.io.emit('leaderboard_winner', {
              username: w.username,
              earnings: w.earnings,
              prize,
              rank,
              message: `${icons[rank] || '🏆'} ${w.username} - Rank #${rank}! Prize: +${prize}`
            });
          }
          console.log(`>> LB: Rank #${rank} ${w.username} (+${prize}), earnings=${w.earnings}`);
        }
      }

      // Reset period for everyone (shallow reset)
      for (const u of users || []) {
        const logs = u.intrusion_logs || {};
        logs.leaderboard = { periodStart: new Date().toISOString(), earnings: 0 };
        await supabase
          .from('users')
          .update({ intrusion_logs: logs })
          .eq('id', u.id);
      }

    } catch (e) {
      console.warn('>> LB_EVAL_ERROR:', e.message);
    } finally {
      this.schedule();
    }
  }

  status() {
    const now = Date.now();
    const leftMs = this.nextEvalAt ? (this.nextEvalAt.getTime() - now) : null;
    return {
      running: this._running,
      secondsLeft: leftMs !== null ? Math.max(0, Math.floor(leftMs / 1000)) : null,
      prizes: [
        { rank: 1, min: 500000, max: 2500000, note: 'scaled by level' },
        { rank: 2, min: 250000, max: 500000, note: 'scaled by level' },
        { rank: 3, min: 100000, max: 250000, note: 'scaled by level' }
      ]
    };
  }
}

module.exports = LeaderboardEngine;