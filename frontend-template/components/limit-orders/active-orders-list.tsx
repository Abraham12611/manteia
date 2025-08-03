"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export function ActiveOrdersList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Active Orders
        </CardTitle>
        <CardDescription>
          Monitor your currently active limit orders and strategies
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Active orders list component will be implemented in the next iteration.
        </p>
      </CardContent>
    </Card>
  );
}