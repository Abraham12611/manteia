"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  Info,
  Zap,
  Shield,
  Target,
  Clock,
  TrendingUp,
  Settings
} from "lucide-react";
import { useCreateStrategy } from "@/hooks/use-create-strategy";
import { EnhancedTWAPConfig } from "./enhanced-twap-config";
import { BarrierOptionsConfig } from "./barrier-options-config";
import { DeltaHedgingConfig } from "./delta-hedging-config";
import { CustomStrategyConfig } from "./custom-strategy-config";

interface StrategyWizardProps {
  strategyType: string;
  strategyTypeData: any;
  currentStep: number;
  onStepChange: (step: number) => void;
  onBack: () => void;
}

/**
 * Strategy Wizard Component
 * Handles configuration and deployment of different strategy types
 * Based on 1inch Limit Order Protocol documentation
 */

export function StrategyWizard({
  strategyType,
  strategyTypeData,
  currentStep,
  onStepChange,
  onBack
}: StrategyWizardProps) {
  const [config, setConfig] = useState<any>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const { createStrategy, isLoading, error } = useCreateStrategy();

  const handleConfigChange = (newConfig: any) => {
    setConfig({ ...config, ...newConfig });
  };

  const handleNext = () => {
    if (currentStep < 3) {
      onStepChange(currentStep + 1);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const result = await createStrategy({
        type: strategyType,
        config: config
      });

      if (result.success) {
        // Redirect to strategy management
        window.location.href = `/limit-orders?strategy=${result.strategyId}`;
      }
    } catch (error) {
      console.error('Strategy deployment failed:', error);
    } finally {
      setIsDeploying(false);
    }
  };

  const renderConfigStep = () => {
    switch (strategyType) {
      case "enhanced_twap":
        return (
          <EnhancedTWAPConfig
            config={config}
            onChange={handleConfigChange}
          />
        );
      case "barrier_options":
        return (
          <BarrierOptionsConfig
            config={config}
            onChange={handleConfigChange}
          />
        );
      case "delta_hedging":
        return (
          <DeltaHedgingConfig
            config={config}
            onChange={handleConfigChange}
          />
        );
      case "custom_strategy":
        return (
          <CustomStrategyConfig
            config={config}
            onChange={handleConfigChange}
          />
        );
      default:
        return <div>Unknown strategy type</div>;
    }
  };

  const renderReviewStep = () => {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              Strategy Review
            </CardTitle>
            <CardDescription>
              Review your strategy configuration before deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Strategy Type */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {strategyTypeData?.icon && <strategyTypeData.icon className="h-5 w-5" />}
                  <div>
                    <p className="font-medium">{strategyTypeData?.name}</p>
                    <p className="text-sm text-muted-foreground">{strategyTypeData?.description}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {strategyTypeData?.category?.replace('_', ' ')}
                </Badge>
              </div>

              {/* Configuration Summary */}
              <div className="space-y-3">
                <h4 className="font-medium">Configuration Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(config).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg border">
                      <div className="space-y-1">
                        <div className="text-sm font-medium capitalize text-foreground">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </div>
                        <div className="text-sm text-muted-foreground break-words">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Warning */}
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Risk Warning</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Trading involves risk. Ensure you understand the strategy before deployment.
                      Monitor your positions and be prepared for potential losses.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Strategy Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {strategyTypeData?.icon && <strategyTypeData.icon className="h-6 w-6" />}
            <div>
              <CardTitle>{strategyTypeData?.name}</CardTitle>
              <CardDescription>{strategyTypeData?.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Step Content */}
      {currentStep === 2 && renderConfigStep()}
      {currentStep === 3 && renderReviewStep()}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {currentStep === 2 && (
            <Button
              onClick={handleNext}
              disabled={!config || Object.keys(config).length === 0}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {currentStep === 3 && (
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="bg-gradient-to-r from-primary to-primary-to text-primary-foreground"
            >
              {isDeploying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Deploying...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Deploy Strategy
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Deployment Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}