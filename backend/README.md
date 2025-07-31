# Manteia Backend

Cross-chain DEX aggregator backend implementing 1inch Fusion+ for atomic swaps between Ethereum and Sui networks.

## Overview

Manteia Backend is the core infrastructure for the Manteia cross-chain DEX aggregator, providing:

- **Cross-chain atomic swaps** using 1inch Fusion+ protocol
- **Sui blockchain integration** with custom Move smart contracts
- **Advanced trading strategies** including TWAP, Options, and Limit Orders
- **Real-time WebSocket API** for order and swap monitoring
- **Automated resolver bot** for executing cross-chain swaps

## Features

### 🔄 Cross-Chain Swaps
- Ethereum ↔ Sui atomic swaps using hashlock/timelock mechanisms
- Integration with 1inch Fusion+ for cross-chain infrastructure
- Support for multiple EVM chains (Ethereum, Polygon, Arbitrum, etc.)

### 📊 Advanced Trading
- **TWAP Orders**: Time-Weighted Average Price execution
- **Options Trading**: Conditional orders with price triggers
- **Limit Orders**: Advanced order book functionality
- **Cetus DEX Integration**: Native Sui DEX for liquidity

### 🤖 Automated Resolution
- Automated resolver bot for cross-chain swap execution
- Real-time monitoring of escrow contracts
- Intelligent profit calculation and risk management

### 🔌 REST API
- Comprehensive API for quotes, swaps, and order management
- WebSocket connections for real-time updates
- Rate limiting and security middleware

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Blockchain    │
│                 │    │                 │    │                 │
│  ┌─────────────┐│    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│  │   React     ││────▶│ │    API      │ │    │ │  1inch      │ │
│  │   Next.js   ││    │ │  Express.js │ │────▶│ │  Fusion+    │ │
│  │             ││    │ │             │ │    │ │             │ │
│  └─────────────┘│    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│  ┌─────────────┐│    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│  │  WebSocket  ││◀───┤ │ WebSocket   │ │    │ │     Sui     │ │
│  │   Client    ││    │ │   Server    │ │────▶│ │   Network   │ │
│  │             ││    │ │             │ │    │ │             │ │
│  └─────────────┘│    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────┐
                       │ Resolver    │
                       │    Bot      │
                       │             │
                       └─────────────┘
```

## Prerequisites

- Node.js >= 18.0.0
- Sui CLI installed and configured
- 1inch API key from [1inch Developer Portal](https://portal.1inch.dev)
- Ethereum RPC endpoint (Alchemy, Infura, etc.)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd manteia/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.template .env
   # Edit .env with your configuration
   ```

4. **Deploy Sui contracts** (if not already deployed)
   ```bash
   cd ../contracts/sui
   sui move build
   sui client publish --gas-budget 20000000
   # Save the package ID for .env configuration
   ```

## Configuration

### Environment Variables

Create a `.env` file based on `env.template`:

```bash
# Core Configuration
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

# 1inch API
ONEINCH_API_KEY=your_1inch_api_key_here
ONEINCH_API_BASE_URL=https://api.1inch.dev

# Sui Configuration
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_PRIVATE_KEY=your_sui_private_key_base64_here
SUI_PACKAGE_ID=your_deployed_package_id_here

# Ethereum Configuration
ETH_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your_key_here
RESOLVER_PRIVATE_KEY=your_ethereum_private_key_here

# Resolver Bot
RESOLVER_BOT_ENABLED=true
RESOLVER_SUI_PRIVATE_KEY_BASE64=your_resolver_sui_private_key_base64
```

### Getting API Keys

1. **1inch API Key**: Register at [1inch Developer Portal](https://portal.1inch.dev)
2. **Ethereum RPC**: Get from [Alchemy](https://alchemy.com) or [Infura](https://infura.io)
3. **Sui Keys**: Generate using `sui keytool generate ed25519`

## Usage

### Development

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run linting
npm run lint

# Run tests
npm test
```

### API Endpoints

#### Health Check
```bash
GET /api/v1/health
GET /api/v1/health/detailed
```

#### Cross-Chain Swaps
```bash
# Get quote
POST /api/v1/swap/quote
{
  "fromTokenAddress": "0x...",
  "toTokenAddress": "0x...",
  "amount": "1000000",
  "fromChain": "ethereum",
  "toChain": "sui",
  "slippage": 1
}

# Execute swap
POST /api/v1/swap/execute
{
  "fromTokenAddress": "0x...",
  "toTokenAddress": "0x...",
  "amount": "1000000",
  "fromChain": "ethereum",
  "toChain": "sui",
  "userAddress": "0x...",
  "slippage": 1
}

# Check swap status
GET /api/v1/swap/status/:transactionId
```

#### Advanced Orders
```bash
# Create limit order
POST /api/v1/orders/limit

# Create TWAP order
POST /api/v1/orders/twap

# Create options order
POST /api/v1/orders/options

# Get order status
GET /api/v1/orders/:orderId/status
```

#### Resolver Management
```bash
# Get resolver status
GET /api/v1/resolver/status

# Register as resolver
POST /api/v1/resolver/register

# Start/stop resolver bot
POST /api/v1/resolver/control/start
POST /api/v1/resolver/control/stop
```

### WebSocket API

Connect to `ws://localhost:3001/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['order_created', 'order_filled', 'escrow_created']
}));

