-- Migration: Create users table and related tables for profile system
-- Created: 2025-01-18

-- Create users table first (no dependencies)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  username VARCHAR(50),
  email VARCHAR(255),
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_volume DECIMAL(20,8) DEFAULT 0,
  total_profit_loss DECIMAL(20,8) DEFAULT 0,
  total_positions INTEGER DEFAULT 0,
  total_markets_traded INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  reputation_score INTEGER DEFAULT 0,
  preferences JSONB DEFAULT '{}'
);

-- Create transactions table (without foreign key for now)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  transaction_hash VARCHAR(66) UNIQUE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  amount DECIMAL(20,8),
  status VARCHAR(20) DEFAULT 'pending',
  block_number INTEGER,
  gas_used BIGINT,
  gas_price BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transaction_receipts table (without foreign key for now)
CREATE TABLE IF NOT EXISTS transaction_receipts (
  id SERIAL PRIMARY KEY,
  transaction_hash VARCHAR(66) UNIQUE NOT NULL,
  user_id INTEGER,
  receipt_data JSONB,
  pdf_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cross_chain_bridges table (without foreign key for now)
CREATE TABLE IF NOT EXISTS cross_chain_bridges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  source_chain_id INTEGER NOT NULL,
  destination_chain_id INTEGER NOT NULL,
  source_token_address VARCHAR(42),
  destination_token_address VARCHAR(42),
  source_amount DECIMAL(20,8) NOT NULL,
  destination_amount DECIMAL(20,8),
  bridge_provider VARCHAR(50) NOT NULL,
  bridge_status VARCHAR(20) DEFAULT 'initiated',
  source_transaction_hash VARCHAR(66),
  destination_transaction_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  bridge_data JSONB DEFAULT '{}'
);

-- Create positions table (without foreign key for now)
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  market_id VARCHAR(255) NOT NULL,
  outcome VARCHAR(10) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  price DECIMAL(10,8) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_activities table (without foreign key for now)
CREATE TABLE IF NOT EXISTS user_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  activity_type VARCHAR(50) NOT NULL,
  description TEXT,
  amount DECIMAL(20,8),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market_id ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bridges_user_id ON cross_chain_bridges(user_id);
CREATE INDEX IF NOT EXISTS idx_bridges_status ON cross_chain_bridges(bridge_status);

-- Insert a sample user for testing (if not exists)
INSERT INTO users (wallet_address, username, bio, reputation_score, is_verified)
VALUES ('0x733b34e60D3eEa70609364968566f13405802062', 'Test User', 'Welcome to Manteia!', 100, true)
ON CONFLICT (wallet_address) DO NOTHING;