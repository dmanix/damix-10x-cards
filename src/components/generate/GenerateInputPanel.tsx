import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { DailyLimitDto } from "@/types";

interface GenerateInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  dailyLimit?: DailyLimitDto;
  validationMessage?: string;
}

export function GenerateInputPanel({
  value,
  onChange,
  onGenerate,
  isGenerating,
  dailyLimit,
  validationMessage,
}: GenerateInputPanelProps) {
  const textTrimmed = useMemo(() => value.trim(), [value]);
  const textLength = useMemo(() => textTrimmed.length, [textTrimmed]);

  const isLengthValid = useMemo(() => {
    return textLength >= 1000 && textLength <= 20000;
  }, [textLength]);

  const isDailyLimitReached = useMemo(() => {
    return dailyLimit?.remaining === 0;
  }, [dailyLimit?.remaining]);

  const canGenerate = useMemo(() => {
    if (isGenerating) return false;
    if (!isLengthValid) return false;
    if (isDailyLimitReached) return false;
    return true;
  }, [isGenerating, isLengthValid, isDailyLimitReached]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter do generowania
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canGenerate) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <label htmlFor="input-text" className="text-sm font-medium leading-none">
          Materiał do nauki
        </label>

        <textarea
          id="input-text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Wklej tekst z którego chcesz wygenerować fiszki... (min. 1000 znaków)"
          className="min-h-[240px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isGenerating}
          aria-invalid={!!validationMessage}
          aria-describedby={
            validationMessage
              ? "input-validation-message"
              : isDailyLimitReached
                ? "daily-limit-message"
                : "char-counter"
          }
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              id="char-counter"
              className={`text-xs ${
                textLength > 20000
                  ? "font-medium text-destructive"
                  : textLength >= 1000
                    ? "text-muted-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {textLength.toLocaleString()} / 20 000 znaków
            </span>

            {textLength >= 1000 && textLength <= 20000 && (
              <span className="text-xs text-green-600 dark:text-green-500">✓ Długość OK</span>
            )}
          </div>

          {validationMessage && (
            <span id="input-validation-message" className="text-xs font-medium text-destructive" role="alert">
              {validationMessage}
            </span>
          )}
        </div>
      </div>

      {isDailyLimitReached && dailyLimit && (
        <div
          id="daily-limit-message"
          className="rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/20"
          role="alert"
        >
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Wykorzystałeś dzienny limit generowań
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Limit odnowi się: {new Date(dailyLimit.resetsAtUtc).toLocaleString("pl-PL")}
          </p>
          <a
            href="/account"
            className="mt-2 inline-block text-xs font-medium text-amber-900 underline hover:no-underline dark:text-amber-200"
          >
            Zobacz szczegóły konta →
          </a>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={onGenerate} disabled={!canGenerate} className="flex-1" size="lg">
          {isGenerating ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generuję fiszki...
            </>
          ) : (
            "Generuj fiszki"
          )}
        </Button>

        {canGenerate && !isGenerating && <span className="text-xs text-muted-foreground">Ctrl+Enter</span>}
      </div>

      {dailyLimit && !isDailyLimitReached && (
        <p className="text-xs text-muted-foreground">
          Pozostałe generowania dzisiaj: <span className="font-medium">{dailyLimit.remaining}</span> /{" "}
          {dailyLimit.limit}
        </p>
      )}
    </div>
  );
}
