"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  TrendingUp,
  Shield,
  Zap,
  Clock,
  BarChart3,
  Settings,
  ArrowUpDown,
  Target,
  Activity
} from "lucide-react";
import Link from "next/link";
import { useLimitOrders } from "@/hooks/use-limit-orders";
import { useStrategyTemplates } from "@/hooks/use-strategy-templates";
import { ActiveOrdersList } from "@/components/limit-orders/active-orders-list";
import { StrategyLibrary } from "@/components/limit-orders/strategy-library";
import { OrderHistory } from "@/components/limit-orders/order-history";
import { StrategyAnalytics } from "@/components/limit-orders/strategy-analytics";

/**
 * Main Limit Orders Page
 * Provides overview of all limit order strategies and management interface
 * Based on 1inch Limit Order Protocol documentation
 */

export default function LimitOrdersPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { activeOrders, isLoading: ordersLoading } = useLimitOrders();
  const { templates, isLoading: templatesLoading } = useStrategyTemplates();

  // Calculate summary statistics
  const totalActiveOrders = activeOrders?.length || 0;
  const totalValue = activeOrders?.reduce((sum, order) => sum + parseFloat(order.makingAmount || "0"), 0) || 0;
  const successRate = activeOrders?.filter(order => order.status === "filled").length / totalActiveOrders * 100 || 0;

  return (
    <div className="flex h-svh">
      {/* Main Content */}
      <main className="overflow-auto px-4 md:px-6 lg:px-8 flex-1">
        {/* Header */}
        <header className="bg-sidebar/90 backdrop-blur-sm sticky top-0 z-50 -mx-2 px-2">
          <div className="flex shrink-0 items-center gap-2 border-b py-4 w-full max-w-7xl mx-auto">
            <div className="flex-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-to bg-clip-text text-transparent">
                Limit Orders
              </h1>
              <p className="text-sm text-muted-foreground">
                Advanced trading strategies powered by 1inch Limit Order Protocol
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/limit-orders/create">
                <Button className="bg-gradient-to-r from-primary to-primary-to text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Strategy
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex max-lg:flex-col flex-1 gap-6 py-6 w-full max-w-7xl mx-auto">
          {/* Overview Section */}
          <div className="space-y-6">
            {/* Strategy Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary-to/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <CardTitle className="text-sm">Active Orders</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalActiveOrders}</div>
                  <p className="text-xs text-muted-foreground">Currently running</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-300/50 bg-gradient-to-br from-green-950/20 to-emerald-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    <CardTitle className="text-sm">Total Value</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">In active orders</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-300/50 bg-gradient-to-br from-blue-950/20 to-cyan-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-400" />
                    <CardTitle className="text-sm">Success Rate</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">Orders filled</p>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-300/50 bg-gradient-to-br from-purple-950/20 to-violet-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-400" />
                    <CardTitle className="text-sm">Strategies</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{templates?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Available templates</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Active Orders
                </TabsTrigger>
                <TabsTrigger value="strategies" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Strategies
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  History
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Quick Actions
                      </CardTitle>
                      <CardDescription>
                        Create new strategies or manage existing ones
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Link href="/limit-orders/create">
                        <Button variant="outline" className="w-full justify-start">
                          <Plus className="h-4 w-4 mr-2" />
                          Create New Strategy
                        </Button>
                      </Link>
                      <Link href="/limit-orders/strategies">
                        <Button variant="outline" className="w-full justify-start">
                          <Target className="h-4 w-4 mr-2" />
                          Browse Templates
                        </Button>
                      </Link>
                      <Link href="/limit-orders/analytics">
                        <Button variant="outline" className="w-full justify-start">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          View Analytics
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>

                  {/* Strategy Types */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Strategy Types
                      </CardTitle>
                      <CardDescription>
                        Available advanced trading strategies
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-950/20 to-cyan-950/20 border border-blue-300/50">
                        <div className="flex items-center gap-3">
                          <ArrowUpDown className="h-5 w-5 text-blue-400" />
                          <div>
                            <p className="font-medium text-sm">Enhanced TWAP</p>
                            <p className="text-xs text-muted-foreground">Time-weighted execution with slippage protection</p>
                          </div>
                        </div>
                        <Badge variant="secondary">Execution</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-950/20 to-violet-950/20 border border-purple-300/50">
                        <div className="flex items-center gap-3">
                          <Target className="h-5 w-5 text-purple-400" />
                          <div>
                            <p className="font-medium text-sm">Barrier Options</p>
                            <p className="text-xs text-muted-foreground">Knock-in/knock-out options with barrier monitoring</p>
                          </div>
                        </div>
                        <Badge variant="secondary">Options</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-green-950/20 to-emerald-950/20 border border-green-300/50">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-green-400" />
                          <div>
                            <p className="font-medium text-sm">Delta Hedging</p>
                            <p className="text-xs text-muted-foreground">Automatic delta-neutral positioning</p>
                          </div>
                        </div>
                        <Badge variant="secondary">Risk Management</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="active" className="space-y-4">
                <ActiveOrdersList />
              </TabsContent>

              <TabsContent value="strategies" className="space-y-4">
                <StrategyLibrary />
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <OrderHistory />
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <StrategyAnalytics />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}