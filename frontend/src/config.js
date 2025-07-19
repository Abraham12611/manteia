import { cookieStorage, createStorage } from '@wagmi/core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mantle, mantleSepoliaTestnet } from '@reown/appkit/networks';

// Configuration file for the frontend
const config = {
  // Reown (WalletConnect) Project ID
  reownProjectId: process.env.REACT_APP_REOWN_PROJECT_ID || '6b6c11f57d9f89cfe3dfa2b98e532ab1',

  // API Endpoints
  polymarketApiUrl: process.env.REACT_APP_POLYMARKET_API_URL || 'https://clob.polymarket.com',
  marketHubAddress: process.env.REACT_APP_MARKET_HUB_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',

  // Network Configuration
  mantleRpcUrl: process.env.REACT_APP_MANTLE_RPC_URL || 'https://rpc.testnet.mantle.xyz',
  mantleChainId: parseInt(process.env.REACT_APP_MANTLE_CHAIN_ID || '5001'),
  mantleSepoliaRpcUrl: process.env.REACT_APP_MANTLE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.mantle.xyz',
  mantleSepoliaChainId: parseInt(process.env.REACT_APP_MANTLE_SEPOLIA_CHAIN_ID || '5003'),
};

// Get projectId with fallback for development
export const projectId = config.reownProjectId;

if (!projectId) {
  console.warn('⚠️ REACT_APP_REOWN_PROJECT_ID not found. Using fallback project ID.');
  console.warn('Get your project ID from https://cloud.reown.com/');
}

// Configure networks with custom RPC URLs
export const networks = [
  {
    ...mantle,
    rpcUrls: {
      default: { http: [config.mantleRpcUrl] },
      public: { http: [config.mantleRpcUrl] }
    }
  },
  {
    ...mantleSepoliaTestnet,
    rpcUrls: {
      default: { http: [config.mantleSepoliaRpcUrl] },
      public: { http: [config.mantleSepoliaRpcUrl] }
    }
  }
];

// Create wagmiAdapter following official Reown documentation pattern
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  networks,
  projectId
});

// App metadata for WalletConnect
export const metadata = {
  name: "Manteia - Cross-Chain Prediction Markets",
  description: "Trade predictions across multiple chains powered by Mantle",
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/logo192.png` : '/logo192.png']
};

export default config;