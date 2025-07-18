// Example configuration for the resolution bot
module.exports = {
  // Mantle Sepolia Configuration
  mantleRpcUrl: 'https://rpc.testnet.mantle.xyz',
  privateKey: process.env.PRIVATE_KEY || 'your_private_key_here',

  // Contract Addresses (Update these after deployment)
  marketHubAddress: process.env.MARKET_HUB_ADDRESS || '0x2B6CD3afED7e454bA715Ae04376cBE4639419946',

  // Polymarket Configuration
  polymarketApiUrl: 'https://clob.polymarket.com',
  polymarketStrapiUrl: 'https://strapi-matic.polymarket.com',

  // Resolution Bot Configuration
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000'), // Poll every 60 seconds
  marketsToTrack: process.env.MARKETS_TO_TRACK ?
    process.env.MARKETS_TO_TRACK.split(',') :
    ['0x5f65177b394277fd294cd75650044e32ba009a95022022b4b5f60c9750f7a21c'], // Example market ID

  // Rate limiting
  maxRequestsPerMinute: 60,
  requestDelayMs: 1100, // Delay between requests to respect rate limits
};