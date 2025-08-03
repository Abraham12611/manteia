"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

interface CustomStrategyConfigProps {
  config: any;
  onChange: (config: any) => void;
}

export function CustomStrategyConfig({ config, onChange }: CustomStrategyConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Custom Strategy Configuration
        </CardTitle>
        <CardDescription>
          Build your own strategy with custom predicates and logic
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Custom strategy configuration component will be implemented in the next iteration.
        </p>
      </CardContent>
    </Card>
  );
}