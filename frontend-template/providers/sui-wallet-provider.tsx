"use client";

import {
  WalletProvider,
  Chain,
  SuiDevnetChain,
  SuiTestnetChain,
  SuiMainnetChain,
} from "@suiet/wallet-kit";

/**
 * Sui Wallet Provider Component
 * Based on official Suiet Wallet Kit documentation
 * @see https://kit.suiet.app/docs/tutorial/configure-chain
 */

// Define supported Sui chains for Manteia
const SupportedSuiChains: Chain[] = [
  SuiTestnetChain, // Primary chain for development
  SuiDevnetChain,  // For development testing
  SuiMainnetChain, // For production (future)
];

interface SuiWalletProviderProps {
  children: React.ReactNode;
}

export function SuiWalletProvider({ children }: SuiWalletProviderProps) {
  return (
    <WalletProvider
      chains={SupportedSuiChains}
      autoConnect={true}
      enableSuiNS={true}
    >
      {children}
    </WalletProvider>
  );
}