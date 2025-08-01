# Manteia Frontend

This is the frontend application for Manteia - a cross-chain DEX with 1inch integration.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create a `.env.local` file in the `frontend-template` directory with the following content:

```env
# Environment Variables for Manteia

# Alchemy API Key - Get yours at https://dashboard.alchemy.com/
# This is required for Ethereum balance checking and other EVM operations
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here

# 1inch API Key - Get yours at https://portal.1inch.dev/
# This is required for swap quotes, cross-chain swaps, and limit orders
NEXT_PUBLIC_ONEINCH_API_KEY=your_1inch_api_key_here

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Network Configuration (mainnet/testnet)
NEXT_PUBLIC_NETWORK=testnet

# Optional: Custom RPC URLs (if not using default endpoints)
# NEXT_PUBLIC_ETH_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
# NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
```

3. Run the development server:
```bash
pnpm dev
```

## Features

- **Dual Wallet Support**: Connect both Ethereum and Sui wallets
- **Real-time Balance Checking**: View balances using Alchemy SDK and Sui SDK
- **Cross-chain Swaps**: Swap between Ethereum and Sui using 1inch Fusion+
- **Sui Native Swaps**: Use Cetus CLMM for Sui-native swaps
- **1inch Integration**: Access quotes, cross-chain routing, and limit orders

## Token Addresses

### Sui Testnet
- **CETUS**: `0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS`
- **xCETUS**: `0x9e69acc50ca03bc943c4f7c5304c2a6002d507b51c11913b247159c60422c606::xcetus::XCETUS`
- **USDC**: `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC`

### Ethereum Sepolia
- **USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

## API Keys Required

1. **Alchemy API Key**: Required for Ethereum balance checking and transaction monitoring
   - Get it from: https://dashboard.alchemy.com/

2. **1inch API Key**: Required for swap quotes and cross-chain functionality
   - Get it from: https://portal.1inch.dev/

## Development

The frontend uses:
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Shadcn/ui components
- Real SDK integrations (no mock data)