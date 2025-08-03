"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { useUnifiedSwap } from "@/hooks/use-unified-swap";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { SUPPORTED_NETWORKS, Token, formatTokenAmount, parseTokenAmount } from "@/lib/networks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpDown,
  ArrowDown,
  Settings,
  Info,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Wallet,
  ExternalLink,
  Globe,
  Clock,
  Zap,
  Shield,
  CheckCircle,
  XCircle
} from "lucide-react";

// Popular tokens to show by default
const DEFAULT_TOKENS_TO_SHOW = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI', 'WETH', 'UNI', 'LINK', 'ARB', 'OP', 'MATIC', 'AVAX', 'SUI', 'CETUS'];

interface UnifiedSwapInterfaceProps {
  defaultFromNetwork?: string;
  defaultToNetwork?: string;
}

export function UnifiedSwapInterface({
  defaultFromNetwork = "ethereum",
  defaultToNetwork = "sui"
}: UnifiedSwapInterfaceProps) {
  const { ethereum } = useManteiaWallet();
  const {
    isLoading,
    error,
    quote,
    supportedChains,
    tokensByChain,
    popularTokensByChain,
    getQuote,
    loadTokens,
    loadPopularTokens,
    searchTokens,
    isCrossChainSupported
  } = useUnifiedSwap();
  const { balances, getTokenBalance, refreshBalances } = useWalletBalances();

  // Swap state
  const [fromChain, setFromChain] = useState<string>(defaultFromNetwork);
  const [toChain, setToChain] = useState<string>(defaultToNetwork);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState("0.5");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStep, setExecutionStep] = useState<string>("");
  const [executionProgress, setExecutionProgress] = useState(0);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTokenSearch, setShowTokenSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Token[]>([]);

  // Ref to track if component is mounted
  const isMountedRef = useRef(false);

  // Get current network configs
  const fromNetwork = SUPPORTED_NETWORKS[fromChain as keyof typeof SUPPORTED_NETWORKS];
  const toNetwork = SUPPORTED_NETWORKS[toChain as keyof typeof SUPPORTED_NETWORKS];

  // Check if this is a cross-chain swap
  const isCrossChain = fromChain !== toChain;

  // Load tokens when chains change
  useEffect(() => {
    let isCancelled = false;

    const loadChainTokens = async () => {
      console.log("🔄 Loading tokens for chains:", { fromChain, toChain });

      try {
        // Reset tokens and quote
        setFromToken(null);
        setToToken(null);
        setQuote(null);
        setToAmount("");

        // Load tokens for both chains
        await Promise.all([
          loadTokens(fromChain),
          loadTokens(toChain)
        ]);

        // Check if component was unmounted during API call
        if (isCancelled) return;

        // Set default from token (native token)
        const fromTokens = tokensByChain[fromChain] || {};
        const nativeToken = Object.values(fromTokens).find(t =>
          t.address.toLowerCase() === fromNetwork?.nativeToken?.address?.toLowerCase()
        );
        if (nativeToken) {
          setFromToken(nativeToken);
        }

        // Set default to token (native token of destination)
        const toTokens = tokensByChain[toChain] || {};
        const toNativeToken = Object.values(toTokens).find(t =>
          t.address.toLowerCase() === toNetwork?.nativeToken?.address?.toLowerCase()
        );
        if (toNativeToken) {
          setToToken(toNativeToken);
        }

      } catch (error) {
        console.error("Error loading tokens:", error);
      }
    };

    loadChainTokens();

    return () => {
      isCancelled = true;
    };
  }, [fromChain, toChain, loadTokens, tokensByChain, fromNetwork, toNetwork]);

  // Load popular tokens on mount
  useEffect(() => {
    const loadPopular = async () => {
      try {
        await Promise.all([
          loadPopularTokens(fromChain),
          loadPopularTokens(toChain)
        ]);
      } catch (error) {
        console.error("Error loading popular tokens:", error);
      }
    };

    loadPopular();
  }, [fromChain, toChain, loadPopularTokens]);

  // Get quote when parameters change
  useEffect(() => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setQuote(null);
      setToAmount("");
      return;
    }

    const getQuoteWithDelay = setTimeout(async () => {
      try {
        const quoteResult = await getQuote({
          fromChain,
          toChain,
          fromToken: fromToken.symbol,
          toToken: toToken.symbol,
          amount: fromAmount,
          slippage: parseFloat(slippageTolerance)
        });

        if (quoteResult && quoteResult.toAmount) {
          setToAmount(quoteResult.toAmount);
        }
      } catch (error) {
        console.error("Error getting quote:", error);
        setToAmount("");
      }
    }, 500); // Debounce quote requests

    return () => clearTimeout(getQuoteWithDelay);
  }, [fromToken, toToken, fromAmount, slippageTolerance, fromChain, toChain, getQuote]);

  // Handle token search
  const handleTokenSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchTokens(query);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching tokens:", error);
      setSearchResults([]);
    }
  }, [searchTokens]);

  // Handle swap execution
  const executeSwap = async () => {
    if (!quote || !fromToken || !toToken || !fromAmount) {
      return;
    }

    setIsExecuting(true);
    setExecutionStep("Initiating swap...");
    setExecutionProgress(10);

    try {
      // Simulate execution steps for now
      // In real implementation, this would call the actual swap execution
      setExecutionStep("Preparing transaction...");
      setExecutionProgress(30);

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (isCrossChain) {
        setExecutionStep("Bridging tokens...");
        setExecutionProgress(50);
        await new Promise(resolve => setTimeout(resolve, 2000));

        setExecutionStep("Executing destination swap...");
        setExecutionProgress(80);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        setExecutionStep("Executing swap...");
        setExecutionProgress(60);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setExecutionStep("Swap completed!");
      setExecutionProgress(100);

      // Reset after success
      setTimeout(() => {
        setIsExecuting(false);
        setExecutionStep("");
        setExecutionProgress(0);
        setFromAmount("");
        setToAmount("");
        setQuote(null);
      }, 2000);

    } catch (error) {
      console.error("Swap execution failed:", error);
      setExecutionStep("Swap failed");
      setExecutionProgress(0);
      setTimeout(() => {
        setIsExecuting(false);
        setExecutionStep("");
      }, 3000);
    }
  };

  // Handle chain swap
  const handleSwapChains = () => {
    setFromChain(toChain);
    setToChain(fromChain);
  };

  // Handle token swap
  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount("");
  };

  // Get available tokens for display
  const getAvailableTokens = (chain: string) => {
    return tokensByChain[chain] || {};
  };

  const getPopularTokens = (chain: string) => {
    return popularTokensByChain[chain] || [];
  };

  // Format amount for display
  const formatAmount = (amount: string, token: Token | null) => {
    if (!amount || !token) return "";
    try {
      return formatTokenAmount(amount, token.decimals);
    } catch {
      return amount;
    }
  };

  // Get button text and state
  const getButtonText = () => {
    if (isExecuting) return "Executing...";
    if (!fromToken || !toToken) return "Select tokens";
    if (!fromAmount || parseFloat(fromAmount) <= 0) return "Enter amount";
    if (isLoading) return "Getting quote...";
    if (error) return "Error getting quote";
    if (!quote) return "Get quote";
    return isCrossChain ? "Execute Cross-Chain Swap" : "Execute Swap";
  };

  const isButtonDisabled = () => {
    return isExecuting || isLoading || !fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0 || !quote;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Unified Cross-Chain Swap
        </CardTitle>
        <CardDescription>
          Swap tokens across multiple networks with automatic bridging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chain Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Networks</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwapChains}
              disabled={isExecuting}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Swap
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* From Chain */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Select value={fromChain} onValueChange={setFromChain} disabled={isExecuting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedChains.map((chain) => (
                    <SelectItem key={chain} value={chain}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500" />
                        {chain.charAt(0).toUpperCase() + chain.slice(1)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To Chain */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Select value={toChain} onValueChange={setToChain} disabled={isExecuting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedChains.map((chain) => (
                    <SelectItem key={chain} value={chain}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        {chain.charAt(0).toUpperCase() + chain.slice(1)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cross-chain indicator */}
          {isCrossChain && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Cross-chain swap via Wormhole Bridge
              </span>
            </div>
          )}
        </div>

        {/* Token Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Tokens</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwapTokens}
              disabled={isExecuting || !fromToken || !toToken}
            >
              <ArrowDown className="h-4 w-4 mr-2" />
              Swap
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* From Token */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">From Token</Label>
              <div className="space-y-2">
                <Select
                  value={fromToken?.address || ""}
                  onValueChange={(value) => {
                    const tokens = getAvailableTokens(fromChain);
                    setFromToken(tokens[value] || null);
                  }}
                  disabled={isExecuting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Popular tokens first */}
                    {getPopularTokens(fromChain).map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={token.logoURI} />
                            <AvatarFallback>{token.symbol.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{token.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <Separator />
                    {/* All tokens */}
                    {Object.values(getAvailableTokens(fromChain)).map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={token.logoURI} />
                            <AvatarFallback>{token.symbol.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{token.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Amount Input */}
                <div className="space-y-1">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    disabled={isExecuting}
                  />
                  {fromToken && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Balance: {formatAmount(getTokenBalance(fromToken.address) || "0", fromToken)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFromAmount(getTokenBalance(fromToken.address) || "0")}
                        disabled={isExecuting}
                      >
                        Max
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">To Token</Label>
              <div className="space-y-2">
                <Select
                  value={toToken?.address || ""}
                  onValueChange={(value) => {
                    const tokens = getAvailableTokens(toChain);
                    setToToken(tokens[value] || null);
                  }}
                  disabled={isExecuting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Popular tokens first */}
                    {getPopularTokens(toChain).map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={token.logoURI} />
                            <AvatarFallback>{token.symbol.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{token.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <Separator />
                    {/* All tokens */}
                    {Object.values(getAvailableTokens(toChain)).map((token) => (
                      <SelectItem key={token.address} value={token.address}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={token.logoURI} />
                            <AvatarFallback>{token.symbol.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{token.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Amount Display */}
                <div className="space-y-1">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={toAmount}
                    readOnly
                    className="bg-muted"
                  />
                  {toToken && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Balance: {formatAmount(getTokenBalance(toToken.address) || "0", toToken)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Information */}
        {quote && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Quote Details</span>
              <Badge variant={isCrossChain ? "default" : "secondary"}>
                {isCrossChain ? "Cross-Chain" : "Same-Chain"}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rate</span>
                <span>1 {fromToken?.symbol} = {formatAmount(quote.rate || "0", toToken)} {toToken?.symbol}</span>
              </div>

              {isCrossChain && quote.bridgeFee && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bridge Fee</span>
                  <span>{quote.bridgeFee}</span>
                </div>
              )}

              {quote.swapFee && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Swap Fee</span>
                  <span>{quote.swapFee}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Fee</span>
                <span>{quote.totalFee}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated Time</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {quote.estimatedTime}
                </span>
              </div>

              {quote.steps && (
                <div className="space-y-1">
                  <span className="text-muted-foreground">Route:</span>
                  {quote.steps.map((step: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>{step.description}</span>
                      <Badge variant="outline" className="text-xs">
                        {step.estimatedFee}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Execution Progress */}
        {isExecuting && (
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
              <span className="text-sm font-medium">{executionStep}</span>
            </div>
            <Progress value={executionProgress} className="w-full" />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-start"
          >
            <Settings className="h-4 w-4 mr-2" />
            Advanced Settings
          </Button>

          {showAdvanced && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <Label className="text-sm">Slippage Tolerance (%)</Label>
                <Input
                  type="number"
                  value={slippageTolerance}
                  onChange={(e) => setSlippageTolerance(e.target.value)}
                  placeholder="0.5"
                  disabled={isExecuting}
                />
              </div>
            </div>
          )}
        </div>

        {/* Execute Button */}
        <Button
          onClick={executeSwap}
          disabled={isButtonDisabled()}
          className="w-full"
          size="lg"
        >
          {isExecuting ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {getButtonText()}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isCrossChain ? <Globe className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              {getButtonText()}
            </div>
          )}
        </Button>

        {/* Info Section */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5" />
          <div className="space-y-1">
            <p>
              {isCrossChain
                ? "Cross-chain swaps use Wormhole Bridge for token transfer and Cetus/1inch for destination swaps."
                : "Same-chain swaps use 1inch aggregation for best rates."
              }
            </p>
            <p>
              Supported networks: Ethereum, Arbitrum, Optimism, Polygon, Sui
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}