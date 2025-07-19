-- Migration: Create enhanced trading system tables
-- Created: 2025-01-18
-- Purpose: Add comprehensive trading functionality with order book, market data, and user positions

-- Create markets table
CREATE TABLE IF NOT EXISTS markets (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  end_date TIMESTAMP NOT NULL,
  resolution_criteria TEXT NOT NULL,
  resolution_source VARCHAR(255) DEFAULT 'Manual resolution',
  created_by VARCHAR(255) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Trading parameters
  min_bet_amount DECIMAL(20,8) DEFAULT 0.01,
  max_bet_amount DECIMAL(20,8) DEFAULT 1000.00,

  -- Market state
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'resolved', 'cancelled')),
  is_resolved BOOLEAN DEFAULT false,
  outcome BOOLEAN DEFAULT NULL,
  resolved_at TIMESTAMP DEFAULT NULL,

  -- Trading statistics
  total_volume DECIMAL(20,8) DEFAULT 0,
  total_yes_volume DECIMAL(20,8) DEFAULT 0,
  total_no_volume DECIMAL(20,8) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_trades INTEGER DEFAULT 0,

  -- Price information
  current_price DECIMAL(10,8) DEFAULT 0.50,
  yes_price DECIMAL(10,8) DEFAULT 0.50,
  no_price DECIMAL(10,8) DEFAULT 0.50,
  last_traded_price DECIMAL(10,8) DEFAULT 0.50,
  best_bid DECIMAL(10,8) DEFAULT 0,
  best_ask DECIMAL(10,8) DEFAULT 0,
  spread DECIMAL(10,8) DEFAULT 0,

  -- Fee structure
  market_maker_fee DECIMAL(5,4) DEFAULT 0.0000,
  taker_fee DECIMAL(5,4) DEFAULT 0.0000,
  manteia_fee DECIMAL(5,4) DEFAULT 0.0200, -- 2% platform fee

  -- Additional metadata
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT false
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  market_id VARCHAR(255) NOT NULL,
  outcome BOOLEAN NOT NULL, -- true for YES, false for NO
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('market', 'limit')),
  price DECIMAL(10,8) NOT NULL CHECK (price >= 0 AND price <= 1),
  size DECIMAL(20,8) NOT NULL CHECK (size > 0),
  filled_size DECIMAL(20,8) DEFAULT 0,
  remaining_size DECIMAL(20,8) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'filled', 'cancelled', 'expired')),
  transaction_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id VARCHAR(255) NOT NULL,
  maker_id INTEGER NOT NULL,
  taker_id INTEGER NOT NULL,
  maker_order_id UUID NOT NULL,
  taker_order_id UUID NOT NULL,
  outcome BOOLEAN NOT NULL,
  price DECIMAL(10,8) NOT NULL,
  size DECIMAL(20,8) NOT NULL,
  maker_fee DECIMAL(20,8) DEFAULT 0,
  taker_fee DECIMAL(20,8) DEFAULT 0,
  manteia_fee DECIMAL(20,8) DEFAULT 0,
  transaction_hash VARCHAR(66),
  block_number BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key constraints
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  FOREIGN KEY (maker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (taker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (maker_order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (taker_order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create enhanced user_positions table
CREATE TABLE IF NOT EXISTS user_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  market_id VARCHAR(255) NOT NULL,
  outcome BOOLEAN NOT NULL,
  shares DECIMAL(20,8) NOT NULL DEFAULT 0,
  avg_price DECIMAL(10,8) NOT NULL DEFAULT 0,
  total_cost DECIMAL(20,8) NOT NULL DEFAULT 0,
  realized_pnl DECIMAL(20,8) DEFAULT 0,
  unrealized_pnl DECIMAL(20,8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint
  UNIQUE (user_id, market_id, outcome),

  -- Foreign key constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
);

-- Create enhanced transactions table (extend existing)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS market_id VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS token_address VARCHAR(42);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS from_address VARCHAR(42);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_address VARCHAR(42);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS value DECIMAL(20,8);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS chain_id INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_end_date ON markets(end_date);
CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at);
CREATE INDEX IF NOT EXISTS idx_markets_total_volume ON markets(total_volume);

CREATE INDEX IF NOT EXISTS idx_orders_market_outcome ON orders(market_id, outcome);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_price ON orders(price);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_maker ON trades(maker_id);
CREATE INDEX IF NOT EXISTS idx_trades_taker ON trades(taker_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);

CREATE INDEX IF NOT EXISTS idx_positions_user ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market ON user_positions(market_id);

CREATE INDEX IF NOT EXISTS idx_transactions_market ON transactions(market_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(transaction_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Insert sample markets for testing
INSERT INTO markets (id, title, description, category, end_date, resolution_criteria, tags, featured)
VALUES
('mkt_1', 'Will Bitcoin reach $100,000 by end of 2025?', 'This market will resolve to YES if Bitcoin (BTC) reaches or exceeds $100,000 USD on any major exchange (Coinbase, Binance, Kraken) before January 1, 2026, 00:00 UTC.', 'crypto', '2025-12-31 23:59:59', 'Price data from CoinGecko API', ARRAY['bitcoin', 'cryptocurrency', 'price prediction'], true),
('mkt_2', 'Will GPT-5 be released before the end of 2025?', 'This market will resolve to YES if OpenAI officially releases GPT-5 before January 1, 2026, 00:00 UTC. The release must be publicly announced and accessible to users.', 'tech', '2025-12-31 23:59:59', 'OpenAI official announcements', ARRAY['ai', 'openai', 'gpt', 'technology'], true),
('mkt_3', 'Will the Lakers win the NBA Championship in 2025?', 'This market will resolve to YES if the Los Angeles Lakers win the NBA Championship in the 2024-2025 season.', 'sports', '2025-06-30 23:59:59', 'NBA official results', ARRAY['basketball', 'nba', 'lakers', 'championship'], false)
ON CONFLICT (id) DO NOTHING;

-- Update user_activities table to include market_id
ALTER TABLE user_activities ADD COLUMN IF NOT EXISTS market_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_user_activities_market ON user_activities(market_id);

-- Add foreign key constraints to existing tables
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_market FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE SET NULL;

ALTER TABLE user_activities ADD CONSTRAINT fk_user_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_activities ADD CONSTRAINT fk_user_activities_market FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE SET NULL;

-- Update positions table to reference new user_positions table
DROP TABLE IF EXISTS positions;

-- Create a trigger to update market statistics when trades are created
CREATE OR REPLACE FUNCTION update_market_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE markets
  SET
    total_volume = total_volume + NEW.size,
    total_yes_volume = CASE WHEN NEW.outcome = true THEN total_yes_volume + NEW.size ELSE total_yes_volume END,
    total_no_volume = CASE WHEN NEW.outcome = false THEN total_no_volume + NEW.size ELSE total_no_volume END,
    total_trades = total_trades + 1,
    last_traded_price = NEW.price,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.market_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_market_stats
AFTER INSERT ON trades
FOR EACH ROW EXECUTE FUNCTION update_market_stats();

-- Create a trigger to update order statistics when orders are created
CREATE OR REPLACE FUNCTION update_order_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE markets
  SET
    total_orders = total_orders + 1,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.market_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_stats
AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION update_order_stats();