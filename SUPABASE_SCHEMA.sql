-- Users Table (create if not exists)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  crypto_credits INTEGER DEFAULT 1000,
  rare_gems INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  inventory JSONB DEFAULT '[]'::jsonb,
  crew JSONB DEFAULT '[]'::jsonb,
  active_defense JSONB DEFAULT NULL,
  active_flashhacker JSONB DEFAULT NULL,
  intrusion_logs JSONB DEFAULT '[]'::jsonb,
  reputation INTEGER DEFAULT 0,
  exposed_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safe migrations: add any missing columns so the app can run
ALTER TABLE users ADD COLUMN IF NOT EXISTS crypto_credits INTEGER DEFAULT 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rare_gems INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS crew JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_defense JSONB DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_flashhacker JSONB DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_vpn JSONB DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS intrusion_logs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reputation INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS exposed_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Note: The statements above already add missing columns safely using IF NOT EXISTS

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read/update their own data
CREATE POLICY "Users can read own data" 
  ON users FOR SELECT 
  USING (true);

CREATE POLICY "Users can update own data" 
  ON users FOR UPDATE 
  USING (true);

CREATE POLICY "Users can insert own data" 
  ON users FOR INSERT 
  WITH CHECK (true);

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NULL,
  seller_name TEXT NOT NULL,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  item_data JSONB NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  listed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_market_listings_price ON market_listings(price);
CREATE INDEX IF NOT EXISTS idx_market_listings_listed_at ON market_listings(listed_at DESC);
