"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Alchemy, Network } from "alchemy-sdk";
import { ethers, BrowserProvider } from "ethers";

/**
 * Ethereum Wallet Provider Component
 * Based on official Alchemy SDK documentation
 * @see https://github.com/alchemyplatform/alchemy-sdk-js
 */

interface EthereumWallet {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}

interface AlchemyConfig {
  apiKey: string;
  network: Network;
}

interface EthereumWalletContextType {
  wallet: EthereumWallet;
  alchemy: Alchemy | null;
  isLoading: boolean;
  error: string | null;
}

const EthereumWalletContext = createContext<EthereumWalletContextType | undefined>(undefined);

// Supported networks for Manteia
const SUPPORTED_NETWORKS = {
  [Network.ETH_SEPOLIA]: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
  },
  [Network.ETH_MAINNET]: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
  },
};

interface EthereumWalletProviderProps {
  children: ReactNode;
}

export function EthereumWalletProvider({ children }: EthereumWalletProviderProps) {
  const [wallet, setWallet] = useState<EthereumWallet>({
    address: null,
    isConnected: false,
    chainId: null,
    provider: null,
    signer: null,
    connect: async () => {},
    disconnect: () => {},
    switchNetwork: async () => {},
  });

  const [alchemy, setAlchemy] = useState<Alchemy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Alchemy SDK
  useEffect(() => {
    const alchemyConfig: AlchemyConfig = {
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo",
      network: Network.ETH_SEPOLIA, // Default to Sepolia testnet
    };

    const alchemyInstance = new Alchemy(alchemyConfig);
    setAlchemy(alchemyInstance);
  }, []);

  // Connect to MetaMask/Ethereum wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setWallet(prev => ({
        ...prev,
        address,
        isConnected: true,
        chainId: Number(network.chainId),
        provider,
        signer,
      }));
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWallet(prev => ({
      ...prev,
      address: null,
      isConnected: false,
      chainId: null,
      provider: null,
      signer: null,
    }));
    setError(null);
  };

  // Switch network
  const switchNetwork = async (targetChainId: number) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        // Network not added to wallet
        setError("Please add this network to your wallet first.");
      } else {
        setError(err.message || "Failed to switch network");
      }
    }
  };

  // Update wallet methods
  useEffect(() => {
    setWallet(prev => ({
      ...prev,
      connect: connectWallet,
      disconnect: disconnectWallet,
      switchNetwork,
    }));
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== wallet.address) {
        // Reconnect with new account
        connectWallet();
      }
    };

    const handleChainChanged = (chainId: string) => {
      setWallet(prev => ({
        ...prev,
        chainId: parseInt(chainId, 16),
      }));
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [wallet.address]);

  const value: EthereumWalletContextType = {
    wallet,
    alchemy,
    isLoading,
    error,
  };

  return (
    <EthereumWalletContext.Provider value={value}>
      {children}
    </EthereumWalletContext.Provider>
  );
}

// Hook to use Ethereum wallet context
export function useEthereumWallet() {
  const context = useContext(EthereumWalletContext);
  if (context === undefined) {
    throw new Error("useEthereumWallet must be used within an EthereumWalletProvider");
  }
  return context;
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}