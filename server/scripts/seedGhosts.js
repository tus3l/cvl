// Script to populate database with Ghost Players (Bots)
// Run this ONCE: node server/scripts/seedGhosts.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { generateGhostArmy } = require('../services/ghostGenerator');
const supabase = require('../supabase');

async function seedGhostPlayers() {
  try {
    console.log('>> GHOST_SEEDER: Generating 50 Ghost Players...');
    
    // Check if ghosts already exist (prefer is_bot, fallback by username patterns)
    let { data: existingGhosts, error: checkError } = await supabase
      .from('users')
      .select('id, username')
      .eq('is_bot', true)
      .limit(1);

    if (!existingGhosts || existingGhosts.length === 0) {
      const fallback = await supabase
        .from('users')
        .select('id, username')
        .or('username.like.Ghost_%,username.like.xX_%,username.like.Dark_%,username.like.Cyber_%')
        .limit(1);
      existingGhosts = fallback.data || [];
      checkError = fallback.error;
    }

    if (checkError) {
      console.error('>> Error checking for existing ghosts:', checkError.message);
      return;
    }

    if (existingGhosts && existingGhosts.length > 0) {
      console.log('>> GHOST_SEEDER: Ghosts already exist in database. Skipping...');
      console.log('>> To re-seed, delete existing bots first.');
      return;
    }

    // Generate 50 ghost profiles
    const ghosts = generateGhostArmy(50);
    
    console.log('>> Sample Ghost Names:');
    ghosts.slice(0, 5).forEach(g => console.log(`   - ${g.username}`));
    
    // Insert into database
    console.log('>> GHOST_SEEDER: Inserting into database...');
    
    // Map ghosts to known columns (avoid missing is_bot column errors)
    const safeGhosts = ghosts.map(g => ({
      username: g.username,
      password: g.password,
      level: g.level,
      xp: g.xp,
      crypto_credits: g.crypto_credits,
      created_at: g.created_at,
      inventory: g.inventory,
      active_flashhacker: g.active_flashhacker,
      // Optional: If is_bot column exists in DB, you can add it here
      // is_bot: true
    }));

    const { data, error } = await supabase
      .from('users')
      .insert(safeGhosts);

    if (error) {
      console.error('>> GHOST_SEEDER_ERROR:', error.message);
      console.error('>> Details:', error);
      return;
    }

    console.log('>> GHOST_SEEDER: ✅ Successfully created 50 Ghost Players!');
    console.log('>> These bots will now appear in leaderboards and simulate activity.');
    
  } catch (error) {
    console.error('>> GHOST_SEEDER_FATAL:', error.message);
  }
}

// Run the seeder
seedGhostPlayers()
  .then(() => {
    console.log('>> GHOST_SEEDER: Complete. Exiting...');
    process.exit(0);
  })
  .catch(err => {
    console.error('>> GHOST_SEEDER_CRASH:', err);
    process.exit(1);
  });
