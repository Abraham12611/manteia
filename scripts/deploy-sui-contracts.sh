#!/bin/bash

# Deploy Sui Move Contracts for Manteia
# This script deploys the Manteia contracts and captures the important object IDs

set -e

echo "🚀 Deploying Manteia Sui Move Contracts..."
echo "============================================="

# Check if sui CLI is available
if ! command -v sui &> /dev/null; then
    echo "❌ Sui CLI not found. Please install it first:"
    echo "   curl -fsSL https://sui.io/install.sh | sh"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "contracts/sui/Move.toml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Navigate to contracts directory
cd contracts/sui

echo "📦 Building Move package..."
sui move build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check your Move code."
    exit 1
fi

echo "✅ Build successful!"

# Check Sui client setup
echo "🔍 Checking Sui client configuration..."
sui client active-address

# Check balance
echo "💰 Checking SUI balance..."
BALANCE=$(sui client balance --json | jq -r '.totalBalance')
echo "   Current balance: $BALANCE MIST"

if [ "$BALANCE" -lt 100000000 ]; then
    echo "⚠️  Low balance detected. Requesting testnet SUI..."
    sui client faucet
    echo "   Waiting for faucet transaction..."
    sleep 5
fi

echo "🚀 Publishing package..."
OUTPUT=$(sui client publish --gas-budget 100000000 --json)

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed. Check your balance and try again."
    exit 1
fi

echo "✅ Deployment successful!"

# Parse the output to extract important object IDs
PACKAGE_ID=$(echo "$OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
RESOLVER_REGISTRY_ID=$(echo "$OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("resolver::ResolverRegistry")) | .objectId')

# Display results
echo ""
echo "╭─────────────────────────────────────────────────────────────────────╮"
echo "│                    Deployment Results                              │"
echo "├─────────────────────────────────────────────────────────────────────┤"
echo "│ Package ID:           $PACKAGE_ID │"
echo "│ Resolver Registry ID: $RESOLVER_REGISTRY_ID │"
echo "╰─────────────────────────────────────────────────────────────────────╯"

# Generate environment variables
ENV_FILE="../../backend/.env.deployment"
cat > "$ENV_FILE" << EOF
# Sui Contract Deployment Results (Generated $(date))
SUI_PACKAGE_ID=$PACKAGE_ID
SUI_RESOLVER_REGISTRY_ID=$RESOLVER_REGISTRY_ID

# Add these to your .env file
EOF

echo ""
echo "📝 Environment Variables:"
echo "SUI_PACKAGE_ID=$PACKAGE_ID"
echo "SUI_RESOLVER_REGISTRY_ID=$RESOLVER_REGISTRY_ID"
echo ""
echo "💾 Also saved to: backend/.env.deployment"

# Display explorer links
echo "🔗 View on Sui Explorer:"
echo "   Package: https://suiexplorer.com/object/$PACKAGE_ID?network=testnet"
echo "   Registry: https://suiexplorer.com/object/$RESOLVER_REGISTRY_ID?network=testnet"

echo ""
echo "🎯 Next Steps:"
echo "1. Copy the environment variables to your backend/.env file"
echo "2. Start the backend server: cd backend && npm run dev"
echo "3. Register as a resolver via the API"
echo "4. Test cross-chain swaps!"

echo ""
echo "✅ Sui contracts deployed successfully!"