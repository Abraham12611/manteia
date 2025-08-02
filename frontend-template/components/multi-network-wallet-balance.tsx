"use client";

import { useState } from "react";
import { useMultiNetworkBalances } from "@/hooks/use-multi-network-balances";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { SUPPORTED_NETWORKS } from "@/lib/networks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  RefreshCw,
  Wallet,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp
} from "lucide-react";

export function MultiNetworkWalletBalance() {
  const { ethereum } = useManteiaWallet();
  const { balances, isLoading, refreshAllBalances, getNetworkBalance } = useMultiNetworkBalances();
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set(['ethereum']));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAllBalances();
    setIsRefreshing(false);
  };

  const toggleNetwork = (networkKey: string) => {
    setExpandedNetworks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(networkKey)) {
        newSet.delete(networkKey);
      } else {
        newSet.add(networkKey);
      }
      return newSet;
    });
  };

  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const openBlockExplorer = (address: string, networkKey: string) => {
    const network = SUPPORTED_NETWORKS[networkKey];
    if (!network) return;

    const explorerUrl = `${network.blockExplorer}/address/${address}`;
    window.open(explorerUrl, '_blank');
  };

  if (!ethereum.wallet.isConnected) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Connect your wallet to view balances</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Portfolio
            </CardTitle>
            <CardDescription>
              Multi-network wallet balances
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Wallet Address */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium">Connected Wallet</p>
            <p className="text-xs text-muted-foreground">
              {formatAddress(ethereum.wallet.address || '')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openBlockExplorer(ethereum.wallet.address || '', 'ethereum')}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        <Separator />

        {/* Network Balances */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {Object.entries(SUPPORTED_NETWORKS).map(([networkKey, network]) => {
              const networkBalance = getNetworkBalance(networkKey);
              const isExpanded = expandedNetworks.has(networkKey);
              const hasBalance = networkBalance?.nativeBalance || (networkBalance?.tokenBalances?.length || 0) > 0;

              return (
                <div key={networkKey} className="border rounded-lg">
                  {/* Network Header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => toggleNetwork(networkKey)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={network.logoUrl} alt={network.name} />
                        <AvatarFallback>{network.symbol}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{network.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {networkBalance?.isLoading ? 'Loading...' :
                           networkBalance?.error ? 'Error' :
                           hasBalance ? `${(networkBalance?.tokenBalances?.length || 0) + (networkBalance?.nativeBalance ? 1 : 0)} tokens` : 'No balance'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {networkBalance?.isLoading && (
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {networkBalance?.error && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant="outline">
                        {network.symbol}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Network Details */}
                  {isExpanded && (
                    <div className="border-t p-3 space-y-2">
                      {networkBalance?.isLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : networkBalance?.error ? (
                        <div className="text-center py-4">
                          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {networkBalance.error}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Native Token Balance */}
                          {networkBalance?.nativeBalance && (
                            <div className="flex items-center justify-between p-2 rounded bg-muted/20">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={networkBalance.nativeBalance.token.logoURI} alt={networkBalance.nativeBalance.token.symbol} />
                                  <AvatarFallback className="text-xs">{networkBalance.nativeBalance.token.symbol}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{networkBalance.nativeBalance.token.symbol}</p>
                                  <p className="text-xs text-muted-foreground">{networkBalance.nativeBalance.token.name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{networkBalance.nativeBalance.formattedBalance}</p>
                                <p className="text-xs text-muted-foreground">Native</p>
                              </div>
                            </div>
                          )}

                          {/* ERC20 Token Balances */}
                          {networkBalance?.tokenBalances?.map((tokenBalance, index) => (
                            <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/20">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={tokenBalance.token.logoURI} alt={tokenBalance.token.symbol} />
                                  <AvatarFallback className="text-xs">{tokenBalance.token.symbol[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{tokenBalance.token.symbol}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-24">{tokenBalance.token.name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{tokenBalance.formattedBalance}</p>
                                <p className="text-xs text-muted-foreground">ERC20</p>
                              </div>
                            </div>
                          ))}

                          {/* No Balance Message */}
                          {!networkBalance?.nativeBalance && (networkBalance?.tokenBalances?.length || 0) === 0 && (
                            <div className="text-center py-4 text-muted-foreground">
                              <p className="text-sm">No tokens found</p>
                              <p className="text-xs">Tokens with balance will appear here</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Portfolio Summary */}
        <Separator />
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Portfolio Value</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">$0.00</p>
            <p className="text-xs text-muted-foreground">USD</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}