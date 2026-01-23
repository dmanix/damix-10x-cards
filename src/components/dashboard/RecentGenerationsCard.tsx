import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardErrorNotice } from "./DashboardErrorNotice";
import type { DashboardTileState, RecentGenerationsVm, RecentGenerationItemVm } from "./types";
import { Sparkles, Clock, CheckCircle2, XCircle } from "lucide-react";

interface RecentGenerationsCardProps {
  state: DashboardTileState<RecentGenerationsVm>;
  onRetry: () => void;
}

const StatusBadge = ({ status }: { status: RecentGenerationItemVm["status"] }) => {
  switch (status) {
    case "succeeded":
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Sukces
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" /> Błąd
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" /> W toku
        </Badge>
      );
  }
};

export const RecentGenerationsCard = ({ state, onRetry }: RecentGenerationsCardProps) => {
  const { status, data, error } = state;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          Ostatnie generowania
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        {status === "loading" && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-2 w-1/2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {status === "error" && error && <DashboardErrorNotice error={error} onRetry={onRetry} />}

        {status === "empty" && (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">Nie masz jeszcze żadnych generowań.</p>
            <Button asChild variant="default" size="sm">
              <a href="/generate">Rozpocznij generowanie</a>
            </Button>
          </div>
        )}

        {status === "success" && data && (
          <ul className="space-y-4">
            {data.items.map((item) => (
              <li key={item.id} className="group">
                <a
                  href="/account" // MVP: link to account/history
                  className="flex items-start justify-between p-2 rounded-md hover:bg-muted/50 transition-colors -mx-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {new Date(item.createdAt).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {item.generatedCount !== null && (
                      <p className="text-xs text-muted-foreground">Wygenerowano: {item.generatedCount}</p>
                    )}
                    {item.status === "failed" && (
                      <p className="text-xs text-destructive truncate max-w-[180px]">
                        {item.errorMessage || "Wystąpił błąd"}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={item.status} />
                </a>
                <div className="h-px bg-border/50 mt-2 group-last:hidden" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        {status === "success" && data && (
          <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground">
            <a href="/account">Zobacz historię</a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
