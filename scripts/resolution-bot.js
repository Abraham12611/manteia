
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
    // Try CLOB API market endpoint
    const marketResponse = await rateLimitedRequest(async () => {
      return axios.get(`${config.polymarketApiUrl}/markets/${marketId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    });

    if (marketResponse.data) {
      return {
        source: 'clob-market',
        data: marketResponse.data
      };
    }
  } catch (error) {
    console.log(`CLOB market API error for ${marketId}: ${error.message}`);

    // Try simplified markets endpoint
    try {
      const simplifiedResponse = await rateLimitedRequest(async () => {
        return axios.get(`${config.polymarketApiUrl}/simplified-markets`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      });

      if (simplifiedResponse.data) {
        // Find the specific market in the list
        const markets = Array.isArray(simplifiedResponse.data) ? simplifiedResponse.data : [];
        const market = markets.find(m => m.condition_id === marketId);

        if (market) {
          return {
            source: 'simplified',
            data: market
          };
        }
      }
    } catch (simplifiedError) {
      console.error(`Simplified markets API error: ${simplifiedError.message}`);
    }

    // Try sampling markets endpoint as last resort
    try {
      const samplingResponse = await rateLimitedRequest(async () => {
        return axios.get(`${config.polymarketApiUrl}/sampling-markets`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      });

      if (samplingResponse.data && samplingResponse.data.markets) {
        const market = samplingResponse.data.markets.find(m => m.condition_id === marketId);

        if (market) {
          return {
            source: 'sampling',
            data: market
          };
        }
      }
    } catch (samplingError) {
      console.error(`Sampling markets API error: ${samplingError.message}`);
    }
  }

  return null;
}

// Map Polymarket outcome to contract outcome format
function mapOutcome(marketData, source) {
  // Check if market is resolved
  const isResolved = marketData.resolved || marketData.closed || marketData.is_resolved;

  if (!isResolved) {
    return null;
  }

  // Check various outcome fields used by different API endpoints
  if (marketData.winning_outcome !== undefined) {
    // Some endpoints use winning_outcome (YES/NO)
    return marketData.winning_outcome === 'YES' || marketData.winning_outcome === 'Yes' ? 1 : 0;
  }

  if (marketData.winner !== undefined) {
    // Others use winner
    return marketData.winner === 'YES' || marketData.winner === 'Yes' ? 1 : 0;
  }

  if (marketData.outcome !== undefined) {
    // Some use outcome
    if (typeof marketData.outcome === 'string') {
      return marketData.outcome === 'YES' || marketData.outcome === 'Yes' ? 1 : 0;
    } else if (typeof marketData.outcome === 'number') {
      return marketData.outcome;
    }
  }

  if (marketData.resolution !== undefined) {
    // Others use resolution
    return marketData.resolution === 'YES' || marketData.resolution === 'Yes' ? 1 : 0;
  }

  // For markets with tokens array (binary markets)
  if (marketData.tokens && Array.isArray(marketData.tokens)) {
    const yesToken = marketData.tokens.find(t => t.outcome === 'Yes' || t.outcome === 'YES');
    const noToken = marketData.tokens.find(t => t.outcome === 'No' || t.outcome === 'NO');

    if (yesToken && yesToken.winning) return 1;
    if (noToken && noToken.winning) return 0;
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
