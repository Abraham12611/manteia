"use client";

import { useState } from "react";
import { useEnhancedWalletBalances } from "@/hooks/use-enhanced-wallet-balances";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Wallet,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";

/**
 * Enhanced Wallet Balance Display Component
 * Shows real balances from both Ethereum and Sui chains
 * Uses 1inch Balance API and Alchemy SDK for comprehensive token data
 * Supports both ready wallet balances and comprehensive token discovery
 */

export function WalletBalanceDisplay() {
  const { balances, refreshBalances, isLoading, hasErrors } = useEnhancedWalletBalances();
  const [showEthereumTokens, setShowEthereumTokens] = useState(false);
  const [showSuiTokens, setShowSuiTokens] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalances();
    setIsRefreshing(false);
  };

  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const openBlockExplorer = (address: string, chain: "ethereum" | "sui") => {
    const explorerUrls = {
      ethereum: `https://sepolia.etherscan.io/token/${address}`,
      sui: `https://suiexplorer.com/object/${address}?network=testnet`
    };
    window.open(explorerUrls[chain], '_blank');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Balances
            </CardTitle>
            <CardDescription>
              Real-time balances using 1inch Balance API & Alchemy SDK
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Ethereum Balances */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Ethereum (Sepolia)</h3>
            {balances.ethereum?.error && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Error
              </Badge>
            )}
          </div>

          {balances.ethereum?.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : balances.ethereum?.error ? (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4">
                <p className="text-sm text-destructive">{balances.ethereum.error}</p>
              </CardContent>
            </Card>
          ) : balances.ethereum?.native ? (
            <div className="space-y-3">
              {/* Native ETH Balance */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                        ETH
                      </div>
                      <div>
                        <p className="font-medium">{balances.ethereum?.native?.name || 'Ethereum'}</p>
                        <p className="text-sm text-muted-foreground">{balances.ethereum?.native?.symbol || 'ETH'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{balances.ethereum?.native?.formattedBalance || '0.0'}</p>
                      <p className="text-sm text-muted-foreground">Native</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ERC-20 Tokens */}
              {(balances.ethereum?.tokens?.length || 0) > 0 && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => setShowEthereumTokens(!showEthereumTokens)}
                    className="w-full justify-between h-auto p-2"
                  >
                    <span className="text-sm">
                      ERC-20 Tokens ({balances.ethereum?.tokens?.length || 0})
                    </span>
                    {showEthereumTokens ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  {showEthereumTokens && (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {(balances.ethereum?.tokens || []).map((token, index) => (
                          <Card key={`${token.address}-${index}`} className="bg-background">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {token.logo ? (
                                    <img
                                      src={token.logo}
                                      alt={token.symbol}
                                      className="h-6 w-6 rounded-full"
                                    />
                                  ) : (
                                    <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                                      {token.symbol?.slice(0, 2) || '?'}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{token.symbol}</p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                                      onClick={() => openBlockExplorer(token.address, "ethereum")}
                                    >
                                      {formatAddress(token.address)}
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </Button>
                                    <p className="text-xs text-muted-foreground">via {token.source}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">{token.formattedBalance}</p>
                                  <p className="text-xs text-muted-foreground">{token.name}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p>No Ethereum wallet connected</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Sui Balances */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sui (Testnet)</h3>
            {balances.sui?.error && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Error
              </Badge>
            )}
          </div>

          {balances.sui?.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : balances.sui?.error ? (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4">
                <p className="text-sm text-destructive">{balances.sui.error}</p>
              </CardContent>
            </Card>
          ) : balances.sui?.native ? (
            <div className="space-y-3">
              {/* Native SUI Balance */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                        SUI
                      </div>
                      <div>
                        <p className="font-medium">{balances.sui?.native?.name || 'Sui'}</p>
                        <p className="text-sm text-muted-foreground">{balances.sui?.native?.symbol || 'SUI'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{balances.sui?.native?.formattedBalance || '0.0'}</p>
                      <p className="text-sm text-muted-foreground">Native</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Other Sui Tokens */}
              {(balances.sui?.tokens?.length || 0) > 0 && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => setShowSuiTokens(!showSuiTokens)}
                    className="w-full justify-between h-auto p-2"
                  >
                    <span className="text-sm">
                      Sui Tokens ({balances.sui?.tokens?.length || 0})
                    </span>
                    {showSuiTokens ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  {showSuiTokens && (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {(balances.sui?.tokens || []).map((token, index) => (
                          <Card key={`${token.address}-${index}`} className="bg-background">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {token.logo ? (
                                    <img
                                      src={token.logo}
                                      alt={token.symbol}
                                      className="h-6 w-6 rounded-full"
                                    />
                                  ) : (
                                    <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                                      {token.symbol?.slice(0, 2) || '?'}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{token.symbol}</p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                                      onClick={() => openBlockExplorer(token.address, "sui")}
                                    >
                                      {formatAddress(token.address)}
                                      <ExternalLink className="h-3 w-3 ml-1" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">{token.formattedBalance}</p>
                                  <p className="text-xs text-muted-foreground">{token.name}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p>No Sui wallet connected</p>
            </div>
          )}
        </div>

        {/* Summary */}
        {(balances.ethereum?.native || balances.sui?.native) && (
          <>
            <Separator />
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Balances update automatically every 30 seconds
              </p>
              {hasErrors && (
                <p className="text-destructive mt-1">
                  Some balances failed to load. Check your API configuration.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}