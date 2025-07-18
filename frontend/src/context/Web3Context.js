import React from 'react';
import { createAppKit } from '@reown/appkit/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cookieToInitialState, WagmiProvider } from 'wagmi';
import { wagmiAdapter, projectId, networks, metadata } from '../config';

// Set up queryClient
const queryClient = new QueryClient();

if (!projectId) {
  throw new Error('Project ID is not defined');
}

// Create the modal following official Reown documentation pattern
const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
    email: true,
    socials: true,
    onramp: true,
    swaps: true
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-color-mix': '#00d4ff',
    '--w3m-color-mix-strength': 40,
    '--w3m-font-family': 'Inter, sans-serif',
    '--w3m-border-radius-master': '8px',
    '--w3m-font-size-master': '12px'
  }
});

function Web3ContextProvider({ children, cookies }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig, cookies);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default Web3ContextProvider;