"use client";

import { OneInchSwapInterface } from "@/components/one-inch-swap-interface";
import { UnifiedSwapInterface } from "@/components/unified-swap-interface";
import { SwapHistory } from "@/components/swap-history";
import { WalletStatusDisplay } from "@/components/wallet-status-display";
import { MultiNetworkWalletBalance } from "@/components/multi-network-wallet-balance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpDown,
  TrendingUp,
  Zap,
  Info,
  ExternalLink,
  Activity,
  Timer,
  Shield,
  Globe
} from "lucide-react";

/**
 * Manteia Swap Page
 * Main trading interface replicating Magma Finance functionality
 * Following Design.json specifications and layout patterns
 */

export default function SwapPage() {
  return (
    <div className="flex h-svh">
      {/* Main Content */}
      <main className="overflow-auto px-4 md:px-6 lg:px-8 flex-1">
        {/* Header */}
        <header className="bg-sidebar/90 backdrop-blur-sm sticky top-0 z-50 -mx-2 px-2">
          <div className="flex shrink-0 items-center gap-2 border-b py-4 w-full max-w-7xl mx-auto">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Swap</h1>
              <p className="text-sm text-muted-foreground">
                Trade tokens across multiple networks with cross-chain swaps via 1inch, Cetus & Wormhole
              </p>
            </div>
            <WalletStatusDisplay />
          </div>
        </header>

        {/* Content */}
        <div className="flex max-lg:flex-col flex-1 gap-6 py-6 w-full max-w-7xl mx-auto">
          {/* Main Swap Interface */}
          <div className="lg:flex-1 space-y-6">
            {/* Swap Interface Tabs */}
            <Tabs defaultValue="unified" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="unified" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Cross-Chain Swap
                </TabsTrigger>
                <TabsTrigger value="1inch" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  1inch Aggregator
                </TabsTrigger>
              </TabsList>

              <TabsContent value="unified" className="space-y-6">
                <UnifiedSwapInterface />
              </TabsContent>

              <TabsContent value="1inch" className="space-y-6">
                <OneInchSwapInterface />
              </TabsContent>
            </Tabs>

            {/* Features Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Best Rates</p>
                      <p className="text-sm text-muted-foreground">Aggregated from multiple DEXes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Cross-Chain</p>
                      <p className="text-sm text-muted-foreground">Ethereum, Arbitrum, Sui & more</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">Secure</p>
                      <p className="text-sm text-muted-foreground">1inch + Wormhole + Cetus security</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:w-80 space-y-6">
            {/* Market Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Market Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">24h Volume</span>
                    <span className="font-medium">$3.2M</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Pools</span>
                    <span className="font-medium">89</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cross-chain Swaps</span>
                    <span className="font-medium">342</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Popular Pairs</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>ETH/USDC</span>
                      <Badge variant="secondary">0.05%</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>SUI/USDC</span>
                      <Badge variant="secondary">0.25%</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>ETH/SUI</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Cross-chain
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>ARB/CETUS</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Cross-chain
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fee Tiers Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fee Tiers</CardTitle>
                <CardDescription>
                  Choose the optimal fee tier for your trading pair
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Best Stable</p>
                      <p className="text-xs text-muted-foreground">Stablecoin pairs</p>
                    </div>
                    <Badge variant="outline">0.01%</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Concentrated Stable</p>
                      <p className="text-xs text-muted-foreground">Low volatility</p>
                    </div>
                    <Badge variant="outline">0.05%</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Most Pairs</p>
                      <p className="text-xs text-muted-foreground">Standard trading</p>
                    </div>
                    <Badge variant="outline">0.25%</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Exotic Pairs</p>
                      <p className="text-xs text-muted-foreground">High volatility</p>
                    </div>
                    <Badge variant="outline">1.00%</Badge>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <p>
                    Fee distribution: 80% to liquidity providers, 20% to protocol treasury
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Technology Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Unified Swap Technology</CardTitle>
                <CardDescription>
                  Cross-chain swaps with 1inch, Cetus & Wormhole
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Cross-Chain</p>
                      <p className="text-xs text-muted-foreground">Wormhole Bridge for token transfer</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Zap className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Best Rates</p>
                      <p className="text-xs text-muted-foreground">1inch aggregation + Cetus pools</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">Secure</p>
                      <p className="text-xs text-muted-foreground">Multi-protocol security</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <Button variant="outline" className="w-full justify-start" size="sm">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Learn about Cross-Chain Swaps
                </Button>
              </CardContent>
            </Card>

                        {/* Wallet Balances */}
            <MultiNetworkWalletBalance />

            {/* Swap History */}
            <SwapHistory limit={5} />
          </aside>
        </div>
      </main>
    </div>
  );
}