# Manteia Frontend

A cross-chain prediction market frontend built with React, integrating Polymarket's order book API with on-chain settlement on Mantle.

## Features

- **🌐 Cross-Chain Support**: Trade on multiple chains without manual bridging
- **💱 Unified Order Book**: Access liquidity from all supported chains
- **🚀 Lightning Fast**: Powered by Mantle's high-performance L2
- **🔗 Wallet Integration**: Connect with MetaMask, WalletConnect, and more via Reown AppKit
- **📊 Real-Time Markets**: Live market data with beautiful visualizations
- **📱 Responsive Design**: Works seamlessly on desktop and mobile

## Tech Stack

- **React 19**: Latest React with modern hooks
- **React Router**: Client-side routing
- **Reown AppKit**: Wallet connectivity (formerly WalletConnect)
- **Wagmi**: React hooks for Ethereum
- **Viem**: TypeScript Ethereum library
- **Ethers.js**: Ethereum library for contract interactions

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- A Reown project ID from https://cloud.reown.com/

### Installation

1. Clone the repository and navigate to the frontend:
```bash
cd manteia/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Create a `.env` file in the frontend directory
   - See `ENV_SETUP.md` for detailed instructions
   - Add your Reown project ID and contract addresses

4. Start the development server:
```bash
npm start
```

The app will open at http://localhost:3000

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Header.js    # Navigation header with wallet connection
│   │   └── MarketCard.js # Market display cards
│   ├── context/         # React context providers
│   │   └── Web3Context.js # Wallet connectivity context
│   ├── pages/           # Page components
│   │   ├── Home.js      # Landing page
│   │   └── Markets.js   # Markets grid page
│   ├── abi/             # Contract ABIs
│   ├── theme.css        # Design system variables
│   ├── config.js        # Configuration file
│   ├── App.js           # Main app component
│   └── index.js         # Entry point
├── public/              # Static assets
└── package.json         # Dependencies
```

## Design System

The app uses a custom design system with:

- **Color Palette**: Deep Mantle Blue primary with Electric Cyan accents
- **Typography**: Inter for UI, JetBrains Mono for numbers, Outfit for headings
- **Spacing**: Consistent spacing scale from 4px to 64px
- **Components**: Reusable, accessible components following best practices

## Available Scripts

- `npm start` - Run development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App (not recommended)

## Key Components

### Header
- Logo with gradient effect
- Search functionality (to be implemented)
- Category navigation
- Chain selector for connected wallet
- Connect wallet button with Reown modal

### MarketCard
- Displays market question and probability
- Shows supported chains
- Volume and time period indicators
- Buy Yes/No quick action buttons
- Bookmark and share functionality

### Markets Page
- Filter bar with category pills
- Responsive grid layout
- Loading states with shimmer effect
- Empty states for no results

### Home Page
- Hero section with CTA
- Feature highlights
- Featured markets showcase
- Interactive chain visualization

## Environment Variables

Required environment variables:

- `REACT_APP_REOWN_PROJECT_ID` - Your Reown project ID
- `REACT_APP_MARKET_HUB_ADDRESS` - Deployed MarketHub contract address
- `REACT_APP_POLYMARKET_API_URL` - Polymarket API endpoint
- `REACT_APP_MANTLE_RPC_URL` - Mantle testnet RPC URL
- `REACT_APP_MANTLE_CHAIN_ID` - Mantle chain ID

See `ENV_SETUP.md` for detailed setup instructions.

## Supported Networks

- **Mantle Testnet** (Chain ID: 5001)
- **Mantle Sepolia** (Chain ID: 5003)

Additional networks can be added in `src/context/Web3Context.js`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the Manteia protocol.

## Acknowledgments

- Built for the Mantle ecosystem
- Integrates with Polymarket's CLOB API
- Uses Hyperlane for cross-chain messaging
- Wallet connectivity powered by Reown (WalletConnect)
