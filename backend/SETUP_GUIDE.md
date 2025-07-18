# Manteia Backend - Quick Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL database (NeonDB recommended)
- Git

## Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd manteia/backend
npm install
```

### 2. Environment Setup
Create `.env` file:
```bash
cp config/env.example .env
```

Edit `.env` with your configuration:
```env
NODE_ENV=development
PORT=3001

# Database (NeonDB)
DB_HOST=your-neon-hostname
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
DB_SSL=true

# Blockchain
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_SEPOLIA_CHAIN_ID=5003

# Security
JWT_SECRET=your-secure-jwt-secret-minimum-32-chars
```

### 3. Database Setup
Ensure your NeonDB has these tables:
- `users`
- `transactions`
- `receipts`
- `user_balances`
- `market_positions`
- `trading_orders`
- `cross_chain_bridges`

### 4. Test & Start
```bash
# Run tests
npm test

# Start development server
npm run dev

# Start production server
npm start
```

## Verification

### Health Check
```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 10,
  "service": "manteia-backend"
}
```

### API Test
```bash
# Create test user
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c",
    "email": "test@example.com",
    "username": "testuser"
  }'
```

## Database Tables (NeonDB)

### Required Tables Schema

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  smart_account_address VARCHAR(42),
  email VARCHAR(255),
  username VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID REFERENCES users(id)
);

CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

#### Transactions Table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash VARCHAR(66) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  amount DECIMAL(36, 18),
  chain_id INTEGER NOT NULL,
  block_number BIGINT,
  block_hash VARCHAR(66),
  transaction_index INTEGER,
  gas_used BIGINT,
  gas_price BIGINT,
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  contract_address VARCHAR(42),
  status VARCHAR(20) DEFAULT 'pending',
  confirmation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  receipt_data JSONB
);

CREATE INDEX idx_transactions_hash ON transactions(hash);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_chain_id ON transactions(chain_id);
CREATE INDEX idx_transactions_type ON transactions(type);
```

#### User Balances Table
```sql
CREATE TABLE user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  token_address VARCHAR(42),
  token_symbol VARCHAR(10),
  token_decimals INTEGER DEFAULT 18,
  balance DECIMAL(36, 18) DEFAULT 0,
  chain_id INTEGER NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_user_balances_user_id ON user_balances(user_id);
CREATE INDEX idx_user_balances_chain_id ON user_balances(chain_id);
CREATE UNIQUE INDEX idx_user_balances_unique ON user_balances(user_id, token_address, chain_id);
```

#### Market Positions Table
```sql
CREATE TABLE market_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  market_id VARCHAR(100) NOT NULL,
  outcome VARCHAR(50),
  shares DECIMAL(36, 18) DEFAULT 0,
  avg_price DECIMAL(36, 18),
  current_value DECIMAL(36, 18),
  unrealized_pnl DECIMAL(36, 18),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_market_positions_user_id ON market_positions(user_id);
CREATE INDEX idx_market_positions_market_id ON market_positions(market_id);
CREATE UNIQUE INDEX idx_market_positions_unique ON market_positions(user_id, market_id, outcome);
```

#### Trading Orders Table
```sql
CREATE TABLE trading_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  market_id VARCHAR(100) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL,
  outcome VARCHAR(50),
  shares DECIMAL(36, 18),
  price DECIMAL(36, 18),
  filled_shares DECIMAL(36, 18) DEFAULT 0,
  remaining_shares DECIMAL(36, 18),
  status VARCHAR(20) DEFAULT 'open',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP,
  filled_at TIMESTAMP
);

CREATE INDEX idx_trading_orders_user_id ON trading_orders(user_id);
CREATE INDEX idx_trading_orders_market_id ON trading_orders(market_id);
CREATE INDEX idx_trading_orders_status ON trading_orders(status);
```

#### Cross Chain Bridges Table
```sql
CREATE TABLE cross_chain_bridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  source_chain_id INTEGER NOT NULL,
  destination_chain_id INTEGER NOT NULL,
  source_tx_hash VARCHAR(66),
  destination_tx_hash VARCHAR(66),
  token_address VARCHAR(42),
  amount DECIMAL(36, 18),
  bridge_provider VARCHAR(50),
  status VARCHAR(20) DEFAULT 'initiated',
  fee_amount DECIMAL(36, 18),
  estimated_time INTEGER,
  actual_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_cross_chain_bridges_user_id ON cross_chain_bridges(user_id);
CREATE INDEX idx_cross_chain_bridges_source_tx ON cross_chain_bridges(source_tx_hash);
CREATE INDEX idx_cross_chain_bridges_status ON cross_chain_bridges(status);
```

#### Smart Account Operations Table
```sql
CREATE TABLE smart_account_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  smart_account_address VARCHAR(42),
  operation_type VARCHAR(50) NOT NULL,
  transaction_hash VARCHAR(66),
  chain_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  gas_used BIGINT,
  gas_price BIGINT,
  operation_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_smart_account_operations_user_id ON smart_account_operations(user_id);
CREATE INDEX idx_smart_account_operations_address ON smart_account_operations(smart_account_address);
CREATE INDEX idx_smart_account_operations_status ON smart_account_operations(status);
```

## Configuration Options

### Environment Variables
```env
# Server
NODE_ENV=development|production
PORT=3001

# Database
DB_HOST=your-neon-hostname
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
DB_SSL=true

# Blockchain
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_SEPOLIA_CHAIN_ID=5003

# Security
JWT_SECRET=your-secure-jwt-secret-minimum-32-chars
BCRYPT_ROUNDS=12

# External Services
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Logging
LOG_LEVEL=debug|info|warn|error

# Features
TRANSACTION_MONITOR_ENABLED=true
RECEIPT_GENERATION_ENABLED=true
```

## Troubleshooting

### Common Issues

#### Database Connection Error
```
Error: connect ECONNREFUSED
```
**Solution:** Check database credentials and network connectivity.

#### Missing Environment Variables
```
Error: Missing required environment variable
```
**Solution:** Ensure all required variables are set in `.env`.

#### Port Already in Use
```
Error: listen EADDRINUSE :::3001
```
**Solution:** Change PORT in `.env` or kill process using port 3001.

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

### Health Check Endpoints
- Basic: `GET /health`
- Detailed: `GET /health/detailed`

## Production Deployment

### PM2 Process Manager
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name api.manteia.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Monitoring

### Health Checks
```bash
# Basic health
curl http://localhost:3001/health

# Detailed health
curl http://localhost:3001/health/detailed
```

### Log Monitoring
```bash
# View logs
tail -f logs/app.log

# PM2 logs
pm2 logs
```

## Support

For issues and support:
1. Check logs: `tail -f logs/app.log`
2. Verify database connection: `curl http://localhost:3001/health/detailed`
3. Check environment variables: Ensure all required vars are set
4. Review troubleshooting section above

## Next Steps

After successful setup:
1. Test all API endpoints
2. Set up monitoring and alerting
3. Configure SSL/TLS for production
4. Set up backup and recovery procedures
5. Review security best practices