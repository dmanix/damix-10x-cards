import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Pencil, RotateCcw } from "lucide-react";
import { ProposalEditor } from "./ProposalEditor";
import type { ProposalVm } from "./types";

interface ProposalCardProps {
  proposal: ProposalVm;
  index?: number;
  onAccept: () => void;
  onReject: () => void;
  onUndoDecision: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEditAndAccept: (front: string, back: string) => void;
}

export function ProposalCard({
  proposal,
  index,
  onAccept,
  onReject,
  onUndoDecision,
  onEdit,
  onCancelEdit,
  onSaveEditAndAccept,
}: ProposalCardProps) {
  const { decision, isEditing, current, original } = proposal;

  // Określanie wyglądu na podstawie decyzji
  const getBadgeVariant = () => {
    switch (decision) {
      case "accepted_original":
      case "accepted_edited":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getBadgeText = () => {
    switch (decision) {
      case "accepted_original":
        return "✓ Zaakceptowana";
      case "accepted_edited":
        return "✓ Zaakceptowana";
      case "rejected":
        return "✗ Odrzucona";
      default:
        return "Do przejrzenia";
    }
  };

  const getCardClassName = () => {
    const base = "transition-colors";
    switch (decision) {
      case "accepted_original":
      case "accepted_edited":
        return `${base} border-green-500/50 bg-green-50/50 dark:bg-green-950/20`;
      case "rejected":
        return `${base} border-destructive/50 bg-destructive/5 opacity-60`;
      default:
        return base;
    }
  };

  const wasEdited = current.front !== original.front || current.back !== original.back;

  // Tryb edycji
  if (isEditing) {
    return (
      <ProposalEditor
        initialFront={current.front}
        initialBack={current.back}
        onSaveAndAccept={onSaveEditAndAccept}
        onCancel={onCancelEdit}
      />
    );
  }

  // Tryb read-only
  return (
    <Card
      className={`${getCardClassName()} py-3 gap-0 h-[320px] flex flex-col`}
      role="article"
      aria-label={index ? `Propozycja ${index}` : undefined}
    >
      <CardHeader className="border-b px-3 pb-2 h-8">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={getBadgeVariant()} role="status" className="text-xs py-0.5 px-2">
            {getBadgeText()}
          </Badge>
          {wasEdited && decision !== "rejected" && (
            <span title="Edytowano lokalnie">
              <Pencil className="h-3 w-3 text-muted-foreground" aria-label="Edytowano lokalnie" />
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-3 px-3 flex-1 overflow-y-auto min-h-0">
        <div className="space-y-3 h-full flex flex-col">
          {/* Text content - scrollable area */}
          <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
            {/* Front */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Przód</div>
              <p className="text-sm leading-snug">{current.front}</p>
            </div>

            {/* Back */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Tył</div>
              <p className="text-sm leading-snug">{current.back}</p>
            </div>
          </div>

          {/* Actions - always at bottom */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t mt-2">
            {decision === "unreviewed" && (
              <>
                <Button onClick={onAccept} variant="default" size="icon" className="h-8 w-8" title="Zaakceptuj">
                  <Check className="h-4 w-4" />
                </Button>
                <Button onClick={onReject} variant="destructive" size="icon" className="h-8 w-8" title="Odrzuć">
                  <X className="h-4 w-4" />
                </Button>
                <Button onClick={onEdit} variant="outline" size="icon" className="h-8 w-8" title="Edytuj">
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            )}

            {(decision === "accepted_original" || decision === "accepted_edited") && (
              <>
                <Button onClick={onEdit} variant="outline" size="icon" className="h-8 w-8" title="Edytuj">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  onClick={onUndoDecision}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Cofnij akceptację"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button onClick={onReject} variant="outline" size="icon" className="h-8 w-8" title="Odrzuć">
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}

            {decision === "rejected" && (
              <Button
                onClick={onUndoDecision}
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Cofnij odrzucenie"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
