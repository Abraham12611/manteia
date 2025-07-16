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
    // Try Gamma API first (newer API)
    let url = `${GAMMA_API_URL}/markets`;
    const params = new URLSearchParams();

    if (active) params.append('active', 'true');
    if (closed) params.append('closed', 'true');
    if (limit) params.append('limit', limit.toString());
    if (tag) params.append('tag', tag);
    if (searchTerm) params.append('search', searchTerm);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    console.log(`Fetching from: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Found ${response.data.length} markets\n`);

      response.data.forEach((market, index) => {
        console.log(`${index + 1}. ${market.title || market.question}`);
        console.log(`   ID: ${market.id || market.conditionId}`);
        console.log(`   Status: ${market.closed ? 'CLOSED' : 'ACTIVE'}`);
        console.log(`   Volume: $${market.volume || 0}`);
        console.log(`   Created: ${new Date(market.createdAt).toLocaleDateString()}`);
        if (market.endDate) {
          console.log(`   Ends: ${new Date(market.endDate).toLocaleDateString()}`);
        }
        console.log('');
      });

      // Return market IDs for easy copying
      const marketIds = response.data.map(m => m.id || m.conditionId).filter(Boolean);
      console.log('\nMarket IDs (for config.js):');
      console.log(JSON.stringify(marketIds, null, 2));

      return response.data;
    }
  } catch (error) {
    console.error('Error fetching from Gamma API:', error.message);

    // Fallback to Strapi API
    try {
      console.log('\nTrying Strapi API...');
      const strapiUrl = `${STRAPI_API_URL}/markets?_limit=${limit}&_sort=volume:DESC`;

      const strapiResponse = await axios.get(strapiUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (strapiResponse.data && Array.isArray(strapiResponse.data)) {
        console.log(`Found ${strapiResponse.data.length} markets from Strapi\n`);

        strapiResponse.data.forEach((market, index) => {
          console.log(`${index + 1}. ${market.question}`);
          console.log(`   ID: ${market.id || market.slug}`);
          console.log(`   Status: ${market.resolved ? 'RESOLVED' : 'ACTIVE'}`);
          console.log(`   Created: ${new Date(market.created_at).toLocaleDateString()}`);
          console.log('');
        });

        return strapiResponse.data;
      }
    } catch (strapiError) {
      console.error('Error fetching from Strapi API:', strapiError.message);
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