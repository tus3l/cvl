// Ghost Player Identity Generator
// Generates realistic hacker usernames for AI bots

const PREFIXES = [
  'Dark', 'Cyber', 'Neon', 'Ghost', 'Root', 'Sudo', 'xX', 
  'KSA', 'Toxic', 'Viper', 'Shadow', 'Phoenix', 'Ninja',
  'Blade', 'Storm', 'Frost', 'Fire', 'Elite', 'Pro', 'Apex'
];

const SUFFIXES = [
  'Hunter', 'Wolf', '99', '_Dev', '.exe', '007', 'X', '_Sniper',
  'Hacker', 'Killer', 'Master', 'Lord', 'King', 'God', 'Demon',
  '420', '666', '_Pro', '_Elite', '2077'
];

const MIDDLE_WORDS = [
  'The', 'Of', 'In', 'On', '', '', '', '' // Empty strings for simple names
];

function generateGhostUsername() {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const middle = MIDDLE_WORDS[Math.floor(Math.random() * MIDDLE_WORDS.length)];
  
  if (middle) {
    return `${prefix}_${middle}_${suffix}`;
  }
  return `${prefix}_${suffix}`;
}

function generateGhostProfile() {
  const username = generateGhostUsername();
  const level = Math.floor(Math.random() * 50) + 1; // Level 1-50
  const reputation = Math.floor(Math.random() * 10000) + 100; // 100-10,100
  const crypto_credits = Math.floor(Math.random() * 50000) + 1000; // 1,000-51,000
  const xp = Math.floor(Math.random() * 5000);
  
  return {
    username,
    email: `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@ghost.bot`,
    password: 'ghost_bot_password_' + Math.random().toString(36),
    level,
    reputation,
    xp,
    crypto_credits,
    is_bot: true,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    inventory: [],
    active_flashhacker: null
  };
}

function generateGhostArmy(count = 50) {
  const ghosts = [];
  const usedNames = new Set();
  
  while (ghosts.length < count) {
    const ghost = generateGhostProfile();
    
    // Ensure unique usernames
    if (!usedNames.has(ghost.username)) {
      usedNames.add(ghost.username);
      ghosts.push(ghost);
    }
  }
  
  return ghosts;
}

module.exports = {
  generateGhostUsername,
  generateGhostProfile,
  generateGhostArmy
};
