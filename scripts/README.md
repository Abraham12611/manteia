# Manteia Scripts Documentation

This directory contains scripts for deploying contracts and running the resolution bot for the Manteia prediction market platform.

## Resolution Bot

The resolution bot monitors Polymarket markets and automatically resolves them on-chain when outcomes are determined.

### Setup

1. **Configure Environment**
   ```bash
   # Copy the example config and update with your values
   cp config.example.js config.js
   ```

2. **Edit config.js with your settings:**
   - `privateKey`: Your wallet private key for sending transactions
   - `marketHubAddress`: The deployed MarketHub contract address
   - `marketsToTrack`: Array of Polymarket market IDs to monitor

3. **Install Dependencies**
   ```bash
   npm install
   ```

### Running the Resolution Bot

```bash
# Run the resolution bot
npx hardhat run scripts/resolution-bot.js --network mantle_sepolia

# Or run directly with node (requires hardhat config)
node scripts/resolution-bot.js
```

The bot will:
- Poll specified Polymarket markets every 60 seconds
- Check if markets are resolved
- Call `resolveMarket()` on the MarketHub contract when outcomes are determined
- Track resolved markets to avoid duplicate resolutions
- Respect Polymarket API rate limits (60 requests/minute)

### Testing the Bot

```bash
# Test market fetching without sending transactions
node scripts/test-resolution-bot.js
```

### Finding Markets to Track

```bash
# Find active Polymarket markets
node scripts/find-polymarket-markets.js

# Find markets with specific criteria
node scripts/find-polymarket-markets.js --limit 20 --tag Politics
node scripts/find-polymarket-markets.js --search "Bitcoin"
node scripts/find-polymarket-markets.js --closed  # Show closed markets
```

## Deployment Scripts

### Deploy All Contracts
```bash
npx hardhat run scripts/deploy-markets.js --network mantle_sepolia
```

### Deploy USDC Test Token
```bash
npx hardhat run scripts/deploy-usdct.js --network mantle_sepolia
```

### Check Balances
```bash
npx hardhat run scripts/check-balance.js --network mantle_sepolia
```

## Resolution Bot Features

### Rate Limiting
- Respects Polymarket's 60 requests/minute limit
- Adds 1.1 second delay between requests
- Automatically waits when rate limit is reached

### Market Tracking
- Stores resolved markets in `.resolved-markets.json`
- Prevents duplicate resolution transactions
- Persists state between bot restarts

### Error Handling
- Graceful fallback from CLOB API to Strapi API
- Continues operation if individual markets fail
- Logs all errors with context

### Outcome Mapping
- Maps Polymarket YES/NO outcomes to numeric values (1/0)
- Handles different API response formats
- Validates outcomes before on-chain submission

## Configuration Options

### config.js Parameters

```javascript
{
  // Network settings
  mantleRpcUrl: 'https://rpc.testnet.mantle.xyz',
  privateKey: 'your_private_key',

  // Contract addresses
  marketHubAddress: '0x...',

  // Bot settings
  pollIntervalMs: 60000,        // Poll interval in milliseconds
  marketsToTrack: ['0x...'],    // Array of Polymarket market IDs

  // Rate limiting
  maxRequestsPerMinute: 60,     // Max API requests per minute
  requestDelayMs: 1100          // Delay between requests
}
```

## Troubleshooting

### Common Issues

1. **"Market not found" errors**
   - Verify the market ID is correct
   - Check if the market exists on Polymarket
   - Try both CLOB and Strapi API endpoints

2. **Transaction failures**
   - Ensure sufficient MNT balance for gas
   - Verify the MarketHub contract address
   - Check if market is already resolved on-chain

3. **Rate limiting**
   - Bot automatically handles rate limits
   - Increase `requestDelayMs` if needed
   - Reduce number of tracked markets

### Logs and Debugging

- Resolution bot logs all activities to console
- Check `.resolved-markets.json` for tracking state
- Use test scripts to debug without sending transactions

## Security Notes

- **Never commit your private key or config.js file**
- Use environment variables for sensitive data
- Run the bot on a secure server for production
- Monitor bot wallet balance and activity

## Future Improvements

- [ ] Add Hyperlane cross-chain messaging for multi-chain resolution
- [ ] Implement WebSocket connections for real-time updates
- [ ] Add database for better state management
- [ ] Create web dashboard for monitoring
- [ ] Add support for more complex market types