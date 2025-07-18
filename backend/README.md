# Manteia Transaction Tracking System - Backend

## Overview

The Manteia Backend is a comprehensive transaction tracking system designed for the cross-chain prediction market platform. It provides real-time transaction monitoring, receipt generation, and user management capabilities across multiple blockchain networks, with a focus on Mantle Sepolia integration.

## Features

### Core Functionality
- **Real-time Transaction Monitoring**: Monitors blockchain transactions in real-time
- **Receipt Generation**: Creates detailed receipts for all transaction types
- **User Management**: Handles user accounts and profiles
- **Cross-chain Support**: Designed for multi-chain operations
- **Blockchain Verification**: Verifies transactions on-chain
- **Health Monitoring**: Comprehensive system health checks

### Technical Features
- **RESTful API**: Clean, well-documented REST endpoints
- **Socket.IO Integration**: Real-time updates via WebSocket
- **PostgreSQL Database**: Robust data persistence with NeonDB
- **Comprehensive Logging**: Winston-based logging system
- **Security**: Helmet.js, CORS, rate limiting, input validation
- **Error Handling**: Graceful error handling with detailed responses

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Manteia Backend                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Express.js    │  │   Socket.IO     │  │   Cron Jobs     │ │
│  │   REST API      │  │   Real-time     │  │   Scheduled     │ │
│  │                 │  │   Updates       │  │   Tasks         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Transaction    │  │   Receipt       │  │   Database      │ │
│  │  Monitor        │  │   Service       │  │   Service       │ │
│  │  Service        │  │                 │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                NeonDB PostgreSQL                        │ │
│  │         (Users, Transactions, Receipts, etc.)          │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Mantle Sepolia Blockchain                  │ │
│  │            (Real-time Monitoring)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
backend/
├── config/
│   ├── database.js          # Database configuration and connection
│   └── env.example          # Environment variables template
├── routes/
│   ├── health.js            # Health check endpoints
│   ├── users.js             # User management endpoints
│   ├── transactions.js      # Transaction management endpoints
│   └── receipts.js          # Receipt management endpoints
├── services/
│   ├── transactionMonitorService.js  # Real-time blockchain monitoring
│   └── receiptService.js    # Receipt generation and management
├── utils/
│   └── logger.js            # Winston logging configuration
├── tests/
│   ├── api.test.js          # Basic API tests
│   ├── basic.test.js        # Comprehensive functionality tests
│   └── setup.js             # Test setup configuration
├── package.json             # Dependencies and scripts
├── jest.config.js           # Jest test configuration
└── server.js                # Main server file
```

## Installation & Setup

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL database (NeonDB recommended)
- NPM or Yarn package manager

### Environment Configuration

Create a `.env` file in the backend directory with the following variables:

```bash
# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration (NeonDB)
DB_HOST=your-neon-hostname
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
DB_SSL=true

# Blockchain Configuration
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_SEPOLIA_CHAIN_ID=5003

# Security
JWT_SECRET=your-secure-jwt-secret
BCRYPT_ROUNDS=12

# External Services
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Logging
LOG_LEVEL=info

# Features
TRANSACTION_MONITOR_ENABLED=true
RECEIPT_GENERATION_ENABLED=true
```

### Installation Steps

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp config/env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup**:
   The system uses NeonDB (PostgreSQL). Ensure your database has the required tables:
   - users
   - transactions
   - receipts
   - user_balances
   - market_positions
   - trading_orders
   - cross_chain_bridges

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Start the server**:
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## API Documentation

### Base URL
- **Development**: `http://localhost:3001/api`
- **Production**: Configure via `REACT_APP_BACKEND_URL`

### Authentication
Most endpoints require authentication. Include JWT token in headers:
```
Authorization: Bearer <your-jwt-token>
```

### API Endpoints

#### Health Endpoints

##### GET `/health`
Basic health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "service": "manteia-backend"
}
```

##### GET `/health/detailed`
Detailed health check with service status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": {
      "status": "connected",
      "responseTime": 45
    },
    "blockchain": {
      "status": "connected",
      "chain": "mantle-sepolia",
      "latestBlock": 1234567,
      "blockTime": 2000
    },
    "transactionMonitor": {
      "status": "running",
      "lastProcessedBlock": 1234565,
      "pendingTransactions": 5
    }
  }
}
```

#### User Management

##### POST `/api/users`
Create a new user.

**Request Body:**
```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c",
  "email": "user@example.com",
  "username": "username"
}
```

