const axios = require('axios');

// Different Polymarket API endpoints to try
const endpoints = [
  {
    name: 'CLOB Markets',
    url: 'https://clob.polymarket.com/markets',
    method: 'GET'
  },
  {
    name: 'Simplified Markets',
    url: 'https://clob.polymarket.com/simplified-markets',
    method: 'GET'
  },
  {
    name: 'Sampling Markets',
    url: 'https://clob.polymarket.com/sampling-markets',
    method: 'GET'
  },
  {
    name: 'Gamma Markets',
    url: 'https://gamma-api.polymarket.com/markets',
    method: 'GET'
  },
  {
    name: 'Data API - Active Markets',
    url: 'https://data-api.polymarket.com/markets',
    method: 'GET'
  }
];

async function tryEndpoint(endpoint) {
  console.log(`\nTrying ${endpoint.name}...`);
  console.log(`URL: ${endpoint.url}`);

  try {
    const response = await axios({
      method: endpoint.method,
      url: endpoint.url,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✓ Success! Status: ${response.status}`);

    // Analyze the response
    const data = response.data;

    if (data) {
      // Check if it's an array or has a data property
      const markets = Array.isArray(data) ? data :
                     (data.data && Array.isArray(data.data)) ? data.data :
                     (data.markets && Array.isArray(data.markets)) ? data.markets : [];

      console.log(`Found ${markets.length} markets`);

      if (markets.length > 0) {
        console.log('\nFirst 3 markets:');
        markets.slice(0, 3).forEach((market, index) => {
          console.log(`\n${index + 1}. ${market.question || market.title || 'No title'}`);
          console.log(`   Condition ID: ${market.condition_id || market.conditionId || 'N/A'}`);
          console.log(`   Active: ${market.active !== false ? 'Yes' : 'No'}`);
          console.log(`   Closed: ${market.closed ? 'Yes' : 'No'}`);
          console.log(`   Volume: $${parseFloat(market.volume || 0).toLocaleString()}`);

          // Show outcome/resolution info
          if (market.resolved || market.closed) {
            console.log(`   Resolution: ${market.outcome || market.winner || market.winning_outcome || 'Unknown'}`);
          }
        });

        // Extract condition IDs
        const conditionIds = markets
          .slice(0, 10)
          .map(m => m.condition_id || m.conditionId)
          .filter(Boolean);

        if (conditionIds.length > 0) {
          console.log('\n\nCondition IDs for config.js:');
          console.log(JSON.stringify(conditionIds, null, 2));
        }
      }
    }

    return true;
  } catch (error) {
    console.log(`✗ Failed: ${error.message}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      if (error.response.data) {
        console.log(`  Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
    return false;
  }
}

async function findRecentMarkets() {
  console.log('Searching for recent Polymarket markets across different endpoints...\n');
  console.log('This will try multiple API endpoints to find the best source of market data.');

  let successCount = 0;

  for (const endpoint of endpoints) {
    const success = await tryEndpoint(endpoint);
    if (success) successCount++;

    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n\nSummary: ${successCount}/${endpoints.length} endpoints returned data`);

  if (successCount === 0) {
    console.log('\nTroubleshooting tips:');
    console.log('1. Check your internet connection');
    console.log('2. Polymarket APIs might require authentication for some endpoints');
    console.log('3. Try using the Polymarket TypeScript/Python client libraries');
    console.log('4. Check https://docs.polymarket.com for the latest API documentation');
  }
}

// Run the script
if (require.main === module) {
  findRecentMarkets().catch(console.error);
}

module.exports = { findRecentMarkets };