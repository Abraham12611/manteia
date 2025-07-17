const axios = require('axios');

// Polymarket API endpoints
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const STRAPI_API_URL = 'https://strapi-matic.polymarket.com';

async function findActiveMarkets(options = {}) {
  const {
    limit = 10,
    active = true,
    closed = false,
    tag = null,
    searchTerm = null
  } = options;

  console.log('Searching for Polymarket markets...\n');

  try {
    // Try CLOB API first (current API)
    const CLOB_API_URL = 'https://clob.polymarket.com';
    let url = `${CLOB_API_URL}/markets`;

    console.log(`Fetching from: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.data) {
      const markets = response.data.data || response.data;
      const marketArray = Array.isArray(markets) ? markets : [];

      console.log(`Found ${marketArray.length} markets\n`);

      // Filter and sort markets
      let filteredMarkets = marketArray;

      // Apply filters
      if (active && !closed) {
        filteredMarkets = marketArray.filter(m => !m.closed && m.active !== false);
      } else if (closed && !active) {
        filteredMarkets = marketArray.filter(m => m.closed || m.active === false);
      }

      // Apply tag filter
      if (tag && filteredMarkets.length > 0) {
        filteredMarkets = filteredMarkets.filter(m =>
          m.tags && m.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
        );
      }

      // Apply search filter
      if (searchTerm && filteredMarkets.length > 0) {
        filteredMarkets = filteredMarkets.filter(m =>
          (m.question && m.question.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (m.title && m.title.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      // Sort by volume descending
      filteredMarkets.sort((a, b) => (parseFloat(b.volume) || 0) - (parseFloat(a.volume) || 0));

      // Limit results
      const displayMarkets = filteredMarkets.slice(0, limit);

      displayMarkets.forEach((market, index) => {
        console.log(`${index + 1}. ${market.question || market.title}`);
        console.log(`   Condition ID: ${market.condition_id || market.conditionId}`);
        console.log(`   Status: ${market.closed ? 'CLOSED' : 'ACTIVE'}`);
        console.log(`   Volume: $${parseFloat(market.volume || 0).toLocaleString()}`);
        if (market.liquidity) {
          console.log(`   Liquidity: $${parseFloat(market.liquidity).toLocaleString()}`);
        }
        if (market.created_at) {
          console.log(`   Created: ${new Date(market.created_at).toLocaleDateString()}`);
        }
        if (market.end_date_iso || market.endDate) {
          console.log(`   Ends: ${new Date(market.end_date_iso || market.endDate).toLocaleDateString()}`);
        }
        console.log('');
      });

      // Return condition IDs for easy copying
      const conditionIds = displayMarkets.map(m => m.condition_id || m.conditionId).filter(Boolean);
      console.log('\nCondition IDs (for config.js):');
      console.log(JSON.stringify(conditionIds, null, 2));

      return displayMarkets;
    }
  } catch (error) {
    console.error('Error fetching markets:', error.message);

    if (error.response && error.response.status === 404) {
      console.log('\nNote: The CLOB API might require authentication or the endpoint has changed.');
      console.log('Try using the Gamma API directly or check Polymarket documentation for updates.');
    }

    // Try simplified endpoint
    try {
      console.log('\nTrying simplified markets endpoint...');
      const simplifiedUrl = 'https://clob.polymarket.com/simplified-markets';

      const simplifiedResponse = await axios.get(simplifiedUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (simplifiedResponse.data) {
        const markets = Array.isArray(simplifiedResponse.data) ? simplifiedResponse.data : [];
        console.log(`Found ${markets.length} simplified markets\n`);

        const displayMarkets = markets.slice(0, limit);
        displayMarkets.forEach((market, index) => {
          console.log(`${index + 1}. ${market.question || market.title}`);
          console.log(`   Condition ID: ${market.condition_id}`);
          console.log(`   Status: ${market.closed ? 'CLOSED' : 'ACTIVE'}`);
          if (market.volume) console.log(`   Volume: $${parseFloat(market.volume).toLocaleString()}`);
          console.log('');
        });

        return displayMarkets;
      }
    } catch (simplifiedError) {
      console.error('Error fetching simplified markets:', simplifiedError.message);
    }
  }

  return [];
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    limit: 10,
    active: true,
    closed: false
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[++i]) || 10;
        break;
      case '--all':
        options.active = true;
        options.closed = true;
        break;
      case '--closed':
        options.active = false;
        options.closed = true;
        break;
      case '--tag':
        options.tag = args[++i];
        break;
      case '--search':
        options.searchTerm = args[++i];
        break;
      case '--help':
        console.log(`
Usage: node find-polymarket-markets.js [options]

Options:
  --limit <n>      Number of markets to fetch (default: 10)
  --all            Show all markets (active and closed)
  --closed         Show only closed markets
  --tag <tag>      Filter by tag (e.g., "Politics", "Crypto")
  --search <term>  Search markets by term
  --help           Show this help message

Examples:
  node find-polymarket-markets.js --limit 5
  node find-polymarket-markets.js --tag Politics
  node find-polymarket-markets.js --search "Bitcoin"
        `);
        process.exit(0);
    }
  }

  findActiveMarkets(options).catch(console.error);
}

module.exports = { findActiveMarkets };