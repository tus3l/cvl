const supabase = require('../supabase');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
const JWT_EXPIRE = '7d';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

exports.register = async (req, res) => {
  console.log('\n========================================');
  console.log('>> REGISTER REQUEST RECEIVED');
  console.log('========================================');
  
  try {
    const { username, password } = req.body;
    console.log('>> Username:', username);
    console.log('>> Password length:', password ? password.length : 0);

    if (!username || !password) {
      console.log('>> ERROR: Missing credentials');
      return res.status(400).json({ 
        success: false, 
        message: '>> ERROR: Username and password required' 
      });
    }

    console.log('>> Checking if user exists...');
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    console.log('>> Check result:', { 
      exists: !!existingUser, 
      error: checkError ? checkError.message : 'none' 
    });

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('>> CHECK ERROR:', checkError);
      return res.status(500).json({ 
        success: false, 
        message: '>> ERROR: Database check failed - ' + checkError.message
      });
    }

    if (existingUser) {
      console.log('>> User already exists');
      return res.status(400).json({ 
        success: false, 
        message: '>> ERROR: Username already exists in the system' 
      });
    }

    console.log('>> Inserting new user...');
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          password,
          crypto_credits: 1000,
          rare_gems: 0,
          xp: 0,
          level: 1,
          inventory: [],
          crew: [],
          active_defense: null,
          active_flashhacker: null,
          intrusion_logs: [],
          reputation: 0,
          exposed_until: null
        }
      ])
      .select()
      .single();

    console.log('>> Insert result:', { 
      success: !!newUser, 
      error: error ? error.message : 'none',
      errorDetails: error 
    });

    if (error) {
      console.error('>> INSERT ERROR:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        success: false, 
        message: '>> SYSTEM_ERROR: ' + error.message,
        hint: error.hint,
        details: error.details
      });
    }

    console.log('>> User created successfully:', newUser.id);
    const token = generateToken(newUser.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log('>> Registration complete!');
    console.log('========================================\n');

    res.status(201).json({
      success: true,
      message: '>> REGISTRATION_COMPLETE: Identity created',
      user: {
        id: newUser.id,
        username: newUser.username,
        wallet: {
          crypto_credits: newUser.crypto_credits,
          rare_gems: newUser.rare_gems
        },
        xp: newUser.xp,
        level: newUser.level,
        reputation: newUser.reputation,
        crew: newUser.crew,
        active_defense: newUser.active_defense,
        exposed_until: newUser.exposed_until
      },
      token
    });

  } catch (error) {
    console.error('========================================');
    console.error('>> REGISTRATION EXCEPTION:');
    console.error('>> Message:', error.message);
    console.error('>> Stack:', error.stack);
    console.error('========================================\n');
    
    res.status(500).json({ 
      success: false, 
      message: '>> SYSTEM_ERROR: ' + error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '>> ERROR: Credentials required' 
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        message: '>> ACCESS_DENIED: Invalid credentials' 
      });
    }

    if (user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: '>> ACCESS_DENIED: Invalid credentials' 
      });
    }

    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: '>> CONNECTION_ESTABLISHED: Identity verified',
      user: {
        id: user.id,
        username: user.username,
        wallet: {
          crypto_credits: user.crypto_credits,
          rare_gems: user.rare_gems
        },
        inventory: user.inventory || [],
        equipped_loadout: (user.equipped_loadout || user.equipment || {}),
        xp: user.xp,
        level: user.level,
        reputation: user.reputation,
        crew: user.crew,
        active_defense: user.active_defense,
        intrusion_logs: user.intrusion_logs,
        exposed_until: user.exposed_until
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: '>> SYSTEM_ERROR: Authentication failed' 
    });
  }
};

exports.logout = (req, res) => {
  res.cookie('token', '', { maxAge: 0 });
  res.json({ 
    success: true, 
    message: '>> CONNECTION_TERMINATED: Logged out successfully' 
  });
};

exports.getCurrentUser = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        success: false, 
        message: '>> ERROR: User not found' 
      });
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        wallet: {
          crypto_credits: user.crypto_credits,
          rare_gems: user.rare_gems
        },
        inventory: user.inventory || [],
        equipped_loadout: (user.equipped_loadout || user.equipment || {}),
        xp: user.xp,
        level: user.level,
        reputation: user.reputation,
        crew: user.crew,
        active_defense: user.active_defense,
        intrusion_logs: user.intrusion_logs,
        exposed_until: user.exposed_until
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '>> ERROR: Could not fetch user data' 
    });
  }
};