**Response:**
```json
{
  "id": "user-uuid",
  "wallet_address": "0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c",
  "email": "user@example.com",
  "username": "username",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

##### GET `/api/users/:id`
Get user by ID.

##### GET `/api/users/wallet/:address`
Get user by wallet address.

##### PUT `/api/users/:id`
Update user information.

##### GET `/api/users/:id/stats`
Get user statistics.

#### Transaction Management

##### POST `/api/transactions`
Create a new transaction record.

**Request Body:**
```json
{
  "hash": "0x123456789abcdef...",
  "type": "trade",
  "user_id": "user-uuid",
  "amount": "100.50",
  "chain_id": 5003,
  "block_number": 1234567,
  "gas_used": "21000",
  "gas_price": "20000000000",
  "from_address": "0x742d35Cc6634C0532925a3b8D41d3C97C2C7b92c",
  "to_address": "0x851d35Cc6634C0532925a3b8D41d3C97C2C7b92c",
  "contract_address": "0x951d35Cc6634C0532925a3b8D41d3C97C2C7b92c",
  "receipt_data": {}
}
```

**Response:**
```json
{
  "id": "transaction-uuid",
  "hash": "0x123456789abcdef...",
  "type": "trade",
  "status": "pending",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

##### GET `/api/transactions/:id`
Get transaction by ID.

##### GET `/api/transactions`
Get transactions with optional filters.

**Query Parameters:**
- `user_id`: Filter by user ID
- `type`: Filter by transaction type
- `status`: Filter by status
- `chain_id`: Filter by chain ID
- `limit`: Limit results (default: 50)
- `offset`: Offset for pagination

##### PUT `/api/transactions/:id/status`
Update transaction status.

##### POST `/api/transactions/:id/retry`
Retry failed transaction.

##### GET `/api/transactions/stats`
Get transaction statistics.

#### Receipt Management

##### POST `/api/receipts`
Generate a new receipt.

**Request Body:**
```json
{
  "transaction_hash": "0x123456789abcdef...",
  "user_id": "user-uuid",
  "type": "trade",
  "amount": "100.50",
  "chain_id": 5003
}
```

##### GET `/api/receipts/:id`
Get receipt by ID.

##### GET `/api/receipts/transaction/:hash`
Get receipt by transaction hash.

##### GET `/api/receipts/:id/pdf`
Download receipt as PDF.

##### GET `/api/receipts/:id/verify`
Verify receipt authenticity.

##### POST `/api/receipts/:id/regenerate`
Regenerate receipt.

## Services

### Transaction Monitor Service

The Transaction Monitor Service provides real-time blockchain monitoring capabilities:

#### Features
- **Real-time Monitoring**: Continuously monitors new blocks
- **Transaction Tracking**: Tracks pending transactions
- **Automatic Retries**: Handles temporary network issues
- **Health Monitoring**: Provides service health status
- **Configurable Intervals**: Adjustable polling intervals

#### Configuration
```javascript
const monitorService = require('./services/transactionMonitorService');

// Start monitoring
await monitorService.start();

// Check status
const status = monitorService.getStatus();

// Stop monitoring
await monitorService.stop();
```

### Receipt Service

The Receipt Service handles receipt generation and management:

#### Features
- **PDF Generation**: Creates professional PDF receipts
- **Blockchain Verification**: Verifies transaction details on-chain
- **Multiple Formats**: Supports various receipt formats
- **Batch Processing**: Handles bulk receipt generation

#### Usage
```javascript
const receiptService = require('./services/receiptService');

// Generate receipt
const receipt = await receiptService.generateReceipt({
  transactionHash: '0x123...',
  userId: 'user-uuid',
  type: 'trade',
  amount: '100.50'
});

// Verify receipt
const isValid = await receiptService.verifyReceipt(receipt.id);
```

## Database Schema

### Users Table
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
```

### Transactions Table
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
```

### Additional Tables
- `user_balances`: Multi-chain token balances
- `market_positions`: Trading positions
- `trading_orders`: Order history
- `cross_chain_bridges`: Bridge operations

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Structure
- **Unit Tests**: Individual component testing
- **Integration Tests**: API endpoint testing
- **Service Tests**: Business logic testing
- **Database Tests**: Data persistence testing

### Test Configuration
Tests use Jest with supertest for API testing. Configuration in `jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'config/**/*.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
```

## Deployment

### Production Deployment

1. **Environment Setup**:
   ```bash
   NODE_ENV=production
   PORT=3001
   # Configure all environment variables
   ```

2. **Database Migration**:
   ```bash
   npm run migrate
   ```

3. **Start Production Server**:
   ```bash
   npm start
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

### Health Checks
The system provides comprehensive health checks at `/health` and `/health/detailed` endpoints for monitoring and load balancer integration.

## Security Considerations

### Implemented Security Measures
- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **Input Validation**: Joi validation
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt for password security

### Additional Recommendations
- Use HTTPS in production
- Implement API key authentication
- Set up monitoring and alerting
- Regular security audits
- Database encryption at rest
- Implement proper logging and monitoring

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
Error: connect ECONNREFUSED
```
**Solution**: Check database configuration and network connectivity.

#### Transaction Monitor Not Starting
```bash
Error: transactionMonitorService.initialize is not a function
```
**Solution**: Ensure proper service initialization and configuration.

#### Memory Issues
```bash
Error: JavaScript heap out of memory
```
**Solution**: Increase Node.js memory limit or optimize queries.

### Debugging
Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit pull request

### Code Style
- Use ESLint configuration
- Follow Node.js best practices
- Write comprehensive tests
- Update documentation

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section

## Changelog

### Version 1.0.0
- Initial release
- Core transaction tracking
- Receipt generation
- User management
- Real-time monitoring
- Comprehensive API
- Full test coverage