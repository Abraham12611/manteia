"use client";

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS, Token, formatTokenAmount } from '@/lib/networks';
import { useManteiaWallet } from '@/providers/manteia-wallet-provider';

interface TokenBalance {
  token: Token;
  balance: string;
  formattedBalance: string;
  usdValue?: string;
}

interface UseWalletBalancesReturn {
  balances: Record<string, TokenBalance[]>; // chainId -> balances
  isLoading: boolean;
  error: string | null;
  refreshBalances: (chainId?: number) => Promise<void>;
  getTokenBalance: (chainId: number, tokenAddress: string) => TokenBalance | null;
  getNativeBalance: (chainId: number) => TokenBalance | null;
}

export function useWalletBalances(): UseWalletBalancesReturn {
  const { ethereum } = useManteiaWallet();
  const [balances, setBalances] = useState<Record<string, TokenBalance[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ERC20 ABI for balance checking
  const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
  ];

  // Get provider for specific chain
  const getProvider = useCallback((chainId: number) => {
    const network = Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId);
    if (!network) return null;

    return new ethers.JsonRpcProvider(network.rpcUrl);
  }, []);

  // Get native token balance
  const getNativeBalance = useCallback(async (
    chainId: number,
    walletAddress: string,
    provider: ethers.JsonRpcProvider
  ): Promise<TokenBalance | null> => {
    try {
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId);
      if (!network) return null;

      const balance = await provider.getBalance(walletAddress);
      const balanceStr = balance.toString();
      const formattedBalance = formatTokenAmount(balanceStr, network.nativeToken.decimals);

      return {
        token: {
          address: network.nativeToken.address,
          symbol: network.nativeToken.symbol,
          name: network.nativeToken.name,
          decimals: network.nativeToken.decimals,
          logoURI: network.logoUrl
        },
        balance: balanceStr,
        formattedBalance
      };
    } catch (error) {
      console.error(`Failed to get native balance for chain ${chainId}:`, error);
      return null;
    }
  }, []);

  // Get ERC20 token balance
  const getERC20Balance = useCallback(async (
    token: Token,
    walletAddress: string,
    provider: ethers.JsonRpcProvider
  ): Promise<TokenBalance | null> => {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance = await contract.balanceOf(walletAddress);
      const balanceStr = balance.toString();
      const formattedBalance = formatTokenAmount(balanceStr, token.decimals);

      return {
        token,
        balance: balanceStr,
        formattedBalance
      };
    } catch (error) {
      console.error(`Failed to get balance for token ${token.symbol}:`, error);
      return null;
    }
  }, []);

  // Refresh balances for specific chain or all chains
  const refreshBalances = useCallback(async (chainId?: number) => {
    if (!ethereum.wallet.isConnected || !ethereum.wallet.address) {
      setBalances({});
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const chainsToUpdate = chainId
        ? [chainId]
        : Object.values(SUPPORTED_NETWORKS).map(n => n.chainId);

      const newBalances = { ...balances };

      for (const targetChainId of chainsToUpdate) {
        const provider = getProvider(targetChainId);
        if (!provider) continue;

        const chainBalances: TokenBalance[] = [];

        // Get native token balance
        const nativeBalance = await getNativeBalance(targetChainId, ethereum.wallet.address, provider);
        if (nativeBalance) {
          chainBalances.push(nativeBalance);
        }

        // For now, we'll focus on native tokens and major stablecoins
        // In production, you'd fetch all tokens from 1inch API and check balances
        const majorTokens: Partial<Record<number, Token[]>> = {
          1: [ // Ethereum
            {
              address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 6,
              logoURI: 'https://tokens.1inch.io/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png'
            },
            {
              address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
              symbol: 'USDT',
              name: 'Tether USD',
              decimals: 6,
              logoURI: 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png'
            }
          ],
          42161: [ // Arbitrum
            {
              address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
              symbol: 'USDC.e',
              name: 'USD Coin (Arb1)',
              decimals: 6,
              logoURI: 'https://tokens.1inch.io/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8.png'
            },
            {
              address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
              symbol: 'ARB',
              name: 'Arbitrum',
              decimals: 18,
              logoURI: 'https://tokens.1inch.io/0x912ce59144191c1204e64559fe8253a0e49e6548.png'
            }
          ]
        };

        const tokens = majorTokens[targetChainId] || [];
        for (const token of tokens) {
          const balance = await getERC20Balance(token, ethereum.wallet.address, provider);
          if (balance && parseFloat(balance.balance) > 0) {
            chainBalances.push(balance);
          }
        }

        newBalances[targetChainId.toString()] = chainBalances;
      }

      setBalances(newBalances);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch balances');
    } finally {
      setIsLoading(false);
    }
  }, [ethereum.wallet.isConnected, ethereum.wallet.address, getProvider, getNativeBalance, getERC20Balance]);

  // Get specific token balance
  const getTokenBalance = useCallback((chainId: number, tokenAddress: string): TokenBalance | null => {
    const chainBalances = balances[chainId.toString()] || [];
    return chainBalances.find(b => b.token.address.toLowerCase() === tokenAddress.toLowerCase()) || null;
  }, [balances]);

  // Get native token balance for chain
  const getNativeBalanceForChain = useCallback((chainId: number): TokenBalance | null => {
    const network = Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId);
    if (!network) return null;

    return getTokenBalance(chainId, network.nativeToken.address);
  }, [getTokenBalance]);

  // Auto-refresh when wallet connects
  useEffect(() => {
    if (ethereum.wallet.isConnected && ethereum.wallet.address) {
      refreshBalances();
    } else {
      setBalances({});
    }
  }, [ethereum.wallet.isConnected, ethereum.wallet.address]);

  return {
    balances,
    isLoading,
    error,
    refreshBalances,
    getTokenBalance,
    getNativeBalance: getNativeBalanceForChain
  };
}