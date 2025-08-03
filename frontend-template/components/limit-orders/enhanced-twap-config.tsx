"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Info,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowUpDown,
  RefreshCw
} from "lucide-react";
import { useOneInchService } from "@/hooks/use-1inch-service";
import { SUPPORTED_NETWORKS } from "@/lib/networks";

interface EnhancedTWAPConfigProps {
  config: any;
  onChange: (config: any) => void;
}

// Popular tokens to show by default
const DEFAULT_TOKENS_TO_SHOW = ['ETH', 'USDC', 'USDT', 'WBTC', 'DAI', 'WETH', 'UNI', 'LINK', 'ARB', 'OP', 'MATIC', 'AVAX'];

/**
 * Enhanced TWAP Configuration Component
 * Advanced time-weighted average price strategy with slippage protection
 * Based on 1inch Limit Order Protocol documentation
 */

export function EnhancedTWAPConfig({ config, onChange }: EnhancedTWAPConfigProps) {
  const [localConfig, setLocalConfig] = useState({
    chainId: 42161, // Arbitrum One
    makerAsset: "",
    takerAsset: "",
    totalAmount: "",
    intervals: 10,
    duration: 3600, // 1 hour
    slippageProtection: {
      maxSlippage: 0.01, // 1%
      priceImpactThreshold: 0.005, // 0.5%
      emergencyStop: true
    },
    dynamicAdjustment: {
      enabled: true,
      marketConditionThreshold: 0.02, // 2%
      intervalAdjustmentFactor: 0.5
    },
    partialFillHandling: {
      enabled: true,
      merkleTreeSecrets: true,
      retryFailedIntervals: true
    }
  });

  // Use real 1inch service
  const oneInchService = useOneInchService();
  const [availableTokens, setAvailableTokens] = useState<Record<string, any>>({});
  const [popularTokens, setPopularTokens] = useState<any[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  useEffect(() => {
    setLocalConfig(prev => ({ ...prev, ...config }));
  }, [config]);

  // Load tokens when chainId changes
  useEffect(() => {
    let isCancelled = false;

    const loadTokens = async () => {
      try {
        setIsLoadingTokens(true);
        setAvailableTokens({});
        setPopularTokens([]);

        const tokens = await oneInchService.getTokens(localConfig.chainId);

        if (isCancelled) return;

        setAvailableTokens(tokens);

        // Filter popular tokens
        const popular = Object.values(tokens).filter((token: any) =>
          DEFAULT_TOKENS_TO_SHOW.includes(token.symbol)
        ).slice(0, 10);

        setPopularTokens(popular);
      } catch (error) {
        console.error('Failed to load tokens:', error);
      } finally {
        if (!isCancelled) {
          setIsLoadingTokens(false);
        }
      }
    };

    loadTokens();

    return () => {
      isCancelled = true;
    };
  }, [localConfig.chainId]); // Removed oneInchService from dependencies

  const handleConfigChange = (key: string, value: any) => {
    const newConfig = { ...localConfig } as any;

    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      newConfig[parent] = { ...newConfig[parent], [child]: value };
    } else {
      newConfig[key] = value;
    }

    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const calculateAmountPerInterval = () => {
    const total = parseFloat(localConfig.totalAmount) || 0;
    const intervals = localConfig.intervals;
    return total > 0 && intervals > 0 ? (total / intervals).toFixed(6) : "0";
  };

  const calculateIntervalDuration = () => {
    const duration = localConfig.duration;
    const intervals = localConfig.intervals;
    return intervals > 0 ? Math.floor(duration / intervals) : 0;
  };

  // Helper function to get token display info
  const getTokenDisplayInfo = (address: string) => {
    const token = availableTokens[address];
    if (!token) return { symbol: 'Unknown', name: 'Unknown Token' };
    return { symbol: token.symbol, name: token.name };
  };

  return (
    <div className="space-y-6">
      {/* Basic Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Basic Configuration
          </CardTitle>
          <CardDescription>
            Set up the core TWAP parameters for your strategy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chainId">Network</Label>
              <Select
                value={localConfig.chainId.toString()}
                onValueChange={(value) => handleConfigChange('chainId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPORTED_NETWORKS).map(([key, network]) => (
                    <SelectItem key={key} value={network.chainId.toString()}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={network.logoUrl} alt={network.name} />
                          <AvatarFallback>{network.symbol}</AvatarFallback>
                        </Avatar>
                        {network.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount</Label>
              <Input
                id="totalAmount"
                type="number"
                placeholder="0.0"
                value={localConfig.totalAmount}
                onChange={(e) => handleConfigChange('totalAmount', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="makerAsset">Sell Token</Label>
              <Select
                value={localConfig.makerAsset}
                onValueChange={(value) => handleConfigChange('makerAsset', value)}
                disabled={isLoadingTokens}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingTokens ? "Loading tokens..." : "Select token to sell"}>
                    {localConfig.makerAsset && (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={availableTokens[localConfig.makerAsset]?.logoURI} alt={getTokenDisplayInfo(localConfig.makerAsset).symbol} />
                          <AvatarFallback className="text-xs">{getTokenDisplayInfo(localConfig.makerAsset).symbol[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{getTokenDisplayInfo(localConfig.makerAsset).symbol}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {isLoadingTokens ? (
                    <div className="flex items-center gap-2 p-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading tokens...</span>
                    </div>
                  ) : (
                    <>
                      {/* Popular tokens first */}
                      {popularTokens.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Popular</div>
                          {popularTokens.map((token: any) => (
                            <SelectItem key={token.address} value={token.address}>
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
                      {Object.values(availableTokens).slice(0, 50).map((token: any) => (
                        <SelectItem key={token.address} value={token.address}>
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
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="takerAsset">Buy Token</Label>
              <Select
                value={localConfig.takerAsset}
                onValueChange={(value) => handleConfigChange('takerAsset', value)}
                disabled={isLoadingTokens}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingTokens ? "Loading tokens..." : "Select token to buy"}>
                    {localConfig.takerAsset && (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={availableTokens[localConfig.takerAsset]?.logoURI} alt={getTokenDisplayInfo(localConfig.takerAsset).symbol} />
                          <AvatarFallback className="text-xs">{getTokenDisplayInfo(localConfig.takerAsset).symbol[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{getTokenDisplayInfo(localConfig.takerAsset).symbol}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {isLoadingTokens ? (
                    <div className="flex items-center gap-2 p-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading tokens...</span>
                    </div>
                  ) : (
                    <>
                      {/* Popular tokens first */}
                      {popularTokens.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Popular</div>
                          {popularTokens.map((token: any) => (
                            <SelectItem key={token.address} value={token.address}>
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
                      {Object.values(availableTokens).slice(0, 50).map((token: any) => (
                        <SelectItem key={token.address} value={token.address}>
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
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="intervals">Number of Intervals</Label>
              <Input
                id="intervals"
                type="number"
                min="1"
                max="100"
                value={localConfig.intervals}
                onChange={(e) => handleConfigChange('intervals', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Amount per interval: {calculateAmountPerInterval()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Total Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                min="60"
                value={localConfig.duration}
                onChange={(e) => handleConfigChange('duration', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Interval duration: {calculateIntervalDuration()}s
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slippage Protection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Slippage Protection
          </CardTitle>
          <CardDescription>
            Configure protection mechanisms to minimize price impact
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxSlippage">Maximum Slippage</Label>
              <Badge variant="secondary">{localConfig.slippageProtection.maxSlippage * 100}%</Badge>
            </div>
            <Slider
              id="maxSlippage"
              min={0.001}
              max={0.05}
              step={0.001}
              value={[localConfig.slippageProtection.maxSlippage]}
              onValueChange={([value]) => handleConfigChange('slippageProtection.maxSlippage', value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Orders will be cancelled if slippage exceeds this threshold
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="priceImpact">Price Impact Threshold</Label>
              <Badge variant="secondary">{localConfig.slippageProtection.priceImpactThreshold * 100}%</Badge>
            </div>
            <Slider
              id="priceImpact"
              min={0.001}
              max={0.02}
              step={0.001}
              value={[localConfig.slippageProtection.priceImpactThreshold]}
              onValueChange={([value]) => handleConfigChange('slippageProtection.priceImpactThreshold', value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum allowed price impact per interval
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="emergencyStop"
              checked={localConfig.slippageProtection.emergencyStop}
              onCheckedChange={(checked) => handleConfigChange('slippageProtection.emergencyStop', checked)}
            />
            <Label htmlFor="emergencyStop">Emergency Stop</Label>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically cancel all remaining orders if slippage exceeds limits
          </p>
        </CardContent>
      </Card>

      {/* Dynamic Adjustment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Dynamic Adjustment
          </CardTitle>
          <CardDescription>
            Automatically adjust intervals based on market conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="dynamicAdjustment"
              checked={localConfig.dynamicAdjustment.enabled}
              onCheckedChange={(checked) => handleConfigChange('dynamicAdjustment.enabled', checked)}
            />
            <Label htmlFor="dynamicAdjustment">Enable Dynamic Adjustment</Label>
          </div>

          {localConfig.dynamicAdjustment.enabled && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="volatilityThreshold">Volatility Threshold</Label>
                  <Badge variant="secondary">{localConfig.dynamicAdjustment.marketConditionThreshold * 100}%</Badge>
                </div>
                <Slider
                  id="volatilityThreshold"
                  min={0.01}
                  max={0.1}
                  step={0.01}
                  value={[localConfig.dynamicAdjustment.marketConditionThreshold]}
                  onValueChange={([value]) => handleConfigChange('dynamicAdjustment.marketConditionThreshold', value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Reduce intervals when market volatility exceeds this threshold
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="adjustmentFactor">Adjustment Factor</Label>
                  <Badge variant="secondary">{localConfig.dynamicAdjustment.intervalAdjustmentFactor * 100}%</Badge>
                </div>
                <Slider
                  id="adjustmentFactor"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={[localConfig.dynamicAdjustment.intervalAdjustmentFactor]}
                  onValueChange={([value]) => handleConfigChange('dynamicAdjustment.intervalAdjustmentFactor', value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Factor by which to reduce intervals during high volatility
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Partial Fill Handling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Partial Fill Handling
          </CardTitle>
          <CardDescription>
            Configure how to handle partial fills using 1inch's Merkle tree approach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="partialFills"
              checked={localConfig.partialFillHandling.enabled}
              onCheckedChange={(checked) => handleConfigChange('partialFillHandling.enabled', checked)}
            />
            <Label htmlFor="partialFills">Enable Partial Fills</Label>
          </div>

          {localConfig.partialFillHandling.enabled && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="merkleSecrets"
                  checked={localConfig.partialFillHandling.merkleTreeSecrets}
                  onCheckedChange={(checked) => handleConfigChange('partialFillHandling.merkleTreeSecrets', checked)}
                />
                <Label htmlFor="merkleSecrets">Use Merkle Tree Secrets</Label>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Use 1inch's Merkle tree approach for secure partial fill handling
              </p>

              <div className="flex items-center space-x-2">
                <Switch
                  id="retryFailed"
                  checked={localConfig.partialFillHandling.retryFailedIntervals}
                  onCheckedChange={(checked) => handleConfigChange('partialFillHandling.retryFailedIntervals', checked)}
                />
                <Label htmlFor="retryFailed">Retry Failed Intervals</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically retry intervals that fail to execute
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Summary */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary-to/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Strategy Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Execution Details</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• {localConfig.intervals} intervals over {Math.floor(localConfig.duration / 60)} minutes</p>
                <p>• {calculateAmountPerInterval()} per interval</p>
                <p>• {calculateIntervalDuration()}s between intervals</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Protection Features</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• Max slippage: {localConfig.slippageProtection.maxSlippage * 100}%</p>
                <p>• Price impact: {localConfig.slippageProtection.priceImpactThreshold * 100}%</p>
                <p>• Emergency stop: {localConfig.slippageProtection.emergencyStop ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}