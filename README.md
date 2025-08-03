# Manteia – Advanced 1inch Protocol Integration Platform
*A comprehensive DeFi trading platform that extends 1inch Protocol capabilities with advanced limit order strategies and cross-chain functionality.*

## Table of Contents

* [Overview](#overview)
* [1inch Protocol Integration](#1inch-protocol-integration)
* [Expand Limit Order Protocol](#expand-limit-order-protocol)
* [Build a Full Application using 1inch APIs](#build-a-full-application-using-1inch-apis)
* [Smart Contract Architecture](#smart-contract-architecture)
* [User Workflows](#user-workflows)

## Overview

Manteia is a **comprehensive DeFi trading platform** that demonstrates the full power of 1inch Protocol integration. We've built more than just a swap interface – we've created a sophisticated trading strategy engine that extends 1inch's capabilities with advanced limit order protocols, cross-chain functionality, and real-time market intelligence.

Our platform transforms the 1inch Protocol into a powerful trading engine that professional traders would use, while remaining accessible to everyday users. We've implemented custom predicate-based strategies, real-time monitoring systems, and comprehensive API integration across all major 1inch services.

## 1inch Protocol Integration

### Core Integrations

Manteia implements comprehensive integration with the 1inch Protocol ecosystem, providing advanced trading capabilities across multiple networks and protocols.

Implementation details can be found here:
- [OneInchMultiNetworkService](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchMultiNetworkService.js): Core service handling multi-network operations and API communication
- [OneInchService](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js): Advanced features including Fusion+ and SDK integration
- [useOneInchIntegration](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts): React hook for comprehensive 1inch API interactions
- [OneInchSwapInterface](https://github.com/Abraham12611/manteia/blob/main/frontend-template/components/one-inch-swap-interface.tsx): Main swap interface with real-time quotes and execution

The integration offers several key components:

1. **Multi-Network Support**
   - Support for Ethereum, Arbitrum, Optimism, Polygon, Base, BNB Chain, Avalanche, Gnosis
   - Intelligent network detection and token loading
   - Unified interface across all supported networks

2. **Advanced API Integration**
   - Classic Swap v6.0 for primary swap functionality
   - Fusion+ API for cross-chain swap capabilities
   - Limit Order Protocol for advanced strategies
   - Comprehensive data APIs for real-time information

3. **Real-Time Monitoring**
   - WebSocket connections for live data updates
   - Order status tracking and notifications
   - Portfolio monitoring across networks
   - Performance analytics and reporting

---

## Expand Limit Order Protocol

### Advanced Strategy Implementation

Manteia extends the 1inch Limit Order Protocol beyond basic limit orders to include sophisticated predicate-based strategies and custom execution logic. We've built a comprehensive strategy engine that creates custom predicates and interactions, enabling advanced trading strategies that execute onchain without using the official Limit Order API.

#### Core Strategy Engine

Implementation details can be found here:
- [LimitOrderService](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/limitOrderService.js): Main service for strategy management and execution
- [PredicateBuilder](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/limitOrderService.js#L8): Advanced predicate creation for complex conditions
- [EnhancedStrategies](https://github.com/Abraham12611/manteia/blob/main/backend/src/routes/enhancedStrategies.js): Specialized strategy implementations and API endpoints
- [useLimitOrders](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-limit-orders.ts): React hook for limit order management

#### Advanced Predicate System

**Custom Predicates**: Instead of using 1inch's basic limit order system, we create custom "predicates" - special conditions that determine when orders should execute. Our predicate system can check:

- **Time-based conditions**: Execute orders within specific time windows
- **Price-based conditions**: Trigger orders when price reaches certain levels
- **Volume-based conditions**: Execute based on trading volume thresholds
- **Compound conditions**: Combine multiple conditions with AND/OR logic
- **Custom logic**: Implement complex trading algorithms

**Implementation Example**:
```javascript
// Time-based predicate for TWAP strategies
createTimePredicate(startTime, endTime) {
  return this.abiCoder.encode(['uint256', 'uint256'], [startTime, endTime]);
}

// Price-based predicate for options strategies
createPricePredicate(token, strikePrice, optionType, expiry) {
  return this.abiCoder.encode(
    ['address', 'uint256', 'uint8', 'uint256'],
    [token, strikePrice, optionType === 'call' ? 1 : 0, expiry]
  );
}

// Compound predicate for complex strategies
createCompoundPredicate(predicates, logicOperator = 'AND') {
  const encodedPredicates = predicates.map(p => p.predicate);
  const operators = predicates.map(p => p.operator || 0);
  return this.abiCoder.encode(
    ['bytes[]', 'uint8[]', 'uint8'],
    [encodedPredicates, operators, logicOperator === 'AND' ? 0 : 1]
  );
}
```

#### Advanced Strategy Types

**1. Enhanced TWAP (Time-Weighted Average Price)**

**Problem Solved**: Large traders often move markets when executing big trades all at once, causing slippage and poor execution prices.

**Our Solution**: TWAP breaks large trades into smaller pieces over time, reducing market impact and improving execution quality.

**Implementation**:
- [EnhancedTWAPStrategy](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/enhancedStrategies.js): Dynamic interval adjustment based on market conditions
- [EnhancedTWAPConfig](https://github.com/Abraham12611/manteia/blob/main/frontend-template/components/limit-orders/enhanced-twap-config.tsx): Visual configuration interface for TWAP strategies

**How It Works**:
- User configures total amount, intervals, and duration
- System calculates optimal interval distribution
- Creates multiple limit orders with time-based predicates
- Implements slippage protection and partial fill handling
- Monitors execution and adjusts intervals dynamically

**User Benefit**: Instead of potentially losing 2-3% to slippage, users might only lose 0.1-0.2%.

**2. Barrier Options**

**Problem Solved**: Users want to protect against losses or capture gains, but options trading is complex and expensive.

**Our Solution**: We create option-like strategies using limit orders with special conditions, providing professional-level risk management without the complexity or cost of traditional options.

**Implementation**:
- [BarrierOptionsStrategy](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/enhancedStrategies.js): Knock-in and knock-out barrier monitoring
- Real-time price tracking and barrier breach detection
- Automatic order execution when conditions are met

**How It Works**:
- User sets up a "knock-out" order: "Sell my ETH if the price drops below $1,800"
- System monitors the price in real-time
- When the condition is met, the order automatically executes
- No need for expensive options contracts or complex derivatives

**User Benefit**: Professional-level risk management without the complexity or cost of traditional options.

**3. Dynamic Delta Hedging**

**Problem Solved**: Professional traders spend hours managing their risk exposure, constantly adjusting positions as markets move.

**Our Solution**: Automated risk management that adjusts positions based on market movements, providing professional risk management without needing a full-time trader.

**Implementation**:
- [DynamicDeltaHedgingStrategy](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/enhancedStrategies.js): Automatic delta-neutral positioning
- Real-time delta calculation and monitoring
- Dynamic rebalancing based on market movements

**How It Works**:
- User sets a target risk level (like "neutral" or "slightly bullish")
- System calculates what positions they need
- As markets move, it automatically creates new orders to maintain the target risk
- All done through smart contracts - no manual intervention needed

**User Benefit**: Professional risk management without needing a full-time trader.

**4. Concentrated Liquidity**

**Problem Solved**: Liquidity providers often lose money due to "impermanent loss" when prices move significantly.

**Our Solution**: Smart liquidity provision that automatically rebalances based on price movements, providing higher returns with lower risk compared to traditional liquidity provision.

**Implementation**:
- [ConcentratedLiquidityStrategy](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/limitOrderService.js#L95): Multi-range liquidity provision
- Automatic rebalancing based on price movements
- Impermanent loss protection mechanisms

**How It Works**:
- User provides liquidity in a specific price range
- System monitors the price and automatically adjusts the position
- When prices move outside the range, it rebalances to minimize losses
- Uses advanced mathematical models to optimize the strategy

**User Benefit**: Higher returns with lower risk compared to traditional liquidity provision.

#### Custom Strategy Builder

**Features**:
- Visual strategy builder interface
- Drag-and-drop condition creation
- Custom logic implementation
- Strategy templates and sharing

**Implementation**:
- [CustomStrategyBuilder](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/enhancedStrategies.js): Visual interface for creating complex strategies
- [useCreateStrategy](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-create-strategy.ts): React hook for strategy creation
- [StrategyWizard](https://github.com/Abraham12611/manteia/blob/main/frontend-template/components/strategy-wizard.tsx): Step-by-step strategy creation interface

#### Onchain Execution Verification

**Custom Limit Orders**: All limit orders use custom predicates and interactions, ensuring they are NOT posted to the official Limit Order API while maintaining full onchain execution capabilities.

**Implementation**:
- [createLimitOrder](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L250): Custom limit order creation with predicates
- [Strategy Registry](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/limitOrderService.js#L150): Active strategy tracking and monitoring
- [Real-time Monitoring](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/limitOrderService.js#L320): Continuous strategy monitoring and adjustment

---

## Build a Full Application using 1inch APIs

### Comprehensive API Integration

Manteia demonstrates extensive use of 1inch REST APIs across multiple services, providing a complete DeFi trading experience that leverages the full spectrum of 1inch Protocol capabilities.

#### Swap Functionality Integration

**1. Classic Swap Aggregation**

Implementation details can be found here:
- [Classic Swap API](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L350): Primary swap functionality using 1inch Aggregation v6.0
- [Swap Quote Generation](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts#L95): Real-time quote fetching with intelligent debouncing
- [Swap Transaction Building](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts#L450): Transaction construction and execution

**Features**:
- Best route finding across 250+ DEXs
- Real-time price quotes with protocol breakdown
- Gas optimization and estimation
- Slippage protection and execution monitoring

**2. Cross-Chain Fusion+ Integration**

Implementation details can be found here:
- [Fusion+ Quote API](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts#L130): Cross-chain quote generation
- [Fusion+ Order Creation](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts#L180): Order building and submission
- [Cross-Chain SDK](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L60): Advanced Fusion+ functionality with SDK integration

**Features**:
- Atomic cross-chain swaps between EVM networks
- Intent-based order matching
- Real-time order status tracking
- Automatic secret management and execution

**3. Intent-based Swap (Fusion)**

Implementation details can be found here:
- [Fusion Order Management](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L200): Intent-based order creation and management
- [WebSocket Integration](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L600): Real-time order updates and monitoring
- [Secret Management](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L250): Automatic secret submission and execution

**Features**:
- Intent-based order matching
- Real-time order status updates
- Automatic execution optimization
- Risk management and monitoring

#### Onchain Data Integration

**1. Price Feeds API**

Implementation details can be found here:
- [Token Price API](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts#L380): Real-time price data from 1inch Spot Price API
- [Price Impact Calculation](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts#L520): Price impact analysis and display
- [Market Data Integration](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L400): Comprehensive market data aggregation

**Features**:
- Real-time price feeds across all supported networks
- Price impact calculation and display
- Historical price data and trends
- Multi-currency price conversion

**2. Wallet Balances API**

Implementation details can be found here:
- [Balance API Integration](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L420): Multi-chain balance tracking
- [useWalletBalances](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-wallet-balances.ts): React hook for balance management
- [Multi-Network Balance Display](https://github.com/Abraham12611/manteia/blob/main/frontend-template/components/multi-network-wallet-balance.tsx): Unified balance interface

**Features**:
- Multi-chain balance tracking
- Real-time balance updates
- Token metadata and information
- Portfolio aggregation across networks

**3. Token Metadata API**

Implementation details can be found here:
- [Token Metadata Service](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L380): Comprehensive token information
- [Token List Management](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchMultiNetworkService.js#L100): Intelligent token loading and caching
- [Popular Tokens API](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchMultiNetworkService.js#L150): Curated token lists and recommendations

**Features**:
- Comprehensive token information and metadata
- Token logos and branding
- Network-specific token lists
- Popular token recommendations

#### Web3 API Integration

**1. Transaction Building and Submission**

Implementation details can be found here:
- [Transaction Building](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L800): Smart transaction construction
- [Gas Optimization](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L850): Gas estimation and optimization
- [Transaction Monitoring](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L900): Real-time transaction tracking

**Features**:
- Intelligent transaction building
- Gas optimization and estimation
- Transaction status monitoring
- Error handling and retry logic

**2. Gas Price API**

Implementation details can be found here:
- [Gas Price Service](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L450): Real-time gas price data
- [Gas Optimization](https://github.com/Abraham12611/manteia/blob/main/frontend-template/hooks/use-1inch-integration.ts#L480): Gas cost optimization and display
- [Network-Specific Gas](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchMultiNetworkService.js#L200): Multi-network gas price tracking

**Features**:
- Real-time gas price data across networks
- Gas optimization recommendations
- Transaction cost estimation
- Network-specific gas strategies

#### Additional API Integrations

**1. Portfolio and History APIs**

Implementation details can be found here:
- [Portfolio API](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L470): Portfolio tracking and analytics
- [Transaction History](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchService.js#L490): Comprehensive transaction history
- [Performance Analytics](https://github.com/Abraham12611/manteia/blob/main/frontend-template/components/strategy-analytics.tsx): Performance tracking and reporting

**Features**:
- Comprehensive portfolio tracking
- Transaction history and analytics
- Performance metrics and reporting
- Cross-network portfolio aggregation

**2. Rate Limiting and Optimization**

Implementation details can be found here:
- [Request Queuing](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchMultiNetworkService.js#L50): Intelligent request management
- [Caching Strategy](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchMultiNetworkService.js#L80): Token and data caching
- [Error Handling](https://github.com/Abraham12611/manteia/blob/main/backend/src/services/oneInchMultiNetworkService.js#L120): Robust error handling and retry logic

**Features**:
- Intelligent request queuing and rate limiting
- Token and data caching with TTL
- Exponential backoff retry logic
- Graceful error handling and degradation

---

## Smart Contract Architecture

### Backend Services Architecture

Manteia's backend is built with a multi-layered architecture that provides robust API integration, intelligent caching, and comprehensive error handling.

**Core Services**:
- **OneInchMultiNetworkService**: Handles multi-network operations with intelligent rate limiting
- **OneInchService**: Advanced features including Fusion+ and SDK integration
- **LimitOrderService**: Strategy management and custom predicate creation
- **EnhancedStrategies**: Specialized strategy implementations

**Key Features**:
- Intelligent request queuing to handle API rate limits
- Token caching with 5-minute TTL for optimal performance
- Exponential backoff retry logic for robust error handling
- Real-time WebSocket connections for live data updates

### Frontend Architecture

The frontend is built with React and TypeScript, providing a modern, responsive interface that works seamlessly across all devices.

**Core Components**:
- **OneInchSwapInterface**: Main swap interface with real-time quotes
- **EnhancedTWAPConfig**: Visual configuration for advanced strategies
- **StrategyWizard**: Step-by-step strategy creation interface
- **ActiveOrdersList**: Real-time order monitoring and management

**Key Features**:
- Real-time updates with WebSocket connections
- Responsive design for desktop, tablet, and mobile
- Accessibility features for inclusive user experience
- Optimistic UI updates for better user experience

---

## User Workflows

### For Beginners

**Simple Swap Interface**:
- Clean, intuitive design with popular tokens prominently displayed
- Real-time price updates and clear fee explanations
- One-click execution with built-in safety checks
- Educational tooltips and best practices suggestions

### For Intermediate Users

**Strategy Templates**:
- Pre-built strategies for common scenarios (DCA, portfolio protection, yield farming)
- Customizable parameters and risk tolerance settings
- Performance monitoring and analytics
- Strategy comparison and optimization tools

### For Advanced Users

**Custom Strategy Builder**:
- Visual interface for creating complex strategies
- Drag-and-drop condition creation
- Custom logic implementation and testing
- Strategy sharing and marketplace features

**Professional Tools**:
- Advanced analytics and reporting
- Portfolio tracking across multiple strategies
- Risk analysis and stress testing
- Performance benchmarking and optimization

---

## Technical Highlights

### Innovation and Technical Excellence

**1. Custom Predicate System**
- Advanced predicate creation for complex trading conditions
- Compound predicates with AND/OR logic
- Custom logic implementation for sophisticated strategies
- Onchain execution without using official Limit Order API

**2. Real-Time Intelligence**
- WebSocket connections for live data updates
- Intelligent market monitoring and strategy adjustment
- Automated risk management and position rebalancing
- Performance optimization and cost reduction

**3. Comprehensive API Integration**
- Multiple 1inch APIs working together seamlessly
- Intelligent caching and rate limiting
- Robust error handling and fallback mechanisms
- Cross-chain functionality and multi-network support

**4. User-Centric Design**
- Professional tools made accessible to all users
- Educational resources and best practices built-in
- Risk management at every level
- Intuitive interface for all skill levels

### Competitive Advantages

**1. Advanced Strategy Engine**
- TWAP, options, concentrated liquidity, and delta hedging
- Custom predicate system for complex conditions
- Real-time monitoring and adjustment
- Professional-grade risk management

**2. Comprehensive 1inch Integration**
- Classic Swap, Fusion+, and Limit Order Protocol
- Price feeds, wallet balances, and token metadata
- Gas optimization and transaction building
- Portfolio tracking and analytics

**3. Scalable Architecture**
- Multi-network support across 8+ blockchains
- Intelligent caching and rate limiting
- Robust error handling and monitoring
- Performance optimization and cost reduction

---

## Conclusion

Manteia represents the future of DeFi trading - where professional-grade tools are accessible to everyone, where complex strategies are simplified, and where users can achieve better results with less effort.

### Key Achievements

1. **Advanced Limit Order Protocol Extension**: Custom predicates and strategies that execute onchain without using the official API
2. **Comprehensive 1inch API Integration**: Multiple APIs working together to provide a complete trading experience
3. **Real-Time Intelligence**: Systems that adapt to market conditions automatically
4. **Risk Management Built-In**: Protection mechanisms at every level
5. **Educational Focus**: Helping users understand and succeed

### The Bottom Line

Manteia transforms the 1inch Protocol from a simple swap aggregator into a powerful trading platform that can compete with institutional-grade systems. We're not just building another DeFi interface - we're building the future of decentralized trading.

**Thank you for your time. We're excited to demonstrate how Manteia leverages the full power of 1inch Protocol to create a comprehensive, professional-grade trading platform.**