const { fetchMarketInfo, mapOutcome } = require('./resolution-bot');
const config = require('./config');
const axios = require('axios');

async function testMarketFetch() {
  console.log('Testing Manteia Resolution Bot Market Fetching...\n');

  // Test with market IDs from config or use example
  let testMarketIds = config.marketsToTrack.length > 0 ? config.marketsToTrack : [];

  if (testMarketIds.length === 0) {
    console.log('No markets configured in config.js');
    console.log('Run "npm run markets:find" to discover current Polymarket markets');
    console.log('Then add the condition IDs to scripts/config.js\n');

    // Try to fetch some markets for testing
    console.log('Attempting to fetch current markets for testing...\n');
    try {
      const response = await axios.get('https://clob.polymarket.com/simplified-markets', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Take first 3 markets for testing
        testMarketIds = response.data.slice(0, 3).map(m => m.condition_id).filter(Boolean);
        console.log(`Found ${testMarketIds.length} markets to test\n`);
      }
    } catch (error) {
      console.log('Could not fetch markets automatically:', error.message);
      return;
    }
  }

  for (const marketId of testMarketIds) {
    console.log(`\nTesting market: ${marketId}`);
    console.log('='.repeat(60));

    try {
      const marketInfo = await fetchMarketInfo(marketId);

      if (marketInfo) {
        console.log(`Source: ${marketInfo.source}`);
        console.log(`Market data:`, JSON.stringify(marketInfo.data, null, 2).substring(0, 500) + '...');

        const outcome = mapOutcome(marketInfo.data, marketInfo.source);
        if (outcome !== null) {
          console.log(`\nMarket is RESOLVED with outcome: ${outcome === 1 ? 'YES' : 'NO'}`);
        } else {
          console.log(`\nMarket is NOT YET RESOLVED`);
        }
      } else {
        console.log('Failed to fetch market data');
      }
    } catch (error) {
      console.error(`Error testing market ${marketId}:`, error.message);
    }
  }

  console.log('\n\nTest complete!');
}

// Run the test
if (require.main === module) {
  testMarketFetch().catch(console.error);
}

module.exports = { testMarketFetch };