import React from "react";
import { Button } from "@/components/ui/button";
import type { DashboardApiErrorVm } from "./types";
import { AlertCircle } from "lucide-react";

interface DashboardErrorNoticeProps {
  error: DashboardApiErrorVm;
  onRetry?: () => void;
}

export const DashboardErrorNotice = ({ error, onRetry }: DashboardErrorNoticeProps) => {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-destructive mb-1">Wystąpił błąd</h3>
          <p className="text-sm text-destructive/90 mb-3">{error.message}</p>
          {error.canRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="bg-background border-destructive/20 hover:bg-destructive/10 text-destructive hover:text-destructive"
            >
              Spróbuj ponownie
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
