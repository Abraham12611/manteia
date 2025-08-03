"use client";

import { useEffect, useState } from "react";
import { WalletStatusDisplay } from "@/components/wallet-status-display";
import { useManteiaApi } from "@/hooks/use-manteia-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  ArrowUpDown,
  TrendingUp,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from "lucide-react";

/**
 * Manteia Dashboard Homepage
 * Following Design.json specifications for layout and styling
 */

export default function HomePage() {
  const { checkHealth } = useManteiaApi();
  const [backendStatus, setBackendStatus] = useState<{
    status: string;
    services: { sui: boolean; ethereum: boolean; oneInch: boolean };
  } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Check backend health on mount
  useEffect(() => {
    const checkBackendHealth = async () => {
      setIsCheckingHealth(true);
      const { data, error } = await checkHealth();
      if (data) {
        setBackendStatus(data);
      } else if (error) {
        // Show error state - backend is unreachable
        setBackendStatus({
          status: "error",
          services: { sui: false, ethereum: false, oneInch: false }
        });
      }
      setIsCheckingHealth(false);
    };

    checkBackendHealth();
  }, [checkHealth]);

  return (
    <div className="flex h-svh">
      {/* Main Content */}
      <main className="overflow-auto px-4 md:px-6 lg:px-8 flex-1">
        {/* Header */}
        <header className="bg-sidebar/90 backdrop-blur-sm sticky top-0 z-50 -mx-2 px-2">
          <div className="flex shrink-0 items-center gap-2 border-b py-4 w-full max-w-7xl mx-auto">
            <div className="flex-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-to bg-clip-text text-transparent">
                Manteia
              </h1>
              <p className="text-sm text-muted-foreground">
                Cross-chain DEX Aggregator powered by 1inch & Sui
              </p>
            </div>
            <WalletStatusDisplay />
          </div>
        </header>

        {/* Content */}
        <div className="flex max-lg:flex-col flex-1 gap-6 py-6 w-full max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="space-y-6">
            {/* Welcome Card */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary-to/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary-to flex items-center justify-center">
                    <ArrowUpDown className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Welcome to Manteia</CardTitle>
                    <CardDescription>
                      Experience seamless cross-chain swaps between Ethereum and Sui networks
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="font-medium text-sm">Lightning Fast</p>
                      <p className="text-xs text-muted-foreground">Optimized routing</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-sm">Best Rates</p>
                      <p className="text-xs text-muted-foreground">1inch aggregation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                    <Activity className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">Cross-chain</p>
                      <p className="text-xs text-muted-foreground">Ethereum ↔ Sui</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="flex-1" size="lg">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Start Trading
                  </Button>
                  <Button variant="outline" size="lg" className="flex-1">
                    Learn More
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Volume</p>
                      <p className="text-2xl font-bold">$0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Swaps</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Active Users</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                      <ArrowUpDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Cross-chain</p>
                      <p className="text-2xl font-bold">0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:w-80 space-y-6">
            {/* Backend Status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">System Status</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setIsCheckingHealth(true);
                      const { data, error } = await checkHealth();
                      if (data) {
                        setBackendStatus(data);
                      } else if (error) {
                        // Show error state - backend is unreachable
                        setBackendStatus({
                          status: "error",
                          services: { sui: false, ethereum: false, oneInch: false }
                        });
                      }
                      setIsCheckingHealth(false);
                    }}
                    disabled={isCheckingHealth}
                  >
                    <RefreshCw className={`h-3 w-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {backendStatus ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Backend API</span>
                      <Badge
                        variant={backendStatus.status === "healthy" ? "secondary" : "destructive"}
                        className={backendStatus.status === "healthy"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : ""
                        }
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {backendStatus.status}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Sui Network</span>
                        <div className={`h-2 w-2 rounded-full ${
                          backendStatus?.services?.sui ? "bg-green-500" : "bg-red-500"
                        }`} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Ethereum Network</span>
                        <div className={`h-2 w-2 rounded-full ${
                          backendStatus?.services?.ethereum ? "bg-green-500" : "bg-red-500"
                        }`} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">1inch Integration</span>
                        <div className={`h-2 w-2 rounded-full ${
                          backendStatus?.services?.oneInch ? "bg-green-500" : "bg-red-500"
                        }`} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Checking status...</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" className="w-full justify-start" size="sm">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Swap Tokens
                </Button>
                <Button variant="ghost" className="w-full justify-start" size="sm">
                  <Activity className="h-4 w-4 mr-2" />
                  Transaction History
                </Button>
                <Button variant="ghost" className="w-full justify-start" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
                <Separator />
                <Button variant="ghost" className="w-full justify-start" size="sm">
                  Documentation
                </Button>
                <Button variant="ghost" className="w-full justify-start" size="sm">
                  Support
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}