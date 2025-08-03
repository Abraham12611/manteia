"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export function StrategyAnalytics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Strategy Analytics
        </CardTitle>
        <CardDescription>
          Performance tracking and risk analysis for your strategies
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Strategy analytics component will be implemented in the next iteration.
        </p>
      </CardContent>
    </Card>
  );
}