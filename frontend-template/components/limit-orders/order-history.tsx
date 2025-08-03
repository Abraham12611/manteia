"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export function OrderHistory() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Order History
        </CardTitle>
        <CardDescription>
          View historical order executions and performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Order history component will be implemented in the next iteration.
        </p>
      </CardContent>
    </Card>
  );
}