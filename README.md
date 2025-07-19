# Manteia: Cross-Chain Prediction Market Platform

**Manteia** is a next-generation cross-chain prediction market platform that unifies liquidity across multiple blockchain networks. Built on Mantle with Hyperlane interoperability, it enables users to trade "YES/NO" shares on cultural, political, and tech questions while maintaining native chain custody and eliminating manual bridging.

---

## Table of Contents

- [Manteia: Cross-Chain Prediction Market Platform](#manteia-cross-chain-prediction-market-platform)
	- [Table of Contents](#table-of-contents)
	- [What is Manteia?](#what-is-manteia)
		- [The Problem](#the-problem)
		- [The Solution](#the-solution)
	- [Architecture Overview](#architecture-overview)
	- [Technology Stack](#technology-stack)
		- [Smart Contracts](#smart-contracts)
		- [Backend Infrastructure](#backend-infrastructure)
		- [Frontend Architecture](#frontend-architecture)
		- [Cross-Chain Infrastructure](#cross-chain-infrastructure)
	- [Key Integrations](#key-integrations)
		- [Mantle Network](#mantle-network)
		- [Hyperlane Protocol](#hyperlane-protocol)
		- [Polymarket API](#polymarket-api)
		- [Reown (WalletConnect)](#reown-walletconnect)
		- [PostgreSQL & Neon](#postgresql--neon)
	- [Current Features](#current-features)
		- [Core Trading System](#core-trading-system)
		- [Admin Management System](#admin-management-system)
		- [Cross-Chain Bridge](#cross-chain-bridge)
		- [Real-Time Market Data](#real-time-market-data)
		- [User Portfolio Management](#user-portfolio-management)
	- [Monorepo Structure](#monorepo-structure)
	- [What's Coming Next](#whats-coming-next)
		- [Smart Account Integration (Biconomy)](#smart-account-integration-biconomy)
		- [Multi-Chain Interoperability (Li.Fi)](#multi-chain-interoperability-lifi)
		- [Liquidity Pools & Rewards](#liquidity-pools--rewards)
		- [Market Clarification System](#market-clarification-system)
		- [Advanced Order Management](#advanced-order-management)
		- [Additional Integrations](#additional-integrations)
	- [Getting Started](#getting-started)
		- [Prerequisites](#prerequisites)
		- [Installation](#installation)
		- [Environment Setup](#environment-setup)
		- [Running the Application](#running-the-application)
	- [Contributing](#contributing)
	- [License](#license)

---

## What is Manteia?

Manteia is a cross-chain prediction market platform that enables users across different blockchain networks to trade on the same events without manual bridging. Built on Mantle's high-performance L2 with Hyperlane's interchain messaging, it creates unified markets for cultural, political, and technological predictions.

### The Problem

Traditional prediction markets suffer from:
- **Chain-Siloed Liquidity**: Markets on single chains have shallow liquidity and poor price discovery
- **High Gas Costs**: L1 transactions make small predictions uneconomical
- **Manual Bridging**: Users must bridge funds manually between chains, creating friction
- **Fragmented Markets**: Same events have different markets on different chains with inconsistent pricing
- **Complex UX**: Users must manage multiple wallets and understand various chain specifics

### The Solution

Manteia solves these challenges by:
- **Unified Order Book**: All trades settle on Mantle while users trade from any supported chain
- **Hyperlane Integration**: Seamless cross-chain messaging eliminates manual bridging
- **Low-Cost Settlement**: Mantle's L2 provides 90% lower costs than Ethereum L1
- **Single UX**: Users see one interface regardless of their connected chain
- **Gasless Claims**: Winners receive payouts on their native chain without switching networks

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Manteia Platform                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Frontend      │  │     Backend     │  │  Smart Contracts │ │
│  │   (React)       │  │   (Node.js)     │  │    (Solidity)    │ │
│  │                 │  │                 │  │                  │ │
│  │  • Reown Kit    │  │  • Express API  │  │  • MarketHub     │ │
│  │  • Wagmi        │  │  • PostgreSQL   │  │  • ERC1155       │ │
│  │  • Viem         │  │  • WebSockets   │  │  • Order Book    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Cross-Chain Infrastructure                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Hyperlane     │  │  Polymarket API │  │     Mantle      │ │
│  │  Messaging      │  │  Integration    │  │   Sepolia       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Smart Contracts

- **MarketHub Contract**: [MarketHub.sol](contracts/MarketHub.sol) - Core prediction market logic with ERC1155 share tokens
- **Order Book System**: Native order matching algorithm with price discovery
- **Collateral Management**: Native MNT handling for deposits and withdrawals
- **Cross-Chain Messaging**: Hyperlane integration for interchain communication
- **Market Resolution**: Automated resolution system with dispute mechanisms

### Backend Infrastructure

- **Express.js API**: [server.js](backend/server.js) - RESTful API with comprehensive endpoints
- **PostgreSQL Database**: Enhanced schema for trading data with Neon hosting
- **Real-Time Updates**: WebSocket integration for live market data
- **Admin System**: [routes/admin.js](backend/routes/admin.js) - Complete admin management system
- **Trading Engine**: [services/tradingService.js](backend/services/tradingService.js) - Order book and position management
- **Bridge Services**: [services/bridgeManagerService.js](backend/services/bridgeManagerService.js) - Cross-chain operations

### Frontend Architecture

- **React 19**: Modern React with hooks and context
- **Reown AppKit**: [config.js](frontend/src/config.js) - Wallet connectivity and chain management
- **Wagmi & Viem**: [hooks/useContract.js](frontend/src/hooks/useContract.js) - Ethereum integration
- **React Router**: Client-side routing for SPA experience
- **Real-Time UI**: WebSocket integration for live updates
- **Responsive Design**: Mobile-first design system

### Cross-Chain Infrastructure

- **Hyperlane Protocol**: Interchain message passing for cross-chain operations
- **Native Bridge**: [services/nativeBridgeService.js](backend/services/nativeBridgeService.js) - Custom bridge implementation
- **Resolution Bot**: [scripts/resolution-bot.js](scripts/resolution-bot.js) - Automated market resolution system

---

## Key Integrations

### Mantle Network

Our primary settlement layer providing:
- **Low-Cost Transactions**: 90% reduction in gas costs compared to Ethereum L1
- **High Performance**: Fast block times with EVM compatibility
- **Ethereum Security**: Inherits L1 security through modular DA layer
- **Developer Tools**: Full Hardhat/Foundry support for smart contract development

**Integration**: [config.js](frontend/src/config.js) - Network configuration with custom RPC endpoints

### Hyperlane Protocol

Enables seamless cross-chain functionality:
- **General Message Passing**: Route orders and settlements between chains
- **Interchain Gas Paymaster**: Automated gas payment and refunds
- **Security Modules**: Configurable security with validator networks
- **Interchain Accounts**: Execute transactions on remote chains

**Integration**: Planned integration with MarketHub contract for cross-chain messaging

### Polymarket API

Market data and pricing integration:
- **Market Discovery**: Real-time market data from Polymarket's CLOB API
- **Price Feeds**: Live pricing data for accurate market pricing
- **Resolution Data**: Outcome data for automated market resolution
- **Rate Limiting**: Respectful API usage within 100 req/10s limits

**Integration**: [scripts/find-polymarket-markets.js](scripts/find-polymarket-markets.js) - Market discovery system

### Reown (WalletConnect)

Modern wallet connectivity:
- **Multi-Chain Support**: Connect to Mantle, Ethereum, Base, and more
- **Session Management**: Persistent wallet sessions across app visits
- **Network Switching**: Automated network switching for optimal UX
- **Mobile Support**: Native mobile wallet support via WalletConnect

**Integration**: [Web3Context.js](frontend/src/context/Web3Context.js) - Centralized wallet state management

### PostgreSQL & Neon

Scalable database infrastructure:
- **Enhanced Schema**: [migrations/](backend/migrations/) - Complete trading database schema
- **Real-Time Analytics**: Live trading statistics and user metrics
- **Serverless Scaling**: Neon's serverless PostgreSQL for automatic scaling
- **Performance Optimization**: Indexes and constraints for optimal query performance

**Integration**: [config/database.js](backend/config/database.js) - Database connection and query management

---

## Current Features

### Core Trading System

✅ **Real MNT Trading**
- Native MNT collateral management with smart contract escrow
- Actual token transfers for authentic trading experience
- Real-time balance tracking and validation
- **Integration**: [useContract.js](frontend/src/hooks/useContract.js)

✅ **Order Book Mechanics**
- Limit and market orders with proper validation
- Price discovery through bid-ask spread calculation
- Order matching algorithm with fee distribution
- Real-time order book updates via WebSocket
- **Integration**: [tradingService.js](backend/services/tradingService.js)

✅ **ERC1155 Share Tokens**
- YES/NO share tokens for each market
- Automated minting upon trade execution
- Proper token balance tracking and transfers
- **Integration**: [MarketHub.sol](contracts/MarketHub.sol)

### Admin Management System

✅ **Secure Authentication**
- Hardcoded admin credentials (Username: "Admin", Password: "Abdaprince124#$")
- JWT token-based session management
- Protected admin routes and middleware
- **Integration**: [middleware/adminAuth.js](backend/middleware/adminAuth.js)

✅ **Market Creation Interface**
- Comprehensive market creation form with validation
- Category management and tagging system
- Resolution criteria and source specification
- Database and smart contract integration
- **Integration**: [components/Admin/MarketCreation.js](frontend/src/components/Admin/MarketCreation.js)

✅ **System Analytics**
- Real-time trading statistics and metrics
- User activity monitoring and reporting
- Market performance analytics
- System health monitoring dashboard
- **Integration**: [components/Admin/AdminDashboard.js](frontend/src/components/Admin/AdminDashboard.js)

### Cross-Chain Bridge

🔄 **Native Bridge System**
- Custom bridge implementation for Mantle integration
- Quote calculation and fee estimation
- Transaction monitoring and status tracking
- **Integration**: [services/bridgeManagerService.js](backend/services/bridgeManagerService.js)

🔄 **Bridge UI Components**
- User-friendly bridge interface with real-time quotes
- Transaction history and status tracking
- Multi-chain balance display
- **Integration**: [components/Bridge/](frontend/src/components/Bridge/)

### Real-Time Market Data

✅ **Live Price Feeds**
- WebSocket integration for real-time price updates
- Market statistics and volume tracking
- Order book depth and spread calculation
- **Integration**: [services/backendService.js](frontend/src/services/backendService.js)

✅ **Market Discovery**
- Integration with Polymarket API for market data
- Automated market data synchronization
- Category-based market filtering
- **Integration**: [scripts/find-polymarket-markets.js](scripts/find-polymarket-markets.js)

### User Portfolio Management

✅ **Position Tracking**
- Real-time position updates and P&L calculation
- Cross-chain portfolio aggregation
- Transaction history and receipt generation
- **Integration**: [services/userProfileService.js](backend/services/userProfileService.js)

✅ **Profile Management**
- Comprehensive user profile system
- Activity tracking and statistics
- Settings and preferences management
- **Integration**: [components/Profile/](frontend/src/components/Profile/)

---

## Monorepo Structure

- **/backend/**: Node.js API server, database models, and business logic
  - **/routes/**: RESTful API endpoints for [admin](backend/routes/admin.js), [trading](backend/routes/trading.js), [bridge](backend/routes/bridge.js)
  - **/services/**: Business logic for [trading](backend/services/tradingService.js), [bridges](backend/services/bridgeManagerService.js), [profiles](backend/services/userProfileService.js)
  - **/config/**: Database and Redis configuration
  - **/middleware/**: Authentication and validation middleware
  - **/migrations/**: Database schema and migration scripts

- **/frontend/**: React application with modern Web3 integration
  - **/src/components/**: Reusable UI components including [Admin](frontend/src/components/Admin/), [Bridge](frontend/src/components/Bridge/), [Profile](frontend/src/components/Profile/)
  - **/src/pages/**: Main application pages including [Markets](frontend/src/pages/Markets.js), [MarketDetail](frontend/src/pages/MarketDetail.js)
  - **/src/services/**: API integration services for [trading](frontend/src/services/tradingService.js), [admin](frontend/src/services/adminService.js), [bridge](frontend/src/services/bridgeService.js)
  - **/src/hooks/**: Custom React hooks including [useContract](frontend/src/hooks/useContract.js)

- **/contracts/**: Solidity smart contracts and deployment scripts
  - **[MarketHub.sol](contracts/MarketHub.sol)**: Core prediction market contract
  - **[MarketSpoke.sol](contracts/MarketSpoke.sol)**: Cross-chain spoke contracts

- **/scripts/**: Automation and deployment utilities
  - **[deploy-markets.js](scripts/deploy-markets.js)**: Contract deployment script
  - **[resolution-bot.js](scripts/resolution-bot.js)**: Automated market resolution
  - **[find-polymarket-markets.js](scripts/find-polymarket-markets.js)**: Market discovery automation

---

## What's Coming Next

### Smart Account Integration (Biconomy)

**Status**: 🔄 Planned Implementation

Biconomy Smart Accounts will revolutionize the user experience by:

- **Gasless Transactions**: Users can trade without holding native tokens for gas
- **Social Login**: Email/social media login without complex seed phrases
- **Session Keys**: Automated trading with user-defined spending limits
- **Multi-Chain Abstraction**: Single account across all supported chains

**Technical Implementation**:
- **Account Creation**: Biconomy Smart Account factory for deterministic addresses
- **Paymaster Integration**: Sponsored transactions for new user onboarding
- **Session Management**: Time-limited trading sessions with spending caps
- **Multi-Signer Support**: Enhanced security with multiple authentication methods

**Integration Points**:
- Frontend wallet connection via Biconomy SDK
- Backend session validation and paymaster management
- Smart contract integration for sponsored transactions
- Cross-chain account synchronization

**References**:
- [Biconomy Smart Accounts Documentation](https://docs-devx.biconomy.io/smartAccountsV2/account)
- [Account Integration Guide](https://docs-devx.biconomy.io/smartAccountsV2/account/integration)
- [Paymaster Integration](https://docs-devx.biconomy.io/smartAccountsV2/paymaster)

### Multi-Chain Interoperability (Li.Fi)

**Status**: 🔄 Planned Implementation

Li.Fi integration will enable seamless cross-chain liquidity:

- **Universal Bridge Aggregation**: Access to 20+ bridges and DEXs
- **Optimal Routing**: Best prices and fastest execution across chains
- **Token Swapping**: Direct token swaps during cross-chain transfers
- **Multi-Step Transactions**: Complex multi-chain operations in single transaction

**Technical Architecture**:
- **Route Discovery**: Li.Fi API for optimal cross-chain paths
- **Quote Comparison**: Real-time comparison of bridge costs and times
- **Transaction Execution**: Automated multi-step transaction handling
- **Status Tracking**: Real-time cross-chain transaction monitoring

**New Supported Networks**:
- Ethereum Mainnet & L2s (Arbitrum, Optimism, Base)
- Polygon & Polygon zkEVM
- Avalanche & Avalanche Subnets
- BNB Chain & BSC

**Integration Implementation**:
- [Li.Fi SDK Integration](https://docs.li.fi/sdk/overview) for frontend routing
- Backend Li.Fi API integration for quote aggregation
- Smart contract integration for multi-chain settlements
- User interface for cross-chain transaction management

**References**:
- [Li.Fi Route API](https://docs.li.fi/api-reference/get-a-quote-for-a-token-transfer)
- [Cross-Chain Status Tracking](https://docs.li.fi/api-reference/check-the-status-of-a-cross-chain-transfer)
- [Multi-Contract Calls](https://docs.li.fi/api-reference/perform-multiple-contract-calls-across-blockchains-beta)

### Liquidity Pools & Rewards

**Status**: 🔄 Design Phase

Inspired by Polymarket's liquidity rewards system:

- **Automated Market Making**: Algorithmic liquidity provision for consistent trading
- **Liquidity Mining**: Rewards for users providing market liquidity
- **Volume-Based Incentives**: Trading fee rebates for high-volume traders
- **Cross-Chain Liquidity**: Unified liquidity pools across all supported chains

**Reward Mechanisms**:
- **LP Token Rewards**: Liquidity providers earn fees + platform tokens
- **Trading Rebates**: Fee reductions based on 30-day trading volume
- **Market Creation Incentives**: Rewards for creating successful markets
- **Resolution Bonding**: Earn fees for accurate market resolution

**Technical Features**:
- Constant Product AMM for price discovery
- Dynamic fee structures based on market volatility
- Cross-chain yield farming opportunities
- Automated rebalancing and position management

### Market Clarification System

**Status**: 🔄 Research Phase

Following Polymarket's clarification process:

- **Dispute Mechanisms**: UMA-style optimistic oracle for outcome disputes
- **Clarification Proposals**: Community-driven market rule clarifications
- **Resolution Committees**: Expert panels for complex market outcomes
- **Appeal Processes**: Multi-tier dispute resolution system

**Implementation Features**:
- **2-Hour Challenge Window**: Standard dispute period for market outcomes
- **Bond Requirements**: Economic incentives for accurate dispute resolution
- **Community Voting**: Token-weighted governance for clarification decisions
- **Expert Arbitration**: Professional resolution for complex technical markets

### Advanced Order Management

**Status**: 🔄 Development Planning

Enhanced trading capabilities:

- **Advanced Order Types**: Stop-loss, take-profit, iceberg orders
- **Portfolio Management**: Cross-market position hedging and optimization
- **Automated Trading**: Bot integration and API access for algorithmic trading
- **Risk Management**: Position limits and margin requirements

**Order Book Enhancements**:
- **Conditional Orders**: Execute based on external conditions
- **Time-Weighted Orders**: TWAP/VWAP execution strategies
- **Cross-Market Arbitrage**: Automated arbitrage between related markets
- **Limit Order Optimization**: Best execution across multiple markets

### Additional Integrations

**Chainlink Price Oracles**: Real-time price feeds for accurate USD conversions
**The Graph Protocol**: Decentralized indexing for historical trading data
**IPFS Integration**: Decentralized storage for market metadata and documents
**ENS Integration**: Human-readable addresses for improved UX
**Layer Zero**: Additional cross-chain messaging for network expansion

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL (or Neon account)
- MetaMask or compatible Web3 wallet
- Mantle Sepolia testnet MNT tokens

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/Abraham12611/manteia
cd manteia
```

2. **Install root dependencies**:
```bash
npm install
```

3. **Install backend dependencies**:
```bash
cd backend
npm install
```

4. **Install frontend dependencies**:
```bash
cd ../frontend
npm install
```

### Environment Setup

1. **Backend Environment**:
Create `backend/.env` with:
```env
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
```

2. **Frontend Environment**:
Create `frontend/.env` with:
```env
REACT_APP_REOWN_PROJECT_ID=your_reown_project_id
REACT_APP_MARKET_HUB_ADDRESS=deployed_contract_address
REACT_APP_BACKEND_URL=http://localhost:3001
```

### Running the Application

1. **Start the backend**:
```bash
cd backend
npm run dev
```

2. **Start the frontend**:
```bash
cd frontend
npm start
```

3. **Deploy contracts** (optional):
```bash
npm run deploy
```

The application will be available at `http://localhost:3000`

---

## Contributing

We welcome contributions! Please see our contributing guidelines and submit pull requests for any improvements.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Manteia** is built for the future of prediction markets - cross-chain, low-cost, and user-friendly. Join us in creating the next generation of decentralized prediction platforms!