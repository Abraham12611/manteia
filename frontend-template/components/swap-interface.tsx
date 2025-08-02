"use client";

import { useState, useEffect, useMemo } from "react";
import { useManteiaWallet } from "@/providers/manteia-wallet-provider";
import { useOneInchService } from "@/hooks/use-1inch-service";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { SUPPORTED_NETWORKS, Token, formatTokenAmount, parseTokenAmount } from "@/lib/networks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  Wallet
} from "lucide-react";

/**
 * Manteia Swap Interface Component
 * Replicates Magma Finance swap functionality with cross-chain support
 * Based on Magma's swap mechanics and fee structure
 * @see https://magma-finance-1.gitbook.io/magma-finance/product/clmm/swap
 * @see https://magma-finance-1.gitbook.io/magma-finance/product/clmm/fees
 */

// Popular tokens that we'll show by default (fetched from 1inch API)
const DEFAULT_TOKENS_TO_SHOW = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI', 'WETH', 'UNI', 'LINK', 'ARB', 'OP', 'MATIC', 'AVAX'];

// Magma's fee tiers as specified in their documentation
const FEE_TIERS = [
  { value: "0.01", label: "Best Stable", rate: 0.0001, description: "Stablecoin pairs" },
  { value: "0.05", label: "Concentrated Stable", rate: 0.0005, description: "Low volatility pairs" },
  { value: "0.25", label: "Best for most pairs", rate: 0.0025, description: "Standard trading pairs" },
  { value: "1.00", label: "Best for exotic pairs", rate: 0.01, description: "High volatility pairs" }
];

interface SwapInterfaceProps {
  defaultNetwork?: keyof typeof SUPPORTED_NETWORKS;
}

export function SwapInterface({ defaultNetwork = "ethereum" }: SwapInterfaceProps) {
  const { ethereum } = useManteiaWallet();
  const oneInchService = useOneInchService();
  const { balances, getTokenBalance, refreshBalances } = useWalletBalances();

  // Swap state
  const [selectedNetwork, setSelectedNetwork] = useState<keyof typeof SUPPORTED_NETWORKS>(defaultNetwork);
  const [availableTokens, setAvailableTokens] = useState<Record<string, Token>>({});
  const [popularTokens, setPopularTokens] = useState<Token[]>([]);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState("0.5");
  const [quote, setQuote] = useState<any>(null);
  const [swapMode, setSwapMode] = useState<"market" | "limit">("market");

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deadline, setDeadline] = useState("20"); // minutes

  // Get current network config
  const currentNetwork = SUPPORTED_NETWORKS[selectedNetwork];
  const currentChainId = currentNetwork.chainId;

  // Load tokens when network changes
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const tokens = await oneInchService.getTokens(currentChainId);
        setAvailableTokens(tokens);

        // Filter popular tokens
        const popular = Object.values(tokens).filter(token =>
          DEFAULT_TOKENS_TO_SHOW.includes(token.symbol)
        ).slice(0, 10);

        setPopularTokens(popular);

        // Set default from token (native token)
        const nativeToken = Object.values(tokens).find(t =>
          t.address.toLowerCase() === currentNetwork.nativeToken.address.toLowerCase()
        );
        if (nativeToken && !fromToken) {
          setFromToken(nativeToken);
        }

        // Set default to token (USDC if available)
        if (!toToken) {
          const usdcToken = Object.values(tokens).find(t => t.symbol === 'USDC');
          if (usdcToken) {
            setToToken(usdcToken);
          }
        }
      } catch (error) {
        console.error('Failed to load tokens:', error);
      }
    };

    loadTokens();
  }, [currentChainId, oneInchService]);

  // Calculate quote when parameters change
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken && fromToken.address !== toToken.address) {
      const delayedQuote = setTimeout(() => {
        fetchQuote();
      }, 500); // Debounce API calls

      return () => clearTimeout(delayedQuote);
    } else {
      setQuote(null);
      setToAmount("");
    }
  }, [fromAmount, fromToken, toToken, slippageTolerance]);

  const fetchQuote = async () => {
    if (!fromAmount || !fromToken || !toToken) return;

    try {
      // Convert amount to smallest unit
      const amountInSmallestUnit = parseTokenAmount(fromAmount, fromToken.decimals);

      const quoteData = await oneInchService.getQuote({
        chainId: currentChainId,
        src: fromToken.address,
        dst: toToken.address,
        amount: amountInSmallestUnit
      });

      if (quoteData.dstAmount) {
        setQuote(quoteData);
        const formattedAmount = formatTokenAmount(quoteData.dstAmount, toToken.decimals);
        setToAmount(formattedAmount);
      }
    } catch (error) {
      console.error("Failed to fetch quote:", error);
      setQuote(null);
      setToAmount("");
    }
  };

  // Handle token swap (flip from/to)
  const handleSwapTokens = () => {
    if (!fromToken || !toToken) return;

    // Swap tokens
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    // Clear amounts to trigger new quote
    setFromAmount("");
    setToAmount("");
    setQuote(null);
  };

  // Get wallet balance for selected token
  const getFromTokenBalance = () => {
    if (!fromToken) return null;
    return getTokenBalance(currentChainId, fromToken.address);
  };

  // Check if user can execute swap
  const canExecuteSwap = useMemo(() => {
    if (!fromAmount || !toAmount || !quote || !fromToken || !toToken) return false;
    if (!ethereum.wallet.isConnected) return false;

    // Check if user has sufficient balance
    const balance = getFromTokenBalance();
    if (balance) {
      const balanceNum = parseFloat(balance.formattedBalance);
      const amountNum = parseFloat(fromAmount);
      if (balanceNum < amountNum) return false;
    }

    return true;
  }, [fromAmount, toAmount, quote, fromToken, toToken, ethereum.wallet.isConnected, getFromTokenBalance]);

  const executeSwap = async () => {
    if (!canExecuteSwap || !quote || !fromToken || !toToken || !ethereum.wallet.address) return;

    try {
      // Convert amount to smallest unit
      const amountInSmallestUnit = parseTokenAmount(fromAmount, fromToken.decimals);

      const swapData = await oneInchService.buildSwap({
        chainId: currentChainId,
        src: fromToken.address,
        dst: toToken.address,
        amount: amountInSmallestUnit,
        from: ethereum.wallet.address,
        slippage: parseFloat(slippageTolerance)
      });

      console.log("Swap transaction ready:", swapData);
      // Here you would execute the transaction using the wallet
      // For now, just log the transaction data
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
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {currentNetwork.name}
                </Badge>
              </CardTitle>
              <CardDescription>
                Trade tokens on {currentNetwork.name} with best pricing from 1inch
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedNetwork} onValueChange={(value) => setSelectedNetwork(value as any)}>
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPORTED_NETWORKS).map(([key, network]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={network.logoUrl} alt={network.name} />
                          <AvatarFallback>{network.symbol}</AvatarFallback>
                        </Avatar>
                        {network.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
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