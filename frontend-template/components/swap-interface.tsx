"use client";

import { useState, useEffect, useMemo } from "react";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { useManteiaApi } from "@/hooks/use-manteia-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  ArrowUpDown,
  ArrowDown,
  Settings,
  Info,
  Zap,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from "lucide-react";

/**
 * Manteia Swap Interface Component
 * Replicates Magma Finance swap functionality with cross-chain support
 * Based on Magma's swap mechanics and fee structure
 * @see https://magma-finance-1.gitbook.io/magma-finance/product/clmm/swap
 * @see https://magma-finance-1.gitbook.io/magma-finance/product/clmm/fees
 */

// Token definitions based on Magma and 1inch supported assets
const SUPPORTED_TOKENS = {
  ethereum: [
    { symbol: "ETH", name: "Ethereum", address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", decimals: 18 },
    { symbol: "USDC", name: "USD Coin", address: "0xa0b86a33e6329c8a4e66e8c7e4b4b5486f9db11e", decimals: 6 },
    { symbol: "USDT", name: "Tether USD", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
    { symbol: "WBTC", name: "Wrapped Bitcoin", address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", decimals: 8 },
    { symbol: "DAI", name: "Dai Stablecoin", address: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18 },
  ],
  sui: [
    { symbol: "SUI", name: "Sui", address: "0x2::sui::SUI", decimals: 9 },
    { symbol: "USDC", name: "USD Coin", address: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN", decimals: 6 },
    { symbol: "WETH", name: "Wrapped Ethereum", address: "0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN", decimals: 8 },
    { symbol: "CETUS", name: "Cetus Protocol", address: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS", decimals: 9 },
  ]
};

// Magma's fee tiers as specified in their documentation
const FEE_TIERS = [
  { value: "0.01", label: "Best Stable", rate: 0.0001, description: "Stablecoin pairs" },
  { value: "0.05", label: "Concentrated Stable", rate: 0.0005, description: "Low volatility pairs" },
  { value: "0.25", label: "Best for most pairs", rate: 0.0025, description: "Standard trading pairs" },
  { value: "1.00", label: "Best for exotic pairs", rate: 0.01, description: "High volatility pairs" }
];

interface SwapQuote {
  fromAmount: string;
  toAmount: string;
  priceImpact: number;
  estimatedGas: string;
  route: any[];
  feeTier: string;
  minimumReceived: string;
}

interface SwapInterfaceProps {
  defaultFromChain?: "ethereum" | "sui";
  defaultToChain?: "ethereum" | "sui";
}

export function SwapInterface({ defaultFromChain = "ethereum", defaultToChain = "sui" }: SwapInterfaceProps) {
  const { sui, ethereum, areBothWalletsConnected } = useManteiaWallet();
  const { getSwapQuote } = useManteiaApi();

  // Swap state
  const [fromChain, setFromChain] = useState<"ethereum" | "sui">(defaultFromChain);
  const [toChain, setToChain] = useState<"ethereum" | "sui">(defaultToChain);
  const [fromToken, setFromToken] = useState(SUPPORTED_TOKENS[fromChain][0]);
  const [toToken, setToToken] = useState(SUPPORTED_TOKENS[toChain][0]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState("0.5");
  const [selectedFeeTier, setSelectedFeeTier] = useState(FEE_TIERS[2]); // Default to 0.25%
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [swapMode, setSwapMode] = useState<"market" | "limit">("market");
  const [useAggregator, setUseAggregator] = useState(true);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deadline, setDeadline] = useState("20"); // minutes
  const [partialFillsEnabled, setPartialFillsEnabled] = useState(false);

  // Determine if this is a cross-chain swap
  const isCrossChain = fromChain !== toChain;

  // Get available tokens for selected chains
  const fromTokens = SUPPORTED_TOKENS[fromChain];
  const toTokens = SUPPORTED_TOKENS[toChain];

  // Auto-update token selections when chains change
  useEffect(() => {
    setFromToken(fromTokens[0]);
    setToToken(toTokens[0]);
  }, [fromChain, toChain]);

  // Calculate quote when parameters change
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken) {
      const delayedQuote = setTimeout(() => {
        fetchQuote();
      }, 500); // Debounce API calls

      return () => clearTimeout(delayedQuote);
    } else {
      setQuote(null);
      setToAmount("");
    }
  }, [fromAmount, fromToken, toToken, fromChain, toChain, selectedFeeTier, slippageTolerance]);

  const fetchQuote = async () => {
    if (!fromAmount || !fromToken || !toToken) return;

    setIsLoadingQuote(true);
    try {
      const { data } = await getSwapQuote({
        fromToken: fromToken.address,
        toToken: toToken.address,
        amount: fromAmount,
        fromChain,
        toChain,
        slippage: parseFloat(slippageTolerance)
      });

      if (data) {
        setQuote(data.quote);
        setToAmount(data.quote.toAmount);
      }
    } catch (error) {
      console.error("Failed to fetch quote:", error);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Handle token swap (flip from/to)
  const handleSwapTokens = () => {
    // Swap chains
    const tempChain = fromChain;
    setFromChain(toChain);
    setToChain(tempChain);

    // Swap tokens
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    // Swap amounts
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  // Calculate price impact color
  const getPriceImpactColor = (impact: number) => {
    if (impact < 1) return "text-green-600 dark:text-green-400";
    if (impact < 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Check if user can execute swap
  const canExecuteSwap = useMemo(() => {
    if (!fromAmount || !toAmount || !quote) return false;
    if (isCrossChain && !areBothWalletsConnected) return false;
    if (!isCrossChain && fromChain === "ethereum" && !ethereum.wallet.isConnected) return false;
    if (!isCrossChain && fromChain === "sui" && !sui.connected) return false;
    return true;
  }, [fromAmount, toAmount, quote, isCrossChain, areBothWalletsConnected, ethereum.wallet.isConnected, sui.connected]);

  const executeSwap = async () => {
    if (!canExecuteSwap || !quote) return;

    try {
      // Implementation will be added in next step - integrate with backend API
      console.log("Executing swap:", {
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount,
        quote,
        slippageTolerance,
        feeTier: selectedFeeTier
      });
    } catch (error) {
      console.error("Swap execution failed:", error);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Main Swap Card */}
      <Card className="border-2 transition-colors">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Swap
                {isCrossChain && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Cross-chain
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isCrossChain ? "Atomic cross-chain swaps powered by 1inch Fusion+" : "Trade tokens with best pricing"}
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
          {/* Swap Mode Tabs */}
          <Tabs value={swapMode} onValueChange={(value) => setSwapMode(value as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market</TabsTrigger>
              <TabsTrigger value="limit">Limit</TabsTrigger>
            </TabsList>

            <TabsContent value="market" className="space-y-4 mt-4">
              {/* From Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">From</Label>
                  <div className="flex items-center gap-2">
                    <Select value={fromChain} onValueChange={(value) => setFromChain(value as any)}>
                      <SelectTrigger className="w-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="sui">Sui</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                        const token = fromTokens.find(t => t.symbol === symbol);
                        if (token) setFromToken(token);
                      }}
                    >
                      <SelectTrigger className="w-auto border-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fromTokens.map((token) => (
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

              {/* Swap Button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwapTokens}
                  className="rounded-full h-8 w-8 p-0"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>

              {/* To Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">To</Label>
                  <div className="flex items-center gap-2">
                    <Select value={toChain} onValueChange={(value) => setToChain(value as any)}>
                      <SelectTrigger className="w-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="sui">Sui</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={toAmount}
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
                        const token = toTokens.find(t => t.symbol === symbol);
                        if (token) setToToken(token);
                      }}
                    >
                      <SelectTrigger className="w-auto border-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {toTokens.map((token) => (
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
                        {formatPercentage(quote.priceImpact)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Minimum Received</span>
                      <span>{quote.minimumReceived} {toToken.symbol}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fee Tier</span>
                      <Badge variant="outline">{selectedFeeTier.label}</Badge>
                    </div>

                    {useAggregator && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Route</span>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          <span className="text-xs">Best Price</span>
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
                        {["0.1", "0.5", "1.0"].map((value) => (
                          <Button
                            key={value}
                            variant={slippageTolerance === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSlippageTolerance(value)}
                          >
                            {value}%
                          </Button>
                        ))}
                        <Input
                          type="number"
                          placeholder="Custom"
                          value={slippageTolerance}
                          onChange={(e) => setSlippageTolerance(e.target.value)}
                          className="w-20 h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Fee Tier Selection</Label>
                      <Select
                        value={selectedFeeTier.value}
                        onValueChange={(value) => {
                          const tier = FEE_TIERS.find(t => t.value === value);
                          if (tier) setSelectedFeeTier(tier);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FEE_TIERS.map((tier) => (
                            <SelectItem key={tier.value} value={tier.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{tier.label} ({tier.value}%)</span>
                                <span className="text-xs text-muted-foreground">{tier.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="aggregator" className="text-sm font-medium">Use Aggregator</Label>
                      <Switch
                        id="aggregator"
                        checked={useAggregator}
                        onCheckedChange={setUseAggregator}
                      />
                    </div>

                    {isCrossChain && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="partial-fills" className="text-sm font-medium">Enable Partial Fills</Label>
                        <Switch
                          id="partial-fills"
                          checked={partialFillsEnabled}
                          onCheckedChange={setPartialFillsEnabled}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Execute Button */}
              <Button
                onClick={executeSwap}
                disabled={!canExecuteSwap}
                className="w-full"
                size="lg"
              >
                {!areBothWalletsConnected && isCrossChain ? (
                  "Connect Both Wallets"
                ) : !fromAmount || !toAmount ? (
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

              {/* Warning for high price impact */}
              {quote && quote.priceImpact > 5 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    High price impact. Consider reducing your trade size.
                  </span>
                </div>
              )}
            </TabsContent>

            <TabsContent value="limit" className="space-y-4 mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2" />
                <p>Limit orders coming soon...</p>
                <p className="text-sm">Advanced limit order strategies powered by 1inch LOP</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Additional Information */}
      {isCrossChain && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 mt-0.5 text-blue-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Cross-Chain Swap Information</p>
                <p className="text-xs text-muted-foreground">
                  This swap uses atomic hash time-locked contracts (HTLC) to ensure trustless execution across chains.
                  Your funds are secured by cryptographic guarantees.
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ExternalLink className="h-3 w-3" />
                  <span className="text-xs text-blue-600 dark:text-blue-400">Learn more about Manteia</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}