import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardErrorNotice } from "./DashboardErrorNotice";
import type { DashboardTileState, RecentFlashcardsVm } from "./types";
import { Layers } from "lucide-react";

interface RecentFlashcardsCardProps {
  state: DashboardTileState<RecentFlashcardsVm>;
  onRetry: () => void;
}

export const RecentFlashcardsCard = ({ state, onRetry }: RecentFlashcardsCardProps) => {
  const { status, data, error } = state;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          Ostatnio dodane fiszki
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        {status === "loading" && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {status === "error" && error && <DashboardErrorNotice error={error} onRetry={onRetry} />}

        {status === "empty" && (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">Nie masz jeszcze żadnych fiszek.</p>
            <div className="flex gap-2">
              <Button asChild variant="default" size="sm">
                <a href="/generate">Generuj AI</a>
              </Button>
              {/* Docelowo manualne dodawanie */}
            </div>
          </div>
        )}

        {status === "success" && data && (
          <ul className="space-y-4">
            {data.items.map((item) => (
              <li key={item.id} className="group">
                <a
                  href="/flashcards" // MVP: link to collection
                  className="block space-y-1 rounded-md p-2 hover:bg-muted/50 transition-colors -mx-2"
                >
                  <p className="text-sm font-medium leading-none truncate">{item.front}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.back}</p>
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
            <a href="/flashcards">Zobacz wszystkie {data.total > 0 && `(${data.total})`}</a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
