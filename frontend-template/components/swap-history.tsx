"use client";

import { useState, useEffect } from "react";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpDown,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Filter
} from "lucide-react";

/**
 * Swap History Component
 * Displays user's cross-chain swap history with status tracking
 */

interface SwapHistoryItem {
  id: string;
  fromChain: "ethereum" | "sui";
  toChain: "ethereum" | "sui";
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  transactions: {
    ethereum?: string;
    sui?: string;
    bridge?: string;
  };
  error?: string;
}

interface SwapHistoryProps {
  limit?: number;
  showHeader?: boolean;
}

export function SwapHistory({ limit = 10, showHeader = true }: SwapHistoryProps) {
  const { sui, ethereum, isAnyWalletConnected } = useManteiaWallet();
  const [swapHistory, setSwapHistory] = useState<SwapHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "pending" | "failed">("all");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://84.32.100.59:3001";

  // Fetch swap history
  const fetchSwapHistory = async () => {
    if (!isAnyWalletConnected) return;

    try {
      setIsLoading(true);
      setError(null);

      const addresses = [];
      if (ethereum.wallet.isConnected) addresses.push(ethereum.wallet.address);
      if (sui.connected) addresses.push(sui.account?.address);

      if (addresses.length === 0) return;

      const response = await fetch(`${API_BASE}/api/swap/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addresses,
          limit,
          filter: filter !== "all" ? filter : undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSwapHistory(data.swaps || []);
      } else {
        throw new Error(data.error || "Failed to fetch swap history");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch swap history");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on wallet connection change
  useEffect(() => {
    fetchSwapHistory();
  }, [isAnyWalletConnected, ethereum.wallet.address, sui.account?.address, filter]);

  // Refresh every 30 seconds for pending swaps
  useEffect(() => {
    if (swapHistory.some(swap => ["INITIATED", "IN_PROGRESS", "BRIDGING"].includes(swap.status))) {
      const interval = setInterval(fetchSwapHistory, 30000);
      return () => clearInterval(interval);
    }
  }, [swapHistory]);

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          label: "Completed"
        };
      case "FAILED":
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          label: "Failed"
        };
      case "INITIATED":
      case "ETH_TO_USDC_SWAP":
      case "SUI_TO_USDC_SWAP":
      case "BRIDGING":
      case "USDC_TO_SUI_SWAP":
      case "USDC_TO_ETH_SWAP":
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          label: "In Progress"
        };
      default:
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
          label: status
        };
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Format amount
  const formatAmount = (amount: string, decimals: number = 4) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return "0";
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(decimals);
    if (num < 1000000) return (num / 1000).toFixed(2) + "K";
    return (num / 1000000).toFixed(2) + "M";
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Get block explorer URL
  const getExplorerUrl = (txHash: string, chain: "ethereum" | "sui") => {
    if (chain === "ethereum") {
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    } else {
      return `https://suiexplorer.com/txblock/${txHash}?network=testnet`;
    }
  };

  if (!isAnyWalletConnected) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <ArrowUpDown className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Connect your wallet to view swap history</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Swap History
              </CardTitle>
              <CardDescription>
                Your cross-chain swap transactions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter(filter === "all" ? "pending" : "all")}
              >
                <Filter className="h-3 w-3 mr-1" />
                {filter === "all" ? "All" : "Pending"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSwapHistory}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={showHeader ? "pt-0" : "p-6"}>
        {isLoading && swapHistory.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSwapHistory}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : swapHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowUpDown className="h-8 w-8 mx-auto mb-2" />
            <p>No swap history found</p>
            <p className="text-sm">Your swaps will appear here once you start trading</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {swapHistory.map((swap, index) => {
                const statusDisplay = getStatusDisplay(swap.status);
                const isCrossChain = swap.fromChain !== swap.toChain;

                return (
                  <div key={swap.id}>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`h-6 w-6 rounded-full ${
                            swap.fromChain === "ethereum" ? "bg-blue-500" : "bg-cyan-500"
                          }`} />
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          <div className={`h-6 w-6 rounded-full ${
                            swap.toChain === "ethereum" ? "bg-blue-500" : "bg-cyan-500"
                          }`} />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatAmount(swap.fromAmount)} {swap.fromToken}
                            </span>
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">
                              {formatAmount(swap.toAmount)} {swap.toToken}
                            </span>
                            {isCrossChain && (
                              <Badge variant="outline" className="text-xs">
                                Cross-chain
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(swap.createdAt)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => copyToClipboard(swap.id)}
                            >
                              <Copy className="h-2 w-2 mr-1" />
                              ID: {swap.id.slice(0, 8)}...
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={statusDisplay.color}>
                          {statusDisplay.icon}
                          <span className="ml-1">{statusDisplay.label}</span>
                        </Badge>

                        {/* Transaction Links */}
                        <div className="flex gap-1">
                          {swap.transactions.ethereum && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => window.open(getExplorerUrl(swap.transactions.ethereum!, "ethereum"), "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          {swap.transactions.sui && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => window.open(getExplorerUrl(swap.transactions.sui!, "sui"), "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {swap.error && (
                      <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-600 dark:text-red-400">{swap.error}</p>
                      </div>
                    )}

                    {index < swapHistory.length - 1 && <Separator className="my-2" />}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}