"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export function StrategyLibrary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Strategy Library
        </CardTitle>
        <CardDescription>
          Browse and customize pre-built strategy templates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Strategy library component will be implemented in the next iteration.
        </p>
      </CardContent>
    </Card>
  );
}