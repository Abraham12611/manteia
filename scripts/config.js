// Configuration for the resolution bot
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  // Mantle Sepolia Configuration
  mantleRpcUrl: process.env.MANTLE_RPC_URL || 'https://rpc.testnet.mantle.xyz',
  privateKey: process.env.PRIVATE_KEY || 'your_private_key_here',

  // Contract Addresses (Update these after deployment)
  marketHubAddress: process.env.MARKET_HUB_ADDRESS || '0x2B6CD3afED7e454bA715Ae04376cBE4639419946',

    // Polymarket Configuration
  polymarketApiUrl: 'https://clob.polymarket.com',

  // Resolution Bot Configuration
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000'), // Poll every 60 seconds
  marketsToTrack: process.env.MARKETS_TO_TRACK ?
    process.env.MARKETS_TO_TRACK.split(',') :
    [
      // Example Polymarket condition IDs
      // Run 'npm run markets:find' to get current market condition IDs
      // These are example IDs - replace with actual ones:
      // '0xbd31dc8a20211944f6b70f31557f1001557b59905b7738480ca09bd4532f84af',
      // Add more condition IDs here

      "0x9deb0baac40648821f96f01339229a422e2f5c877de55dc4dbf981f95a1e709c",
      "0x5317986240be3ab100ccbebeb8213ab45d1f5c502e6da17e1c9b30f9c6dcb52c",
      "0x3d23087a0ed34ca1577afb1ae860714e9deddc8ff3cbfc5c15929c1472c59203",
      "0x9831cf4e59285e5487e788d8a1435cb4753b9076a38512848ac1488348192f27",
      "0x92e46e922e9f87353535007c0e254ec43fc97c84a4a9a11a135d6c8d5c1ddf3d",
      "0x81d356ed5d42b84038a414187a8bb64afb597946c89c629220a98736bea25421",
      "0x2a5cf651ddefca0f57f09a3eee5e1ec7372012453deb8aeada73bd0e80710123",
      "0x4f036df28c705bf2e02318dac9e82fe3da62c682a238d37f16e389737dccafc6",
      "0x7bc9c1311924e8dc2907dc00591b3d9528683f75924b99c436cca16dca39a28d",
      "0x9deb0baac40648821f96f01339229a422e2f5c877de55dc4dbf981f95a1e709c",
      "0x5317986240be3ab100ccbebeb8213ab45d1f5c502e6da17e1c9b30f9c6dcb52c",
      "0x3d23087a0ed34ca1577afb1ae860714e9deddc8ff3cbfc5c15929c1472c59203",
      "0x9831cf4e59285e5487e788d8a1435cb4753b9076a38512848ac1488348192f27",
      "0x92e46e922e9f87353535007c0e254ec43fc97c84a4a9a11a135d6c8d5c1ddf3d",
      "0x81d356ed5d42b84038a414187a8bb64afb597946c89c629220a98736bea25421",
      "0x2a5cf651ddefca0f57f09a3eee5e1ec7372012453deb8aeada73bd0e80710123",
      "0x4f036df28c705bf2e02318dac9e82fe3da62c682a238d37f16e389737dccafc6",
      "0x7bc9c1311924e8dc2907dc00591b3d9528683f75924b99c436cca16dca39a28d",
      "0x54aa78996a9d9780a6d7f5a9ca68b4af1fb2d1c19a3014eb0d16f8af3762eec8",
      "0x36d210ed510c75bd212b1eab44e06906f274b61e0f421229dc14316ec8059f6a",
      "0x641c8b680947405e097da700c54f344556bb59e2093acdf1576c1c68e795bddf",
      "0x4c361790c1f559ef282febae1bad1a95897df97f087bf24e483d963c6fc4cc65",
      "0x6955e20da36c2ae43568b63b3491a4f7d4f7d528f0408909b91ed7c3e74d42db",
      "0x78eec7643cfcef645acabbb6b0e25c94ee6ed750bdc2910f1e57838017659535",
      "0xb51f2db5996c86c3fdbac6d67d0fdead997d959ce0d86bad5203d16ee746da17",
      "0x483d2b4daa159d442b20a5389402af17af98232dd68a9203ac73bd1713791e71",
    ],

  // Rate limiting
  maxRequestsPerMinute: 60,
  requestDelayMs: 1100, // Delay between requests to respect rate limits
};