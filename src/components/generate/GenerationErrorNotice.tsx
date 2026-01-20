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
        return "border-amber-500/50";
      case "low_quality":
        return "border-orange-500/50";
      case "validation":
        return "border-destructive/50";
      case "network":
        return "border-blue-500/50";
      default:
        return "border-destructive/50";
    }
  };

  const getBackgroundColor = (kind: ApiErrorVm["kind"]) => {
    switch (kind) {
      case "daily_limit":
        return "bg-amber-50 dark:bg-amber-950/20";
      case "low_quality":
        return "bg-orange-50 dark:bg-orange-950/20";
      case "validation":
        return "bg-destructive/10";
      case "network":
        return "bg-blue-50 dark:bg-blue-950/20";
      default:
        return "bg-destructive/10";
    }
  };

  const getTextColor = (kind: ApiErrorVm["kind"]) => {
    switch (kind) {
      case "daily_limit":
        return "text-amber-900 dark:text-amber-200";
      case "low_quality":
        return "text-orange-900 dark:text-orange-200";
      case "validation":
        return "text-destructive";
      case "network":
        return "text-blue-900 dark:text-blue-200";
      default:
        return "text-destructive";
    }
  };

  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 ${getBorderColor(error.kind)} ${getBackgroundColor(error.kind)}`}
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
              <Button onClick={onDismiss} variant="ghost" size="sm">
                Zamknij
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
