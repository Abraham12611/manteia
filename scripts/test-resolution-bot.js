const { fetchMarketInfo, mapOutcome } = require('./resolution-bot');
const config = require('./config');

async function testMarketFetch() {
  console.log('Testing Manteia Resolution Bot Market Fetching...\n');

  // Test with a known Polymarket market ID
  const testMarketIds = [
    '0x5f65177b394277fd294cd75650044e32ba009a95022022b4b5f60c9750f7a21c', // Example market
    // Add more test market IDs here
  ];

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