"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

interface DeltaHedgingConfigProps {
  config: any;
  onChange: (config: any) => void;
}

export function DeltaHedgingConfig({ config, onChange }: DeltaHedgingConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Delta Hedging Configuration
        </CardTitle>
        <CardDescription>
          Configure automatic delta-neutral positioning with rebalancing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Delta hedging configuration component will be implemented in the next iteration.
        </p>
      </CardContent>
    </Card>
  );
}