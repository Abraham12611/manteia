"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowUpDown,
  ArrowDown,
  Settings,
  Info,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Wallet,
  ExternalLink
} from "lucide-react";

// Popular tokens to show by default
const DEFAULT_TOKENS_TO_SHOW = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI', 'WETH', 'UNI', 'LINK', 'ARB', 'OP', 'MATIC', 'AVAX'];

interface OneInchSwapInterfaceProps {
  defaultNetwork?: keyof typeof SUPPORTED_NETWORKS;
}

export function OneInchSwapInterface({ defaultNetwork = "ethereum" }: OneInchSwapInterfaceProps) {
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

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Ref to track if component is mounted
  const isMountedRef = useRef(false);

  // Get current network config
  const currentNetwork = SUPPORTED_NETWORKS[selectedNetwork];
  const currentChainId = currentNetwork.chainId;

    // Load tokens when network changes
  useEffect(() => {
    let isCancelled = false;

    const loadTokens = async () => {
      try {
        // Reset tokens and quote, but preserve user input amounts
        setFromToken(null);
        setToToken(null);
        setQuote(null);
        // Don't clear fromAmount - let user keep their input
        setToAmount(""); // Clear calculated amount since tokens changed

        const tokens = await oneInchService.getTokens(currentChainId);

        // Check if component was unmounted or network changed during API call
        if (isCancelled) return;

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
        if (nativeToken && !isCancelled) {
          setFromToken(nativeToken);
        }

        // Set default to token (USDC if available)
        const usdcToken = Object.values(tokens).find(t => t.symbol === 'USDC');
        if (usdcToken && !isCancelled) {
          setToToken(usdcToken);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load tokens:', error);
        }
      }
    };

    // Add a small delay to prevent rapid API calls during network switching
    const timeoutId = setTimeout(loadTokens, 100);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentChainId, oneInchService]);

  // Get wallet balance for selected token
  const getFromTokenBalance = useCallback(() => {
    if (!fromToken) return null;
    return getTokenBalance(currentChainId, fromToken.address);
  }, [fromToken, currentChainId, getTokenBalance]);

  // Define fetchQuote function with useCallback to prevent infinite re-renders
  const fetchQuote = useCallback(async () => {
    console.log("🔍 fetchQuote called - checking conditions:", {
      isMounted: isMountedRef.current,
      hasFromAmount: !!fromAmount,
      hasFromToken: !!fromToken,
      hasToToken: !!toToken,
      tokensAreDifferent: fromToken?.address !== toToken?.address,
      fromTokenAddress: fromToken?.address,
      toTokenAddress: toToken?.address
    });

    if (!isMountedRef.current || !fromAmount || !fromToken || !toToken || fromToken.address === toToken.address) {
      console.log("❌ fetchQuote early return - conditions not met");
      return;
    }

    console.log("🔄 Fetching quote:", {
      amount: fromAmount,
      from: fromToken.symbol,
      to: toToken.symbol,
      chainId: currentChainId,
      walletConnected: ethereum.wallet.isConnected,
      hasBalance: !!getFromTokenBalance()
    });

    try {
      // Convert amount to smallest unit
      const amountInSmallestUnit = parseTokenAmount(fromAmount, fromToken.decimals);

      const quoteData = await oneInchService.getQuote({
        chainId: currentChainId,
        src: fromToken.address,
        dst: toToken.address,
        amount: amountInSmallestUnit
      });

      if (isMountedRef.current && quoteData.dstAmount) {
        console.log("✅ Quote received:", {
          inputAmount: fromAmount,
          outputAmount: formatTokenAmount(quoteData.dstAmount, toToken.decimals),
          quote: quoteData
        });
        setQuote(quoteData);
        const formattedAmount = formatTokenAmount(quoteData.dstAmount, toToken.decimals);
        setToAmount(formattedAmount);
      }
    } catch (error) {
      console.error("❌ Failed to fetch quote:", error);
      // Don't clear quote and toAmount on error - keep previous values
    }
  }, [fromAmount, fromToken, toToken, currentChainId, oneInchService, ethereum.wallet.isConnected]);

  // Calculate quote when parameters change
  useEffect(() => {
    console.log("📊 Quote useEffect triggered:", {
      fromAmount,
      hasFromToken: !!fromToken,
      hasToToken: !!toToken,
      tokensAreDifferent: fromToken?.address !== toToken?.address,
      willFetchQuote: fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken && fromToken.address !== toToken.address
    });

    if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken && fromToken.address !== toToken.address) {
      console.log("⏱️ Setting up delayed quote fetch...");
      const delayedQuote = setTimeout(() => {
        console.log("🚀 Executing delayed quote fetch");
        fetchQuote();
      }, 500); // Debounce API calls

      return () => clearTimeout(delayedQuote);
    }
    // Don't clear toAmount here - let user see previous quote until new one loads
  }, [fromAmount, fromToken, toToken, slippageTolerance]);

  // Handle token swap (flip from/to)
  const handleSwapTokens = () => {
    console.log("🔄 handleSwapTokens called - this should only happen when swap icon is clicked!", {
      fromToken: fromToken?.symbol,
      toToken: toToken?.symbol
    });

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

  // Check if user can execute swap (only wallet and balance checks)
  const canExecuteSwap = useMemo(() => {
    // Always allow UI interaction - only block actual swap execution
    if (!fromAmount || !toAmount || !quote || !fromToken || !toToken) return false;
    if (!ethereum.wallet.isConnected) return false;

    // Check if user has sufficient balance (only when wallet is connected)
    const balance = getFromTokenBalance();
    if (balance) {
      const balanceNum = parseFloat(balance.formattedBalance);
      const amountNum = parseFloat(fromAmount);
      if (balanceNum < amountNum) return false;
    }

    return true;
  }, [fromAmount, toAmount, quote, fromToken, toToken, ethereum.wallet.isConnected, getFromTokenBalance]);

  // Check if quote can be fetched (no wallet required)
  const canGetQuote = useMemo(() => {
    const result = fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken && fromToken.address !== toToken.address;
    console.log("🤔 canGetQuote calculation:", {
      fromAmount,
      hasValidAmount: fromAmount && parseFloat(fromAmount) > 0,
      hasFromToken: !!fromToken,
      hasToToken: !!toToken,
      tokensAreDifferent: fromToken?.address !== toToken?.address,
      result
    });
    return result;
  }, [fromAmount, fromToken, toToken]);

  const handleButtonClick = async () => {
    console.log("🔘 Button clicked:", {
      hasQuote: !!quote,
      canGetQuote,
      fromAmount,
      fromToken: fromToken?.symbol,
      toToken: toToken?.symbol,
      buttonAction: !quote && canGetQuote ? 'fetchQuote' : 'executeSwap'
    });

    // If no quote but can get quote, fetch quote
    if (!quote && canGetQuote) {
      console.log("📞 Calling fetchQuote...");
      await fetchQuote();
      return;
    }

    // Otherwise, execute swap
    console.log("🔄 Calling executeSwap...");
    await executeSwap();
  };

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

  const fromTokenBalance = getFromTokenBalance();

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
                {!ethereum.wallet.isConnected && (
                  <span className="block text-xs mt-1 text-blue-600 dark:text-blue-400">
                    💡 You can explore tokens and get quotes without connecting a wallet
                  </span>
                )}
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
          {/* From Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">From</Label>
              {fromTokenBalance && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  Balance: {fromTokenBalance.formattedBalance}
                </div>
              )}
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
                  value={fromToken?.symbol || ""}
                  onValueChange={(symbol) => {
                    console.log("🔽 From token selected:", symbol, {
                      availableTokensCount: Object.keys(availableTokens).length,
                      currentFromAmount: fromAmount
                    });
                    const token = Object.values(availableTokens).find(t => t.symbol === symbol);
                    if (token) {
                      console.log("✅ From token found:", token.symbol, token.address);
                      setFromToken(token);
                    } else {
                      console.warn("❌ From token not found for symbol:", symbol);
                    }
                  }}
                >
                  <SelectTrigger className="w-auto border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Popular tokens first */}
                    {popularTokens.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Popular</div>
                        {popularTokens.map((token) => (
                          <SelectItem key={token.address} value={token.symbol}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={token.logoURI} alt={token.symbol} />
                                <AvatarFallback className="text-xs">{token.symbol[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{token.symbol}</span>
                              <span className="text-xs text-muted-foreground">{token.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                        <Separator />
                      </>
                    )}

                    {/* All tokens */}
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">All Tokens</div>
                    {Object.values(availableTokens).slice(0, 50).map((token) => (
                      <SelectItem key={token.address} value={token.symbol}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={token.logoURI} alt={token.symbol} />
                            <AvatarFallback className="text-xs">{token.symbol[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-32">{token.name}</span>
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
            </div>

            <div className="relative">
              <Input
                type="number"
                placeholder="0.0"
                value={toAmount}
                readOnly
                className="pr-32 text-lg bg-muted/30"
              />
              {oneInchService.isLoadingQuote && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Select
                  value={toToken?.symbol || ""}
                  onValueChange={(symbol) => {
                    console.log("🔽 To token selected:", symbol, {
                      availableTokensCount: Object.keys(availableTokens).length,
                      currentFromAmount: fromAmount
                    });
                    const token = Object.values(availableTokens).find(t => t.symbol === symbol);
                    if (token) {
                      console.log("✅ To token found:", token.symbol, token.address);
                      setToToken(token);
                    } else {
                      console.warn("❌ To token not found for symbol:", symbol);
                    }
                  }}
                >
                  <SelectTrigger className="w-auto border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Popular tokens first */}
                    {popularTokens.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Popular</div>
                        {popularTokens.map((token) => (
                          <SelectItem key={token.address} value={token.symbol}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={token.logoURI} alt={token.symbol} />
                                <AvatarFallback className="text-xs">{token.symbol[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{token.symbol}</span>
                              <span className="text-xs text-muted-foreground">{token.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                        <Separator />
                      </>
                    )}

                    {/* All tokens */}
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">All Tokens</div>
                    {Object.values(availableTokens).slice(0, 50).map((token) => (
                      <SelectItem key={token.address} value={token.symbol}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={token.logoURI} alt={token.symbol} />
                            <AvatarFallback className="text-xs">{token.symbol[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-32">{token.name}</span>
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
                  <span className="text-muted-foreground">Estimated Gas</span>
                  <span>{quote.estimatedGas || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Route</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span className="text-xs">1inch Optimized</span>
                  </div>
                </div>
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
              </CardContent>
            </Card>
          )}

          {/* Execute Button */}
          <Button
            onClick={handleButtonClick}
            disabled={(!canExecuteSwap && !canGetQuote) || oneInchService.isLoadingSwap}
            className="w-full"
            size="lg"
            variant={!ethereum.wallet.isConnected ? "outline" : "default"}
          >
            {!ethereum.wallet.isConnected ? (
              "Connect Wallet to Swap"
            ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
              "Enter Amount"
            ) : !fromToken || !toToken ? (
              "Select Tokens"
            ) : fromToken.address === toToken.address ? (
              "Select Different Tokens"
            ) : oneInchService.isLoadingQuote && canGetQuote ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Getting Quote...
              </>
            ) : oneInchService.isLoadingSwap ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Building Transaction...
              </>
            ) : !quote && canGetQuote ? (
              "Get Quote"
            ) : quote && !ethereum.wallet.isConnected ? (
              "Connect Wallet to Swap"
            ) : quote && fromTokenBalance && parseFloat(fromTokenBalance.formattedBalance) < parseFloat(fromAmount) ? (
              "Insufficient Balance"
            ) : quote && !canExecuteSwap ? (
              "Connect Wallet to Swap"
            ) : (
              "Swap Tokens"
            )}
          </Button>

          {/* Info for insufficient balance - only show when wallet is connected and trying to swap */}
          {ethereum.wallet.isConnected && fromTokenBalance && parseFloat(fromTokenBalance.formattedBalance) < parseFloat(fromAmount) && fromAmount && quote && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                Note: You have {fromTokenBalance.formattedBalance} {fromToken?.symbol}, but need {fromAmount} to execute this swap.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 mt-0.5 text-blue-500" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Trading on {currentNetwork.name}</p>
              <p className="text-xs text-muted-foreground">
                Powered by 1inch DEX aggregator for optimal swap rates and minimal slippage.
              </p>
              <div className="flex items-center gap-1 mt-2">
                <ExternalLink className="h-3 w-3" />
                <span className="text-xs text-blue-600 dark:text-blue-400">View on {currentNetwork.blockExplorer.replace('https://', '')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}