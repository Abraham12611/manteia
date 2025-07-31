#!/bin/bash

# Manteia Quick Start Script
# This script provides a guided quick start experience for Manteia

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo_header() {
    echo -e "${PURPLE}╭─────────────────────────────────────────────╮${NC}"
    echo -e "${PURPLE}│               Manteia QuickStart            │${NC}"
    echo -e "${PURPLE}│         Cross-Chain DEX Aggregator         │${NC}"
    echo -e "${PURPLE}╰─────────────────────────────────────────────╯${NC}"
    echo ""
}

echo_step() {
    echo -e "${CYAN}🔄 $1${NC}"
}

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt user
prompt_user() {
    read -p "$(echo -e ${YELLOW}$1 \(y/n\): ${NC})" -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

echo_header

echo_info "This script will help you get Manteia up and running quickly!"
echo_info "Project directory: $PROJECT_ROOT"
echo ""

# Check what's already set up
ENV_FILE="$PROJECT_ROOT/backend/.env"
SETUP_NEEDED=true

if [ -f "$ENV_FILE" ]; then
    echo_step "Checking existing configuration..."

    # Check if key variables are set
    if grep -q "SUI_PACKAGE_ID=0x" "$ENV_FILE" && \
       grep -q "RESOLVER_PRIVATE_KEY=0x" "$ENV_FILE" && \
       grep -q "SUI_PRIVATE_KEY=suiprivkey" "$ENV_FILE"; then
        echo_success "Environment already configured!"
        SETUP_NEEDED=false
    else
        echo_warning "Environment partially configured"
    fi
else
    echo_info "No environment file found"
fi

# Offer setup options
echo ""
echo "🎯 What would you like to do?"
echo ""
echo "1. 🚀 Complete Setup (recommended for first-time users)"
echo "2. 🔍 Verify Current Setup"
echo "3. 🏃 Quick Test (if already configured)"
echo "4. 📚 Show Documentation Links"
echo "5. 🛠️  Individual Setup Steps"
echo ""

read -p "Choose an option (1-5): " choice

case $choice in
    1)
        echo_step "Starting complete setup..."
        echo ""

        if [ "$SETUP_NEEDED" = true ]; then
            echo_info "Running automated setup script..."
            bash "$SCRIPT_DIR/setup-environment.sh"

            if [ $? -eq 0 ]; then
                echo_success "Setup completed successfully!"
            else
                echo_error "Setup encountered issues. Check the output above."
                exit 1
            fi
        else
            echo_info "Environment already configured. Skipping setup."
        fi

        echo_step "Verifying configuration..."
        node "$SCRIPT_DIR/verify-environment.js"

        if [ $? -eq 0 ]; then
            echo_success "All systems ready!"
            echo ""
            echo_info "Next steps:"
            echo "  cd backend && npm run dev"
            echo "  Open http://localhost:3001 in your browser"
        fi
        ;;

    2)
        echo_step "Verifying current setup..."
        node "$SCRIPT_DIR/verify-environment.js"
        ;;

    3)
        echo_step "Running quick test..."

        if [ ! -f "$ENV_FILE" ]; then
            echo_error "No .env file found. Please run complete setup first."
            exit 1
        fi

        cd "$PROJECT_ROOT/backend"

        echo_step "Installing dependencies..."
        npm install --silent

        echo_step "Testing Sui connection..."
        if node -e "
            const { SuiClient } = require('@mysten/sui/client');
            const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });
            client.getLatestCheckpointSequenceNumber()
              .then(cp => console.log('✅ Sui connected, checkpoint:', cp))
              .catch(err => { console.error('❌ Sui connection failed:', err.message); process.exit(1); });
        "; then
            echo_success "Sui connection working"
        fi

        echo_step "Starting development server..."
        echo_info "Server will start on http://localhost:3001"
        echo_info "Press Ctrl+C to stop"
        echo ""
        npm run dev
        ;;

    4)
        echo ""
        echo_info "📚 Manteia Documentation"
        echo "=========================="
        echo ""
        echo "🔧 Setup Guide: $PROJECT_ROOT/SETUP_GUIDE.md"
        echo "📊 Project Status: $PROJECT_ROOT/PROJECT_STATUS.md"
        echo "🏗️ Backend Docs: $PROJECT_ROOT/backend/README.md"
        echo ""
        echo "🌐 External Resources:"
        echo "• 1inch Developer Portal: https://portal.1inch.dev/"
        echo "• Sui Documentation: https://docs.sui.io/"
        echo "• Sui Explorer (Testnet): https://suiexplorer.com/?network=testnet"
        echo "• Sepolia Faucet: https://sepoliafaucet.com/"
        echo ""
        echo "🛠️ Available Scripts:"
        echo "• Complete setup: ./scripts/setup-environment.sh"
        echo "• Generate Ethereum key: cd scripts && node generate-ethereum-key.js"
        echo "• Deploy Sui contracts: ./scripts/deploy-sui-contracts.sh"
        echo "• Verify environment: node scripts/verify-environment.js"
        ;;

    5)
        echo ""
        echo "🛠️  Individual Setup Steps"
        echo "=========================="
        echo ""

        if prompt_user "Generate Ethereum private key?"; then
            cd "$SCRIPT_DIR"
            npm install --silent
            node generate-ethereum-key.js
            echo ""
        fi

        if prompt_user "Deploy Sui contracts?"; then
            bash "$SCRIPT_DIR/deploy-sui-contracts.sh"
            echo ""
        fi

        if prompt_user "Verify environment?"; then
            node "$SCRIPT_DIR/verify-environment.js"
            echo ""
        fi

        if prompt_user "Start development server?"; then
            cd "$PROJECT_ROOT/backend"
            npm install
            npm run dev
        fi
        ;;

    *)
        echo_error "Invalid option. Please choose 1-5."
        exit 1
        ;;
esac

echo ""
echo_success "Quick start complete!"
echo ""
echo_info "🎯 Next Steps:"
echo "1. Get 1inch API key: https://portal.1inch.dev/"
echo "2. Add ONEINCH_API_KEY to your .env file"
echo "3. Fund your addresses with testnet tokens"
echo "4. Start building the frontend!"
echo ""
echo_info "Need help? Check the documentation or run this script again."
echo ""