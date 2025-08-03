"use client";

import { SwapInterface } from "@/components/swap-interface";
import { WalletStatusDisplay } from "@/components/wallet-status-display";
import { WalletBalanceDisplay } from "@/components/wallet-balance-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUpDown,
  TrendingUp,
  Zap,
  Info,
  ExternalLink,
  Activity,
  Timer,
  Shield
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
                Trade tokens across Ethereum and Sui with best execution
              </p>
            </div>
            <WalletStatusDisplay />
          </div>
        </header>

        {/* Content */}
        <div className="flex max-lg:flex-col flex-1 gap-6 py-6 w-full max-w-7xl mx-auto">
          {/* Main Swap Interface */}
          <div className="lg:flex-1 space-y-6">
            {/* Swap Component */}
            <SwapInterface />

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
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Cross-Chain</p>
                      <p className="text-sm text-muted-foreground">Ethereum ↔ Sui atomic swaps</p>
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
                      <p className="font-medium">Trustless</p>
                      <p className="text-sm text-muted-foreground">Hash time-locked contracts</p>
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
                    <span className="font-medium">$2.4M</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Pools</span>
                    <span className="font-medium">47</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cross-chain Swaps</span>
                    <span className="font-medium">156</span>
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

            {/* Cross-Chain Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cross-Chain Swaps</CardTitle>
                <CardDescription>
                  Powered by 1inch Fusion+ and hash time-locked contracts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Timer className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Fast Execution</p>
                      <p className="text-xs text-muted-foreground">~5-10 minute settlement</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Trustless</p>
                      <p className="text-xs text-muted-foreground">No custodial risk</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">Atomic</p>
                      <p className="text-xs text-muted-foreground">All-or-nothing execution</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <Button variant="outline" className="w-full justify-start" size="sm">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Learn about HTLC security
                </Button>
              </CardContent>
            </Card>

                        {/* Wallet Balances */}
            <WalletBalanceDisplay />

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Swaps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-3 w-3" />
                      <span>ETH → SUI</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">1.2 ETH</p>
                      <p className="text-xs text-muted-foreground">2m ago</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-3 w-3" />
                      <span>USDC → USDT</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">5,000 USDC</p>
                      <p className="text-xs text-muted-foreground">5m ago</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-3 w-3" />
                      <span>SUI → ETH</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">2,500 SUI</p>
                      <p className="text-xs text-muted-foreground">8m ago</p>
                    </div>
                  </div>
                </div>

                <Button variant="ghost" className="w-full" size="sm">
                  View All Activity
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}