/**
 * Network configurations for 1inch supported chains
 * Based on 1inch official documentation and testing results
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  logoUrl: string;
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
    address: string; // 1inch uses special address for native tokens
  };
}

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    symbol: "ETH",
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/3rsrr9Elx0nFbbl_ocL2GJch1jc3aOaN",
    blockExplorer: "https://etherscan.io",
    logoUrl: "https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png",
    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    symbol: "ETH",
    rpcUrl: "https://arbitrum-one-rpc.publicnode.com",
    blockExplorer: "https://arbiscan.io",
    logoUrl: "https://tokens.1inch.io/0x912ce59144191c1204e64559fe8253a0e49e6548.png",
    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    symbol: "ETH",
    rpcUrl: "https://optimism-rpc.publicnode.com",
    blockExplorer: "https://optimistic.etherscan.io",
    logoUrl: "https://tokens.1inch.io/0x4200000000000000000000000000000000000042.png",
    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  },
  polygon: {
    chainId: 137,
    name: "Polygon",
    symbol: "MATIC",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    logoUrl: "https://tokens.1inch.io/0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0.png",
    nativeToken: {
      symbol: "MATIC",
      name: "Polygon",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  },
  base: {
    chainId: 8453,
    name: "Base",
    symbol: "ETH",
    rpcUrl: "https://base-rpc.publicnode.com",
    blockExplorer: "https://basescan.org",
    logoUrl: "https://tokens.1inch.io/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png",
    nativeToken: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  },
  bnb: {
    chainId: 56,
    name: "BNB Chain",
    symbol: "BNB",
    rpcUrl: "https://bsc-dataseed.binance.org",
    blockExplorer: "https://bscscan.com",
    logoUrl: "https://tokens.1inch.io/0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c.png",
    nativeToken: {
      symbol: "BNB",
      name: "BNB",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  },
  avalanche: {
    chainId: 43114,
    name: "Avalanche",
    symbol: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    blockExplorer: "https://snowtrace.io",
    logoUrl: "https://tokens.1inch.io/0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7.png",
    nativeToken: {
      symbol: "AVAX",
      name: "Avalanche",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  },
  gnosis: {
    chainId: 100,
    name: "Gnosis Chain",
    symbol: "xDAI",
    rpcUrl: "https://rpc.gnosischain.com",
    blockExplorer: "https://gnosisscan.io",
    logoUrl: "https://tokens.1inch.io/0xe91d153e0b41518a2ce8dd3d7944fa863463a97d.png",
    nativeToken: {
      symbol: "xDAI",
      name: "xDAI",
      decimals: 18,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    }
  }
};

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  eip2612?: boolean;
}

export interface TokenResponse {
  tokens: Record<string, Token>;
}

export interface SwapQuote {
  dstAmount: string;
  srcAmount?: string;
  protocols?: any[];
  estimatedGas?: string;
  gasPrice?: string;
}

export interface SwapTransaction {
  from: string;
  to: string;
  data: string;
  value: string;
  gasPrice: string;
  gas: string;
}

export interface SwapResponse {
  dstAmount: string;
  tx: SwapTransaction;
  protocols?: any[];
}

// Get network by chain ID
export function getNetworkByChainId(chainId: number): NetworkConfig | undefined {
  return Object.values(SUPPORTED_NETWORKS).find(network => network.chainId === chainId);
}

// Get network key by chain ID
export function getNetworkKeyByChainId(chainId: number): string | undefined {
  return Object.entries(SUPPORTED_NETWORKS).find(([_, network]) => network.chainId === chainId)?.[0];
}

// Check if chain ID is supported
export function isSupportedChainId(chainId: number): boolean {
  return Object.values(SUPPORTED_NETWORKS).some(network => network.chainId === chainId);
}

// Format token amount
export function formatTokenAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  if (num === 0) return "0";
  if (num < 0.000001) return "< 0.000001";
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  if (num < 1000000) return (num / 1000).toFixed(2) + "K";
  return (num / 1000000).toFixed(2) + "M";
}

// Parse token amount to smallest unit
export function parseTokenAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";
  return (num * Math.pow(10, decimals)).toFixed(0);
}