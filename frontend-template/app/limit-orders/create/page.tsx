"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Target,
  Zap,
  Shield,
  ArrowUpDown,
  Clock,
  Settings,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { StrategyWizard } from "@/components/limit-orders/strategy-wizard";

/**
 * Strategy Creation Wizard Page
 * Multi-step interface for creating advanced limit order strategies
 * Based on 1inch Limit Order Protocol documentation
 */

const STRATEGY_TYPES = [
  {
    id: "enhanced_twap",
    name: "Enhanced TWAP",
    description: "Time-weighted average price with slippage protection and partial fills",
    category: "execution",
    icon: ArrowUpDown,
    color: "blue",
    features: [
      "Dynamic interval adjustment",
      "Slippage protection",
      "Partial fill handling",
      "Price impact monitoring"
    ]
  },
  {
    id: "barrier_options",
    name: "Barrier Options",
    description: "Knock-in/knock-out options with barrier monitoring",
    category: "options",
    icon: Target,
    color: "purple",
    features: [
      "Knock-in/knock-out logic",
      "Barrier monitoring",
      "Real-time execution",
      "Risk management"
    ]
  },
  {
    id: "delta_hedging",
    name: "Dynamic Delta Hedging",
    description: "Automatic delta-neutral positioning with rebalancing",
    category: "risk_management",
    icon: Shield,
    color: "green",
    features: [
      "Delta calculation",
      "Auto rebalancing",
      "Risk monitoring",
      "Position management"
    ]
  },
  {
    id: "custom_strategy",
    name: "Custom Strategy",
    description: "Build your own strategy with custom predicates and logic",
    category: "custom",
    icon: Settings,
    color: "orange",
    features: [
      "Visual builder",
      "Custom predicates",
      "Action system",
      "Template library"
    ]
  }
];

export default function CreateStrategyPage() {
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const handleStrategySelect = (strategyId: string) => {
    setSelectedStrategy(strategyId);
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStrategyType = () => {
    return STRATEGY_TYPES.find(strategy => strategy.id === selectedStrategy);
  };

  return (
    <div className="flex h-svh">
      {/* Main Content */}
      <main className="overflow-auto px-4 md:px-6 lg:px-8 flex-1">
        {/* Header */}
        <header className="bg-sidebar/90 backdrop-blur-sm sticky top-0 z-50 -mx-2 px-2">
          <div className="flex shrink-0 items-center gap-2 border-b py-4 w-full max-w-7xl mx-auto">
            <div className="flex-1">
              <Link href="/limit-orders" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Limit Orders
              </Link>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-to bg-clip-text text-transparent">
                Create Strategy
              </h1>
              <p className="text-sm text-muted-foreground">
                Set up advanced trading strategies with 1inch Limit Order Protocol
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex max-lg:flex-col flex-1 gap-6 py-6 w-full max-w-7xl mx-auto">
          {/* Progress Indicator */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <span className={currentStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}>
                  Choose Strategy
                </span>
              </div>
              <Separator className="flex-1" />
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
                </div>
                <span className={currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}>
                  Configure
                </span>
              </div>
              <Separator className="flex-1" />
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > 3 ? <Check className="h-4 w-4" /> : '3'}
                </div>
                <span className={currentStep >= 3 ? 'text-foreground' : 'text-muted-foreground'}>
                  Review & Deploy
                </span>
              </div>
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Choose Strategy Type
                  </CardTitle>
                  <CardDescription>
                    Select the type of advanced trading strategy you want to create
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {STRATEGY_TYPES.map((strategy) => {
                      const IconComponent = strategy.icon;
                      const colorClasses = {
                        blue: "border-blue-300/50 bg-gradient-to-br from-blue-950/20 to-cyan-950/20 hover:from-blue-950/30 hover:to-cyan-950/30",
                        purple: "border-purple-300/50 bg-gradient-to-br from-purple-950/20 to-violet-950/20 hover:from-purple-950/30 hover:to-violet-950/30",
                        green: "border-green-300/50 bg-gradient-to-br from-green-950/20 to-emerald-950/20 hover:from-green-950/30 hover:to-emerald-950/30",
                        orange: "border-orange-300/50 bg-gradient-to-br from-orange-950/20 to-amber-950/20 hover:from-orange-950/30 hover:to-amber-950/30"
                      };

                      return (
                        <Card
                          key={strategy.id}
                          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${colorClasses[strategy.color as keyof typeof colorClasses]}`}
                          onClick={() => handleStrategySelect(strategy.id)}
                        >
                          <CardHeader>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-${strategy.color}-950/20`}>
                                <IconComponent className={`h-6 w-6 text-${strategy.color}-400`} />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg">{strategy.name}</CardTitle>
                                <CardDescription className="text-sm">
                                  {strategy.description}
                                </CardDescription>
                              </div>
                              <Badge variant="secondary" className="capitalize">
                                {strategy.category.replace('_', ' ')}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">Key Features:</p>
                              <ul className="space-y-1">
                                {strategy.features.map((feature, index) => (
                                  <li key={index} className="flex items-center gap-2 text-sm">
                                    <Check className="h-3 w-3 text-green-600" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep >= 2 && selectedStrategy && (
            <StrategyWizard
              strategyType={selectedStrategy}
              strategyTypeData={getStrategyType()}
              currentStep={currentStep}
              onStepChange={setCurrentStep}
              onBack={handleBack}
            />
          )}
        </div>
      </main>
    </div>
  );
}