import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { QuotaStateVm } from "./types";

interface QuotaCardProps {
  state: QuotaStateVm;
}

export const QuotaCard = ({ state }: QuotaCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Limit generowania</CardTitle>
        <CardDescription>Informacje o dziennym limicie generowań.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.status === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : null}

        {state.status === "error" ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-muted-foreground">{state.error?.message}</p>
          </div>
        ) : null}

        {state.status === "success" && state.data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={state.data.isExhausted ? "destructive" : "secondary"}>
                Pozostało: {state.data.remaining} / {state.data.limit}
              </Badge>
              {state.data.isExhausted ? <span className="text-xs text-destructive">Limit wykorzystany</span> : null}
            </div>
            <p className="text-sm text-muted-foreground">Limit odnowi się: {state.data.resetsAtLocalLabel}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};
