// Ghost Engine - AI Bot Simulation Service
// Runs in background and simulates bot activities

const supabase = require('../supabase');

class GhostEngine {
  constructor(io) {
    this.io = io; // Socket.io instance
    this._running = false;
    this.interval = null;
    this.stats = { actions: 0, spins: 0, levelUps: 0, bigWins: 0, lastAction: null };
  }

  async start() {
    if (this._running) {
      console.log('>> GHOST_ENGINE: Already running');
      return;
    }

    this._running = true;
    console.log('>> GHOST_ENGINE: Starting AI Bot Simulation...');

    // Run every 15-30 seconds (random interval)
    this.scheduleNextAction();
  }

  async scheduleNextAction() {
    if (!this._running) return;

    // Activity factor: if humans earning more, bots act faster/better
    const factor = await this.getActivityFactor();
    const baseMin = 15000, baseMax = 30000;
    const delay = Math.floor((Math.random() * (baseMax - baseMin) + baseMin) / Math.max(1, factor));

    this.interval = setTimeout(async () => {
      await this.executeRandomAction(factor);
      await this.scheduleNextAction(); // Schedule next action
    }, delay);
  }

  async executeRandomAction(activityFactor = 1) {
    try {
      // Try primary: is_bot flag
      let { data: bots, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_bot', true)
        .limit(100);

      // Fallback: match usernames that look like ghosts
      if (!bots || bots.length === 0) {
        const fallback = await supabase
          .from('users')
          .select('*')
          .or('username.like.Ghost_%,username.like.xX_%,username.like.Dark_%,username.like.Cyber_%')
          .limit(100);
        bots = fallback.data || [];
        error = fallback.error;
      }

      if (error) {
        console.log('>> GHOST_ENGINE: Bot query error', error.message);
        return;
      }
      if (!bots || bots.length === 0) {
        console.log('>> GHOST_ENGINE: No bots found');
        return;
      }

      // Pick random bot
      const bot = bots[Math.floor(Math.random() * bots.length)];

      // Choose random action
      const actions = ['spin', 'levelUp', 'bigWin'];
      const action = actions[Math.floor(Math.random() * actions.length)];

      switch (action) {
        case 'spin':
          await this.simulateSpin(bot, activityFactor);
          break;
        case 'levelUp':
          await this.simulateLevelUp(bot);
          break;
        case 'bigWin':
          await this.simulateBigWin(bot, activityFactor);
          break;
      }

      // Stats
      this.stats.actions += 1;
      this.stats.lastAction = { action, username: bot.username, at: new Date().toISOString() };

    } catch (error) {
      console.error('>> GHOST_ENGINE_ERROR:', error.message);
    }
  }

  async simulateSpin(bot, activityFactor = 1) {
    // Randomly increase bot stats
    const xpGain = Math.floor(Math.random() * 50) + 5;
    let base = Math.floor(Math.random() * 1000) - 400; // Can lose or win
    const creditsChange = base > 0 ? Math.floor(base * Math.max(1, activityFactor)) : base;

    const newXP = bot.xp + xpGain;
    const newCredits = Math.max(0, bot.crypto_credits + creditsChange);

    await supabase
      .from('users')
      .update({
        xp: newXP,
        crypto_credits: newCredits,
        last_active: new Date().toISOString()
      })
      .eq('id', bot.id);

    console.log(`>> GHOST_SPIN: ${bot.username} spun (${creditsChange >= 0 ? '+' : ''}${creditsChange} credits)`);
    this.stats.spins += 1;

    // Track period earnings (add only positive credit gains)
    if (creditsChange > 0) {
      await this.updatePeriodEarnings(bot.id, creditsChange);
    }
  }

  async simulateLevelUp(bot) {
    const newLevel = bot.level + 1;
    const bonusCredits = 500;

    await supabase
      .from('users')
      .update({
        level: newLevel,
        crypto_credits: bot.crypto_credits + bonusCredits,
        last_active: new Date().toISOString()
      })
      .eq('id', bot.id);

    console.log(`>> GHOST_LEVEL_UP: ${bot.username} reached Level ${newLevel}!`);
    this.stats.levelUps += 1;

    // Broadcast to all users
    if (this.io) {
      this.io.emit('ghost_level_up', {
        username: bot.username,
        level: newLevel,
        message: `🎉 ${bot.username} reached Level ${newLevel}!`
      });
    }
  }

  async simulateBigWin(bot, activityFactor = 1) {
    // Simulate legendary/epic win
    const winTypes = [
      { type: 'legendary', item: 'FlashHacker USB', credits: Math.floor(Math.random() * 95000) + 25000 },
      { type: 'epic', item: 'DDoS Cannon', credits: Math.floor(Math.random() * 5000) + 2000 },
      { type: 'diamond', item: 'Diamond Jackpot', credits: Math.floor(Math.random() * 10000) + 5000 }
    ];

    const baseWin = winTypes[Math.floor(Math.random() * winTypes.length)];
    const win = { ...baseWin, credits: Math.floor(baseWin.credits * Math.max(1, activityFactor)) };

    await supabase
      .from('users')
      .update({
        crypto_credits: bot.crypto_credits + win.credits,
        reputation: bot.reputation + 50,
        last_active: new Date().toISOString()
      })
      .eq('id', bot.id);

    console.log(`>> GHOST_BIG_WIN: ${bot.username} won ${win.item}! +${win.credits} credits`);
    this.stats.bigWins += 1;

    // Track period earnings immediately
    await this.updatePeriodEarnings(bot.id, win.credits);

    // Broadcast to all users (create ENVY!)
    if (this.io) {
      this.io.emit('ghost_big_win', {
        username: bot.username,
        item: win.item,
        type: win.type,
        credits: win.credits,
        message: `🔥 SERVER: ${bot.username} just hacked a [${win.item}]! (+${win.credits} credits)`
      });
    }
  }

  async getActivityFactor() {
    try {
      // Sum human (non-bot) earnings this period; map to 1..3 factor
      const { data } = await supabase
        .from('users')
        .select('intrusion_logs, is_bot')
        .limit(10000);
      let sum = 0;
      for (const u of data || []) {
        if (u.is_bot) continue;
        const e = u.intrusion_logs?.leaderboard?.earnings || 0;
        sum += e;
      }
      // Thresholds: 0=>1x, 100k=>2x, 200k+=>3x
      if (sum >= 200000) return 3;
      if (sum >= 100000) return 2;
      return 1;
    } catch {
      return 1;
    }
  }

  async updatePeriodEarnings(userId, gain) {
    try {
      const { data: u } = await supabase
        .from('users')
        .select('intrusion_logs')
        .eq('id', userId)
        .single();
      const now = new Date();
      const logs = u?.intrusion_logs || {};
      const period = logs.leaderboard || { periodStart: now.toISOString(), earnings: 0 };
      const start = new Date(period.periodStart);
      if ((now - start) >= 2 * 60 * 60 * 1000) {
        period.periodStart = now.toISOString();
        period.earnings = 0;
      }
      period.earnings = Math.max(0, (period.earnings || 0) + Math.max(0, gain));
      await supabase
        .from('users')
        .update({ intrusion_logs: { ...(logs || {}), leaderboard: period } })
        .eq('id', userId);
    } catch (e) {
      console.warn('>> GHOST_EARNINGS_UPDATE_FAILED:', e.message);
    }
  }

  stop() {
    this._running = false;
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
    console.log('>> GHOST_ENGINE: Stopped');
  }

  isRunning() {
    return this._running;
  }

  getStats() {
    return this.stats;
  }
}

module.exports = GhostEngine;