// Handle incoming events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## Smart Contract Integration

### Sui Move Contracts

The backend integrates with custom Move contracts on Sui:

- **Escrow Contract**: Implements HTLC for atomic swaps
- **Resolver Registry**: Manages resolver registration and stats
- **Batch Escrow**: Supports partial fills for large orders

### Contract Deployment

```bash
cd contracts/sui
sui move build
sui client publish --gas-budget 20000000

# Update .env with the published package ID
export SUI_PACKAGE_ID=0x...
```

## Resolver Bot

The automated resolver bot monitors both chains for swap opportunities:

### Features
- **Automatic Order Monitoring**: Watches for new cross-chain orders
- **Profitability Analysis**: Calculates potential profit before execution
- **Risk Management**: Implements slippage protection and timeouts
- **Multi-chain Support**: Handles Ethereum and Sui simultaneously

### Configuration

```javascript
// Resolver bot settings in .env
RESOLVER_BOT_ENABLED=true
MIN_PROFIT_MARGIN=0.005  // 0.5%
MAX_SLIPPAGE=0.01        // 1%
TIMEOUT_MINUTES=30
MAX_CONCURRENT_SWAPS=10
```

## Monitoring & Logging

### Structured Logging
- **Winston** for structured JSON logging
- **Log levels**: error, warn, info, debug
- **Request tracking** with unique IDs

### Health Checks
- **Basic health**: `/api/v1/health`
- **Detailed health**: `/api/v1/health/detailed`
- **Metrics**: `/api/v1/health/metrics`

### Performance Metrics
- Request/response times
- Error rates
- Resolver bot performance
- WebSocket connection counts

## Security

### Rate Limiting
- **General API**: 100 requests/minute
- **Swap operations**: 10 requests/minute
- **Quote requests**: 50 requests/minute

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Request sanitization

### Private Key Management
- Environment-based key storage
- Secure key derivation for Sui
- Separate keys for different functions

## Deployment

### Docker Deployment
```bash
# Build image
docker build -t manteia-backend .

# Run container
docker run -p 3001:3001 --env-file .env manteia-backend
```

### Production Considerations

1. **Environment Variables**
   - Use secure key management (AWS KMS, HashiCorp Vault)
   - Separate keys for different environments

2. **Scaling**
   - Horizontal scaling with load balancer
   - Redis for shared rate limiting
   - Database for persistent order tracking

3. **Monitoring**
   - Application monitoring (DataDog, New Relic)
   - Infrastructure monitoring (Prometheus)
   - Error tracking (Sentry)

## Development

### Project Structure
```
backend/
├── src/
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Core business logic
│   └── index.js        # Application entry point
├── package.json
├── env.template        # Environment configuration template
└── README.md
```

### Adding New Features

1. **New API Endpoints**: Add routes in `src/routes/`
2. **Business Logic**: Implement in `src/services/`
3. **Middleware**: Add to `src/middleware/`
4. **Validation**: Use Joi schemas for request validation

### Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

## Troubleshooting

### Common Issues

1. **Sui RPC Connection**
   ```
   Error: Failed to connect to Sui RPC
   Solution: Check SUI_RPC_URL and network connectivity
   ```

2. **1inch API Rate Limits**
   ```
   Error: 429 Too Many Requests
   Solution: Check API key limits and implement backoff
   ```

3. **Private Key Format**
   ```
   Error: Invalid private key format
   Solution: Ensure Sui keys are base64 encoded
   ```

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## License

[MIT License](LICENSE)

## Support

- **Documentation**: [Manteia Docs](https://docs.manteia.finance)
- **Discord**: [Community Discord](https://discord.gg/manteia)
- **Issues**: [GitHub Issues](https://github.com/manteia/manteia/issues)

---

Built with ❤️ for the cross-chain future