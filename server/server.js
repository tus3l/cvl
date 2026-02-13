const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { setIo } = require('./io');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/authRoutes');
const spinRoutes = require('./routes/spinRoutes');
const missionRoutes = require('./routes/missionRoutes');
const marketRoutes = require('./routes/marketRoutes');
const pvpRoutes = require('./routes/pvpRoutes');
const systemRoutes = require('./routes/systemRoutes');

const app = express();
const httpServer = http.createServer(app);
// Allow any localhost port for development (handles 3000,3006,etc.)
const allowOriginRegex = /^http:\/\/localhost:\d+$/;
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowOriginRegex.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});
setIo(io);

// Express CORS: mirror the request origin if it matches localhost:any
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowOriginRegex.test(origin)) return callback(null, true);
    return callback(new Error('CORS blocked'), false);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/rewards', express.static(path.join(__dirname, '..', 'img')));

app.use('/api/auth', authRoutes);
app.use('/api/spin', spinRoutes);
app.use('/api/mission', missionRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/pvp', pvpRoutes);
app.use('/api/system', systemRoutes);

// Ghost Engine & Routes
const GhostEngine = require('./services/ghostEngine');
const ghostRoutes = require('./routes/ghostRoutes');
const ghostEngine = new GhostEngine(io);
app.locals.ghostEngine = ghostEngine;
app.use('/api/ghosts', ghostRoutes);
const leaderboardRoutes = require('./routes/leaderboardRoutes');
app.use('/api/leaderboard', leaderboardRoutes);
const LeaderboardEngine = require('./services/leaderboardEngine');
const leaderboardEngine = new LeaderboardEngine(io);
app.locals.leaderboardEngine = leaderboardEngine;
const EconomyBot = require('./services/economyBot');
const economyBot = new EconomyBot(io);
app.locals.economyBot = economyBot;
const BotBuyer = require('./services/botBuyer');
const botBuyer = new BotBuyer(io);
app.locals.botBuyer = botBuyer;
const MarketCleaner = require('./services/marketCleaner');
const marketCleaner = new MarketCleaner(io);
app.locals.marketCleaner = marketCleaner;

app.get('/api/test', (req, res) => {
  res.json({ message: '>> CONNECTION_ESTABLISHED <<' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, port: process.env.PORT || 5001 });
});

app.get('/api/test-supabase', async (req, res) => {
  const supabase = require('./supabase');
  
  try {
    console.log('>> Testing Supabase connection...');
    
    // Test 1: Check table exists
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('>> Supabase test failed:', error);
      return res.json({
        success: false,
        message: 'Table access failed',
        error: error.message,
        hint: error.hint,
        details: error.details
      });
    }
    
    console.log('>> Supabase test successful!');
    res.json({
      success: true,
      message: 'Supabase connection OK',
      tableExists: true
    });
    
  } catch (error) {
    console.error('>> Test exception:', error);
    res.json({
      success: false,
      message: 'Exception: ' + error.message
    });
  }
});

io.on('connection', (socket) => {
  console.log('>> SOCKET_CONNECTED:', socket.id);
  socket.on('disconnect', () => console.log('>> SOCKET_DISCONNECTED:', socket.id));
});

let enginesStarted = false;
function startEnginesOnce() {
  if (enginesStarted) return;
  enginesStarted = true;
  try {
    ghostEngine.start();
  } catch (e) {
    console.warn('>> GHOST_ENGINE_START_FAILED:', e.message);
  }
  try {
    leaderboardEngine.start();
  } catch (e) {
    console.warn('>> LB_ENGINE_START_FAILED:', e.message);
  }
  try {
    economyBot.start();
  } catch (e) {
    console.warn('>> ECONOMY_BOT_START_FAILED:', e.message);
  }
  try {
    botBuyer.start();
  } catch (e) {
    console.warn('>> BOT_BUYER_START_FAILED:', e.message);
  }
  try {
    marketCleaner.start();
  } catch (e) {
    console.warn('>> MARKET_CLEANER_START_FAILED:', e.message);
  }
}

const BASE_PORT = parseInt(process.env.PORT || '5001', 10);
let currentPort = BASE_PORT;

function startServer(port) {
  currentPort = port;
  httpServer.listen(port, () => {
    console.log(`>> SERVER_ONLINE: Port ${port}`);
    console.log('>> DATABASE: Supabase PostgreSQL');
    console.log('>> SYSTEM_STATUS: All systems operational');
    startEnginesOnce();
  });
}

httpServer.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    const nextPort = currentPort + 1;
    console.warn(`>> PORT_IN_USE: ${currentPort}. Retrying on ${nextPort}...`);
    startServer(nextPort);
  } else {
    console.error('>> SERVER_ERROR:', err);
  }
});

startServer(BASE_PORT);
