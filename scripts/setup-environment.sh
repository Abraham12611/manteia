#!/bin/bash

# Manteia Environment Setup Script
# This script helps set up the complete Manteia development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔧 Manteia Environment Setup"
echo "============================="
echo "Project root: $PROJECT_ROOT"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt user
prompt_user() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

if ! command_exists sui; then
    echo "⚠️  Sui CLI not found."
    if prompt_user "Install Sui CLI now?"; then
        echo "📥 Installing Sui CLI..."
        curl -fsSL https://sui.io/install.sh | sh
        export PATH="$HOME/.cargo/bin:$PATH"
        source ~/.bashrc
    else
        echo "❌ Sui CLI is required. Please install it manually:"
        echo "   curl -fsSL https://sui.io/install.sh | sh"
        exit 1
    fi
fi

echo "✅ Prerequisites check complete!"
echo ""

# Step 1: Setup backend dependencies
echo "📦 Setting up backend dependencies..."
cd "$PROJECT_ROOT/backend"

if [ ! -f package.json ]; then
    echo "❌ Backend package.json not found!"
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "   Installing npm dependencies..."
    npm install
else
    echo "   Dependencies already installed."
fi

# Step 2: Generate Ethereum keypair
echo ""
echo "🔐 Generating Ethereum resolver keypair..."
if [ ! -f .env ]; then
    cp env.template .env
    echo "   Created .env from template"
fi

# Install ethers temporarily if needed
if ! npm list ethers > /dev/null 2>&1; then
    echo "   Installing ethers for key generation..."
    npm install ethers
fi

# Generate Ethereum key
node "$SCRIPT_DIR/generate-ethereum-key.js"

# Step 3: Setup Sui client
echo ""
echo "🔑 Setting up Sui client..."
cd "$PROJECT_ROOT"

# Check if Sui client is configured
if ! sui client active-address > /dev/null 2>&1; then
    echo "   Sui client not configured."
    if prompt_user "Generate new Sui keypair?"; then
        sui keytool generate ed25519
        echo "   ✅ Sui keypair generated!"
    else
        echo "❌ Sui client configuration is required."
        exit 1
    fi
fi

# Get SUI address and private key
SUI_ADDRESS=$(sui client active-address)
echo "   Active Sui address: $SUI_ADDRESS"

# Check balance and request faucet if needed
BALANCE=$(sui client balance --json | jq -r '.totalBalance // 0')
echo "   Current balance: $BALANCE MIST"

if [ "$BALANCE" -lt 100000000 ]; then
    echo "   Requesting testnet SUI..."
    sui client faucet
    echo "   ✅ Faucet request sent!"
fi

# Step 4: Deploy Sui contracts
echo ""
if prompt_user "Deploy Sui Move contracts now?"; then
    echo "🚀 Deploying Sui contracts..."
    bash "$SCRIPT_DIR/deploy-sui-contracts.sh"
else
    echo "⏭️  Skipping contract deployment. You can deploy later with:"
    echo "   ./scripts/deploy-sui-contracts.sh"
fi

# Step 5: Configure environment variables
echo ""
echo "⚙️  Configuring environment variables..."
cd "$PROJECT_ROOT/backend"

# Get Sui private key
SUI_PRIVATE_KEY=$(sui keytool export $SUI_ADDRESS ed25519 2>/dev/null | grep "suiprivkey" || echo "")

if [ -z "$SUI_PRIVATE_KEY" ]; then
    echo "⚠️  Could not automatically extract Sui private key."
    echo "   Please run: sui keytool export $SUI_ADDRESS ed25519"
    echo "   And add it to your .env file as SUI_PRIVATE_KEY"
else
    # Update .env file with Sui configuration
    if grep -q "SUI_PRIVATE_KEY=" .env; then
        sed -i "s|SUI_PRIVATE_KEY=.*|SUI_PRIVATE_KEY=$SUI_PRIVATE_KEY|" .env
    else
        echo "SUI_PRIVATE_KEY=$SUI_PRIVATE_KEY" >> .env
    fi

    if grep -q "RESOLVER_SUI_PRIVATE_KEY_BASE64=" .env; then
        sed -i "s|RESOLVER_SUI_PRIVATE_KEY_BASE64=.*|RESOLVER_SUI_PRIVATE_KEY_BASE64=$SUI_PRIVATE_KEY|" .env
    else
        echo "RESOLVER_SUI_PRIVATE_KEY_BASE64=$SUI_PRIVATE_KEY" >> .env
    fi

    echo "   ✅ Sui keys added to .env"
fi

# Add deployment results if available
if [ -f .env.deployment ]; then
    echo "   📝 Adding contract deployment results..."
    cat .env.deployment >> .env
    rm .env.deployment
fi

# Step 6: Final instructions
echo ""
echo "🎯 Setup Summary"
echo "================"
echo "✅ Backend dependencies installed"
echo "✅ Ethereum resolver keypair generated"
echo "✅ Sui client configured"
if [ -f .env ] && grep -q "SUI_PACKAGE_ID=" .env; then
    echo "✅ Sui contracts deployed"
else
    echo "⏭️  Sui contracts not deployed (can be done later)"
fi
echo "✅ Environment variables configured"

echo ""
echo "📝 Still needed:"
echo "1. Get 1inch API key from: https://portal.1inch.dev/"
echo "2. Add ONEINCH_API_KEY to your .env file"
echo "3. Get Sepolia testnet ETH from: https://sepoliafaucet.com/"

echo ""
echo "🚀 Next Steps:"
echo "1. cd backend && npm run dev     # Start the backend server"
echo "2. Visit http://localhost:3001   # Test the API"
echo "3. cd ../frontend && npm run dev # Start the frontend (when ready)"

echo ""
echo "🔗 Useful Links:"
echo "• 1inch API Docs: https://portal.1inch.dev/documentation"
echo "• Sui Explorer: https://suiexplorer.com/?network=testnet"
echo "• Sepolia Explorer: https://sepolia.etherscan.io/"

echo ""
echo "✅ Environment setup complete!"

# Test the setup
echo ""
if prompt_user "Test the setup now?"; then
    echo "🧪 Testing setup..."

    # Test Sui connection
    echo "   Testing Sui connection..."
    if sui client balance > /dev/null 2>&1; then
        echo "   ✅ Sui connection working"
    else
        echo "   ❌ Sui connection failed"
    fi

    # Test Node.js dependencies
    echo "   Testing Node.js setup..."
    cd "$PROJECT_ROOT/backend"
    if node -e "require('@mysten/sui/client')" 2>/dev/null; then
        echo "   ✅ Sui SDK available"
    else
        echo "   ❌ Sui SDK not available"
    fi

    if node -e "require('ethers')" 2>/dev/null; then
        echo "   ✅ Ethers.js available"
    else
        echo "   ❌ Ethers.js not available"
    fi

    echo "   ✅ Setup test complete!"
fi

echo ""
echo "🎉 Welcome to Manteia development!"