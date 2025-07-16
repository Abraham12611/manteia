
const axios = require('axios');
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Load configuration
let config;
try {
  config = require('./config');
} catch (error) {
  console.log('Using default configuration from config.example.js');
  config = require('./config.example');
}

// Rate limiting variables
let requestCount = 0;
let requestWindowStart = Date.now();

// Tracking resolved markets to avoid double resolution
const resolvedMarketsFile = path.join(__dirname, '.resolved-markets.json');
let resolvedMarkets = new Set();

// Load previously resolved markets
try {
  if (fs.existsSync(resolvedMarketsFile)) {
    const data = JSON.parse(fs.readFileSync(resolvedMarketsFile, 'utf8'));
    resolvedMarkets = new Set(data);
  }
} catch (error) {
  console.log('No previous resolved markets found');
}

// Rate limiting function
async function rateLimitedRequest(requestFn) {
  const now = Date.now();
  const windowElapsed = now - requestWindowStart;

  if (windowElapsed >= 60000) {
    // Reset window
    requestCount = 0;
    requestWindowStart = now;
  }

  if (requestCount >= config.maxRequestsPerMinute) {
    // Wait until next window
    const waitTime = 60000 - windowElapsed;
    console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    requestCount = 0;
    requestWindowStart = Date.now();
  }

  requestCount++;
  const result = await requestFn();

  // Add delay between requests
  await new Promise(resolve => setTimeout(resolve, config.requestDelayMs));

  return result;
}

// Save resolved markets to file
function saveResolvedMarkets() {
  fs.writeFileSync(resolvedMarketsFile, JSON.stringify([...resolvedMarkets], null, 2));
}

// Fetch market information from Polymarket
async function fetchMarketInfo(marketId) {
  try {
    // Try CLOB API first
    const clobResponse = await rateLimitedRequest(async () => {
      return axios.get(`${config.polymarketApiUrl}/markets/${marketId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    });

    if (clobResponse.data) {
      return {
        source: 'clob',
        data: clobResponse.data
      };
    }
  } catch (error) {
    console.log(`CLOB API error for market ${marketId}: ${error.message}`);

    // Fallback to Strapi API
    try {
      const strapiResponse = await rateLimitedRequest(async () => {
        return axios.get(`${config.polymarketStrapiUrl}/markets/${marketId}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      });

      if (strapiResponse.data) {
        return {
          source: 'strapi',
          data: strapiResponse.data
        };
      }
    } catch (strapiError) {
      console.error(`Strapi API error for market ${marketId}: ${strapiError.message}`);
    }
  }

  return null;
}

// Map Polymarket outcome to contract outcome format
function mapOutcome(marketData, source) {
  if (source === 'clob') {
    // CLOB API format
    if (marketData.resolved && marketData.winner) {
      // Convert winner (YES/NO) to numeric outcome
      return marketData.winner === 'YES' ? 1 : 0;
    }
  } else if (source === 'strapi') {
    // Strapi API format
    if (marketData.resolved) {
      // Check various outcome fields
      if (marketData.outcome !== undefined) {
        return marketData.outcome === 'Yes' || marketData.outcome === 'YES' ? 1 : 0;
      }
      if (marketData.resolution !== undefined) {
        return marketData.resolution === 'Yes' || marketData.resolution === 'YES' ? 1 : 0;
      }
    }
  }

  return null;
}

// Resolve market on-chain
async function resolveMarketOnChain(marketId, outcome) {
  try {
    console.log(`Resolving market ${marketId} with outcome: ${outcome === 1 ? 'YES' : 'NO'}`);

    const [signer] = await hre.ethers.getSigners();
    const MarketHub = await hre.ethers.getContractFactory('MarketHub');
    const marketHub = MarketHub.attach(config.marketHubAddress);

    // Convert Polymarket ID to a numeric ID for our contract
    // For MVP, we'll use a simple hash of the market ID
    const numericMarketId = parseInt(marketId.slice(0, 8), 16) % 1000000;

    // Check if already resolved on-chain
    const isResolved = await marketHub.marketResolved(numericMarketId);
    if (isResolved) {
      console.log(`Market ${marketId} (ID: ${numericMarketId}) already resolved on-chain`);
      return true;
    }

    // Estimate gas
    const gasEstimate = await marketHub.resolveMarket.estimateGas(numericMarketId, outcome);
    console.log(`Estimated gas: ${gasEstimate.toString()}`);

    // Send transaction
    const tx = await marketHub.resolveMarket(numericMarketId, outcome, {
      gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
    });

    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Market ${marketId} (ID: ${numericMarketId}) resolved on-chain at block ${receipt.blockNumber}`);

    return true;
  } catch (error) {
    console.error(`Error resolving market ${marketId} on-chain:`, error.message);
    return false;
  }
}

// Process a single market
async function processMarket(marketId) {
  try {
    // Skip if already resolved
    if (resolvedMarkets.has(marketId)) {
      console.log(`Market ${marketId} already processed`);
      return;
    }

    console.log(`Checking market ${marketId}...`);

    const marketInfo = await fetchMarketInfo(marketId);
    if (!marketInfo) {
      console.log(`Could not fetch data for market ${marketId}`);
      return;
    }

    const outcome = mapOutcome(marketInfo.data, marketInfo.source);
    if (outcome !== null) {
      console.log(`Market ${marketId} is resolved with outcome: ${outcome === 1 ? 'YES' : 'NO'}`);

      // Resolve on-chain
      const success = await resolveMarketOnChain(marketId, outcome);

      if (success) {
        // Mark as resolved
        resolvedMarkets.add(marketId);
        saveResolvedMarkets();

        // TODO: Send cross-chain message via Hyperlane to notify other chains
        console.log(`TODO: Send Hyperlane message for market ${marketId}`);
      }
    } else {
      console.log(`Market ${marketId} is not yet resolved`);
    }
  } catch (error) {
    console.error(`Error processing market ${marketId}:`, error.message);
  }
}

// Main bot loop
async function runBot() {
  console.log('Starting Manteia Resolution Bot...');
  console.log(`Tracking ${config.marketsToTrack.length} markets`);
  console.log(`Poll interval: ${config.pollIntervalMs}ms`);
  console.log(`MarketHub address: ${config.marketHubAddress}`);

  // Initial run
  for (const marketId of config.marketsToTrack) {
    await processMarket(marketId);
  }

  // Set up polling
  setInterval(async () => {
    console.log(`\n--- Polling markets at ${new Date().toISOString()} ---`);
    for (const marketId of config.marketsToTrack) {
      await processMarket(marketId);
    }
  }, config.pollIntervalMs);

  console.log('\nBot is running. Press Ctrl+C to stop.');
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down resolution bot...');
  saveResolvedMarkets();
  process.exit(0);
});

// Run the bot
if (require.main === module) {
  runBot().catch((error) => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  });
}

module.exports = { fetchMarketInfo, mapOutcome, resolveMarketOnChain };
