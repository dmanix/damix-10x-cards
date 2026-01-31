import { useMemo } from "react";
import { ProposalsSummaryBar } from "./ProposalsSummaryBar";
import { ProposalCard } from "./ProposalCard";
import { calculateSummary } from "./types";
import type { ProposalVm } from "./types";

interface ProposalsReviewPanelProps {
  proposals: ProposalVm[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onUndoDecision: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSaveEditAndAccept: (id: string, front: string, back: string) => void;
  onSaveAll: () => void;
  onSaveApproved: () => void;
  isSaving: boolean;
}

export function ProposalsReviewPanel({
  proposals,
  onAccept,
  onReject,
  onUndoDecision,
  onStartEdit,
  onCancelEdit,
  onSaveEditAndAccept,
  onSaveAll,
  onSaveApproved,
  isSaving,
}: ProposalsReviewPanelProps) {
  const summary = useMemo(() => calculateSummary(proposals), [proposals]);

  return (
    <section className="space-y-6" aria-labelledby="proposals-heading">
      {/* Nagłówek */}
      <div className="space-y-2">
        <h2 id="proposals-heading" className="text-2xl font-bold">
          Weryfikacja propozycji
        </h2>
        <p className="text-sm text-muted-foreground">
          Przejrzyj wygenerowane fiszki. Możesz je zaakceptować, odrzucić lub edytować przed zapisaniem.
        </p>
      </div>

      {/* Pasek podsumowania */}
      <ProposalsSummaryBar
        summary={summary}
        onSaveAll={onSaveAll}
        onSaveApproved={onSaveApproved}
        isSaving={isSaving}
      />

      {/* Lista propozycji */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr"
        role="list"
        aria-label="Lista propozycji fiszek"
      >
        {proposals.map((proposal, index) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            index={index + 1}
            onAccept={() => onAccept(proposal.id)}
            onReject={() => onReject(proposal.id)}
            onUndoDecision={() => onUndoDecision(proposal.id)}
            onEdit={() => onStartEdit(proposal.id)}
            onCancelEdit={() => onCancelEdit(proposal.id)}
            onSaveEditAndAccept={(front, back) => onSaveEditAndAccept(proposal.id, front, back)}
          />
        ))}
      </div>
    </section>
  );
}
