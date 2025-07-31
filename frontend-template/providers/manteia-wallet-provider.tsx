"use client";

import { createContext, useContext, ReactNode } from "react";
import { useWallet as useSuiWallet } from "@suiet/wallet-kit";
import { SuiWalletProvider } from "./sui-wallet-provider";
import { EthereumWalletProvider, useEthereumWallet } from "./ethereum-wallet-provider";

/**
 * Unified Manteia Wallet Provider
 * Combines Sui and Ethereum wallet providers for cross-chain functionality
 * Following Design.json specifications for the Manteia DEX
 */

interface ManteiaWalletContextType {
  sui: ReturnType<typeof useSuiWallet>;
  ethereum: ReturnType<typeof useEthereumWallet>;
  isAnyWalletConnected: boolean;
  areBothWalletsConnected: boolean;
}

const ManteiaWalletContext = createContext<ManteiaWalletContextType | undefined>(undefined);

interface ManteiaWalletProviderProps {
  children: ReactNode;
}

// Inner component that has access to both wallet contexts
function ManteiaWalletProviderInner({ children }: ManteiaWalletProviderProps) {
  const sui = useSuiWallet();
  const ethereum = useEthereumWallet();

  // Safely check connection status
  const isAnyWalletConnected = Boolean(sui?.connected || ethereum?.wallet?.isConnected);
  const areBothWalletsConnected = Boolean(sui?.connected && ethereum?.wallet?.isConnected);

  const value: ManteiaWalletContextType = {
    sui,
    ethereum,
    isAnyWalletConnected,
    areBothWalletsConnected,
  };

  return (
    <ManteiaWalletContext.Provider value={value}>
      {children}
    </ManteiaWalletContext.Provider>
  );
}

// Main provider component that wraps both Sui and Ethereum providers
export function ManteiaWalletProvider({ children }: ManteiaWalletProviderProps) {
  return (
    <SuiWalletProvider>
      <EthereumWalletProvider>
        <ManteiaWalletProviderInner>
          {children}
        </ManteiaWalletProviderInner>
      </EthereumWalletProvider>
    </SuiWalletProvider>
  );
}

// Hook to use the unified Manteia wallet context
export function useManteiaWallet() {
  const context = useContext(ManteiaWalletContext);
  if (context === undefined) {
    throw new Error("useManteiaWallet must be used within a ManteiaWalletProvider");
  }
  return context;
}

// Helper functions for common wallet operations
export const walletHelpers = {
  // Format address for display (following Design.json patterns)
  formatAddress: (address: string | null, length: number = 8): string => {
    if (!address) return "";
    return `${address.slice(0, length)}...${address.slice(-4)}`;
  },

  // Check if address is valid Sui address
  isSuiAddress: (address: string): boolean => {
    return address.startsWith("0x") && address.length === 66;
  },

  // Check if address is valid Ethereum address
  isEthereumAddress: (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  // Get network name for display
  getNetworkName: (chainId: number | null): string => {
    switch (chainId) {
      case 1: return "Ethereum";
      case 11155111: return "Sepolia";
      default: return "Unknown";
    }
  },

  // Get Sui network name
  getSuiNetworkName: (network: string | undefined): string => {
    switch (network) {
      case "sui:mainnet": return "Sui Mainnet";
      case "sui:testnet": return "Sui Testnet";
      case "sui:devnet": return "Sui Devnet";
      default: return "Sui";
    }
  },
};