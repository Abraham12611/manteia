"use client";

import { useState, useEffect, useMemo } from "react";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { useCrossChainSwap, type SwapParams } from "@/hooks/use-cross-chain-swap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowUpDown,
  ArrowDown,
  Settings,
  Info,
  Zap,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Loader2,
  Copy,
  Eye
} from "lucide-react";
import { WalletConnectDialog } from "./wallet-connect-dialog";

/**
 * Enhanced Cross-Chain Swap Interface
 * Integrates with useCrossChainSwap hook and backend services
 * Provides real-time swap monitoring and status updates
 */

export function CrossChainSwapInterface() {
  const { sui, ethereum, areBothWalletsConnected } = useManteiaWallet();
  const {
    getQuote,
    quote,
    isLoadingQuote,
    quoteError,
    executeSwap,
    currentSwap,
    isExecutingSwap,
    swapError,
    getSwapStatus,
    subscribeToSwapUpdates,
    validateSwapParams,
    getSupportedTokens
  } = useCrossChainSwap();

  // Swap configuration state
  const [fromChain, setFromChain] = useState<"ethereum" | "sui">("ethereum");
  const [toChain, setToChain] = useState<"ethereum" | "sui">("sui");
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20); // minutes
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get supported tokens
  const supportedTokens = getSupportedTokens();
  const [fromToken, setFromToken] = useState(supportedTokens.ethereum[0]);
  const [toToken, setToToken] = useState(supportedTokens.sui[0]);

  // Update tokens when chains change
  useEffect(() => {
    setFromToken(supportedTokens[fromChain][0]);
    setToToken(supportedTokens[toChain][0]);
  }, [fromChain, toChain, supportedTokens]);

  // Auto-fetch quotes when parameters change
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken) {
      const delayedQuote = setTimeout(() => {
        fetchQuote();
      }, 800); // Debounce

      return () => clearTimeout(delayedQuote);
    }
  }, [fromAmount, fromToken, toToken, fromChain, toChain, slippage]);

  const fetchQuote = async () => {
    if (!fromAmount || !fromToken || !toToken) return;

    const params: SwapParams = {
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount: fromAmount,
      slippage,
      deadline: Date.now() + (deadline * 60 * 1000)
    };

    await getQuote(params);
  };

  // Handle token swap (flip from/to)
  const handleSwapTokens = () => {
    const tempChain = fromChain;
    setFromChain(toChain);
    setToChain(tempChain);

    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    // Clear amount when swapping
    setFromAmount("");
  };

  // Check if swap can be executed
  const canExecuteSwap = useMemo(() => {
    if (!fromAmount || !quote) return false;
    if (isLoadingQuote || isExecutingSwap) return false;

    const validation = validateSwapParams({
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount: fromAmount,
      slippage
    });

    if (!validation.isValid) return false;

    const isCrossChain = fromChain !== toChain;
    if (isCrossChain && !areBothWalletsConnected) return false;
    if (!isCrossChain && fromChain === "ethereum" && !ethereum.wallet.isConnected) return false;
    if (!isCrossChain && fromChain === "sui" && !sui.connected) return false;

    return true;
  }, [fromAmount, quote, isLoadingQuote, isExecutingSwap, fromChain, toChain, areBothWalletsConnected, ethereum.wallet.isConnected, sui.connected, validateSwapParams, fromToken, toToken, slippage]);

  // Execute swap
  const handleExecuteSwap = async () => {
    if (!canExecuteSwap) return;

    const params: SwapParams = {
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount: fromAmount,
      slippage,
      deadline: Date.now() + (deadline * 60 * 1000)
    };

    await executeSwap(params);
  };

  // Format amounts for display
  const formatAmount = (amount: string, decimals: number = 6) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return "0";
    if (num === 0) return "0";
    if (num < 0.000001) return "< 0.000001";
    if (num < 1) return num.toFixed(decimals);
    if (num < 1000) return num.toFixed(4);
    if (num < 1000000) return (num / 1000).toFixed(2) + "K";
    return (num / 1000000).toFixed(2) + "M";
  };

  // Get price impact color
  const getPriceImpactColor = (impact: number) => {
    if (impact < 1) return "text-green-600 dark:text-green-400";
    if (impact < 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isCrossChain = fromChain !== toChain;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Main Swap Card */}
      <Card className="border-2 transition-colors">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Cross-Chain Swap
                {isCrossChain && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <Zap className="h-3 w-3 mr-1" />
                    Wormhole + 1inch
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isCrossChain
                  ? "Powered by 1inch, Wormhole, and Cetus DEX"
                  : "Optimized routing with best execution"
                }
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* From Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">From</Label>
              <Select value={fromChain} onValueChange={(value) => setFromChain(value as any)}>
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-blue-500" />
                      Ethereum
                    </div>
                  </SelectItem>
                  <SelectItem value="sui">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-cyan-500" />
                      Sui
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="pr-32 text-lg"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Select
                  value={fromToken.symbol}
                  onValueChange={(symbol) => {
                    const token = supportedTokens[fromChain].find(t => t.symbol === symbol);
                    if (token) setFromToken(token);
                  }}
                >
                  <SelectTrigger className="w-auto border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedTokens[fromChain].map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground">{token.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwapTokens}
              className="rounded-full h-8 w-8 p-0"
              disabled={isExecutingSwap}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>

          {/* To Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">To</Label>
              <Select value={toChain} onValueChange={(value) => setToChain(value as any)}>
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-blue-500" />
                      Ethereum
                    </div>
                  </SelectItem>
                  <SelectItem value="sui">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-cyan-500" />
                      Sui
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Input
                type="text"
                placeholder="0.0"
                value={quote ? formatAmount(quote.outputAmount) : ""}
                readOnly
                className="pr-32 text-lg bg-muted/30"
              />
              {isLoadingQuote && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Select
                  value={toToken.symbol}
                  onValueChange={(symbol) => {
                    const token = supportedTokens[toChain].find(t => t.symbol === symbol);
                    if (token) setToToken(token);
                  }}
                >
                  <SelectTrigger className="w-auto border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedTokens[toChain].map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground">{token.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Quote Information */}
          {quote && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className={getPriceImpactColor(quote.priceImpact)}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Minimum Received</span>
                  <span>{formatAmount(quote.minimumReceived)} {toToken.symbol}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Fees</span>
                  <span>{formatAmount(quote.fees.total)} USDC</span>
                </div>

                {quote.steps.length > 1 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Route</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-xs">{quote.steps.length} steps</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Advanced Settings */}
          {showAdvanced && (
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Slippage Tolerance</Label>
                  <div className="flex gap-2">
                    {[0.1, 0.5, 1.0].map((value) => (
                      <Button
                        key={value}
                        variant={slippage === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSlippage(value)}
                      >
                        {value}%
                      </Button>
                    ))}
                    <Input
                      type="number"
                      placeholder="Custom"
                      value={slippage.toString()}
                      onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                      className="w-20 h-8 text-xs"
                      min="0.1"
                      max="50"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Transaction Deadline</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={deadline.toString()}
                      onChange={(e) => setDeadline(parseInt(e.target.value) || 20)}
                      className="w-20"
                      min="1"
                      max="60"
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {(quoteError || swapError) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {quoteError || swapError}
              </AlertDescription>
            </Alert>
          )}

          {/* Execute Button */}
          {!areBothWalletsConnected && isCrossChain ? (
            <WalletConnectDialog
              trigger={
                <Button className="w-full" size="lg">
                  Connect Both Wallets
                </Button>
              }
            />
          ) : (
            <Button
              onClick={handleExecuteSwap}
              disabled={!canExecuteSwap}
              className="w-full"
              size="lg"
            >
              {isExecutingSwap ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing Swap...
                </>
              ) : !fromAmount ? (
                "Enter Amount"
              ) : isLoadingQuote ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Getting Quote...
                </>
              ) : isCrossChain ? (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Execute Cross-Chain Swap
                </>
              ) : (
                "Swap Tokens"
              )}
            </Button>
          )}

          {/* High Price Impact Warning */}
          {quote && quote.priceImpact > 5 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                High price impact ({quote.priceImpact.toFixed(2)}%). Consider reducing your trade size.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Swap Progress */}
      {currentSwap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Swap Progress
              <Badge
                variant={currentSwap.status === "COMPLETED" ? "default" : "secondary"}
                className={currentSwap.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}
              >
                {currentSwap.status.replace(/_/g, " ")}
              </Badge>
            </CardTitle>
            <CardDescription>
              Swap ID: {currentSwap.swapId}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 ml-2"
                onClick={() => copyToClipboard(currentSwap.swapId)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Steps */}
            <div className="space-y-3">
              {Object.entries(currentSwap.steps).map(([step, status]) => (
                <div key={step} className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${
                    status === "COMPLETED" ? "bg-green-500" :
                    status === "IN_PROGRESS" ? "bg-blue-500 animate-pulse" :
                    status === "FAILED" ? "bg-red-500" :
                    "bg-gray-300"
                  }`} />
                  <span className="text-sm capitalize">
                    {step.replace(/([A-Z])/g, " $1").toLowerCase()}
                  </span>
                  {status === "COMPLETED" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              ))}
            </div>

            {/* Transaction Links */}
            {currentSwap.transactions && (
              <div className="space-y-2">
                <Separator />
                <div className="space-y-1">
                  {currentSwap.transactions.ethereum && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => window.open(
                        `https://sepolia.etherscan.io/tx/${currentSwap.transactions.ethereum}`,
                        "_blank"
                      )}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      View Ethereum Transaction
                    </Button>
                  )}
                  {currentSwap.transactions.sui && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => window.open(
                        `https://suiexplorer.com/txblock/${currentSwap.transactions.sui}?network=testnet`,
                        "_blank"
                      )}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      View Sui Transaction
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cross-Chain Info */}
      {isCrossChain && !currentSwap && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 mt-0.5 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Cross-Chain Swap Process</p>
                <p className="text-xs text-muted-foreground">
                  {fromChain === "ethereum"
                    ? "ETH → USDC (1inch) → Bridge (Wormhole) → USDC → SUI (Cetus)"
                    : "SUI → USDC (Cetus) → Bridge (Wormhole) → USDC → ETH (1inch)"
                  }
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ExternalLink className="h-3 w-3" />
                  <span className="text-xs text-blue-600 dark:text-blue-400">Learn more about our technology</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}