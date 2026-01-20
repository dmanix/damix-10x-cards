import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        return "✓ Zaakceptowana (edytowana)";
      case "rejected":
        return "✗ Odrzucona";
      default:
        return "Nieprzejrzana";
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
    <Card className={getCardClassName()} role="article" aria-label={index ? `Propozycja ${index}` : undefined}>
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <Badge variant={getBadgeVariant()} role="status">
            {getBadgeText()}
          </Badge>
          {wasEdited && decision !== "rejected" && (
            <span className="text-xs text-muted-foreground italic">edytowano lokalnie</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="space-y-4">
          {/* Front */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">PRZÓD FISZKI</div>
            <p className="text-sm leading-relaxed">{current.front}</p>
          </div>

          {/* Back */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">TYŁ FISZKI</div>
            <p className="text-sm leading-relaxed">{current.back}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {decision === "unreviewed" && (
              <>
                <Button onClick={onAccept} variant="default" size="sm">
                  Zaakceptuj
                </Button>
                <Button onClick={onReject} variant="destructive" size="sm">
                  Odrzuć
                </Button>
                <Button onClick={onEdit} variant="outline" size="sm">
                  Edytuj
                </Button>
              </>
            )}

            {(decision === "accepted_original" || decision === "accepted_edited") && (
              <>
                <Button onClick={onEdit} variant="outline" size="sm">
                  Edytuj
                </Button>
                <Button onClick={onUndoDecision} variant="ghost" size="sm">
                  Cofnij akceptację
                </Button>
                <Button onClick={onReject} variant="ghost" size="sm">
                  Odrzuć
                </Button>
              </>
            )}

            {decision === "rejected" && (
              <Button onClick={onUndoDecision} variant="outline" size="sm">
                Cofnij odrzucenie
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
