import { Button } from "@/components/ui/button";
import type { ProposalsSummaryVm } from "./types";

interface ProposalsSummaryBarProps {
  summary: ProposalsSummaryVm;
  onSaveAll: () => void;
  onSaveApproved: () => void;
  isSaving: boolean;
}

export function ProposalsSummaryBar({ summary, onSaveAll, onSaveApproved, isSaving }: ProposalsSummaryBarProps) {
  const nonRejectedCount = summary.totalAllCount - summary.rejectedCount;
  const canSaveAll = nonRejectedCount > 0 && !isSaving;
  const canSaveApproved = summary.acceptedCount > 0 && !isSaving;

  return (
    <aside
      className="sticky top-0 z-10 rounded-sm border border-border bg-card p-4"
      aria-label="Podsumowanie propozycji"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Statystyki */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Łącznie:</span>
            <span className="font-semibold">{summary.totalAllCount}</span>
          </div>

          <div className="h-4 w-px bg-border" aria-hidden="true" />

          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-600" aria-hidden="true" />
            <span className="text-muted-foreground">Zaakceptowane:</span>
            <span className="font-semibold text-green-700 dark:text-green-400">{summary.acceptedCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" aria-hidden="true" />
            <span className="text-muted-foreground">Odrzucone:</span>
            <span className="font-semibold text-destructive">{summary.rejectedCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-muted" aria-hidden="true" />
            <span className="text-muted-foreground">Nieprzejrzane:</span>
            <span className="font-semibold">{summary.unreviewedCount}</span>
          </div>

          {summary.editedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">({summary.editedCount} edytowanych)</span>
            </div>
          )}
        </div>

        {/* Akcje */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSaveApproved} disabled={!canSaveApproved} variant="default" size="default">
            Zapisz zatwierdzone ({summary.acceptedCount})
          </Button>

          <Button onClick={onSaveAll} disabled={!canSaveAll} variant="outline" size="default">
            Zapisz wszystkie ({nonRejectedCount})
          </Button>
        </div>
      </div>

      {!canSaveAll && !canSaveApproved && !isSaving && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          Zaakceptuj przynajmniej jedną fiszkę, aby móc zapisać.
        </p>
      )}
    </aside>
  );
}
