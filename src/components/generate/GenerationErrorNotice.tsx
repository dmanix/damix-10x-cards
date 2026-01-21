import { Button } from "@/components/ui/button";
import type { ApiErrorVm } from "./types";

interface GenerationErrorNoticeProps {
  error: ApiErrorVm | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function GenerationErrorNotice({ error, onRetry, onDismiss }: GenerationErrorNoticeProps) {
  if (!error) return null;

  const getErrorIcon = (kind: ApiErrorVm["kind"]) => {
    switch (kind) {
      case "daily_limit":
        return "⏱️";
      case "low_quality":
        return "⚠️";
      case "validation":
        return "❌";
      case "network":
        return "🌐";
      case "unauthorized":
        return "🔒";
      default:
        return "❗";
    }
  };

  const getBorderColor = (kind: ApiErrorVm["kind"]) => {
    switch (kind) {
      case "daily_limit":
        return "border-l-amber-600";
      case "low_quality":
        return "border-l-orange-600";
      case "validation":
        return "border-l-destructive";
      case "network":
        return "border-l-blue-600";
      default:
        return "border-l-destructive";
    }
  };

  const getBackgroundColor = (kind: ApiErrorVm["kind"]) => {
    switch (kind) {
      case "daily_limit":
        return "bg-card";
      case "low_quality":
        return "bg-card";
      case "validation":
        return "bg-card";
      case "network":
        return "bg-card";
      default:
        return "bg-card";
    }
  };

  const getTextColor = (kind: ApiErrorVm["kind"]) => {
    switch (kind) {
      case "daily_limit":
        return "text-amber-700 dark:text-amber-300";
      case "low_quality":
        return "text-orange-700 dark:text-orange-300";
      case "validation":
        return "text-destructive";
      case "network":
        return "text-blue-700 dark:text-blue-300";
      default:
        return "text-destructive";
    }
  };

  return (
    <div
      role="alert"
      className={`rounded-sm border border-border border-l-4 p-4 ${getBorderColor(error.kind)} ${getBackgroundColor(
        error.kind
      )}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          {getErrorIcon(error.kind)}
        </span>

        <div className="flex-1 space-y-2">
          <div>
            <p className={`text-sm font-medium ${getTextColor(error.kind)}`}>{error.message}</p>
            {error.code && (
              <p className="mt-1 text-xs opacity-70">
                Kod błędu: <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">{error.code}</code>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {error.canRetry && onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                Spróbuj ponownie
              </Button>
            )}

            {error.action?.type === "link" && (
              <Button asChild variant="outline" size="sm">
                <a href={error.action.href}>{error.action.label}</a>
              </Button>
            )}

            {onDismiss && (
              <Button onClick={onDismiss} variant="outline" size="sm">
                Zamknij
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
