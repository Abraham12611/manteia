"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

interface BarrierOptionsConfigProps {
  config: any;
  onChange: (config: any) => void;
}

export function BarrierOptionsConfig({ config, onChange }: BarrierOptionsConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Barrier Options Configuration
        </CardTitle>
        <CardDescription>
          Configure knock-in/knock-out options with barrier monitoring
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Barrier options configuration component will be implemented in the next iteration.
        </p>
      </CardContent>
    </Card>
  );
}