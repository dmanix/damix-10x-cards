import { useState, useEffect, useMemo, useRef, useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProposalEditorProps {
  open: boolean;
  initialFront: string;
  initialBack: string;
  onSaveAndAccept: (front: string, back: string) => void;
  onCancel: () => void;
}

const FRONT_LIMIT = 200;
const BACK_LIMIT = 500;

export function ProposalEditor({ open, initialFront, initialBack, onSaveAndAccept, onCancel }: ProposalEditorProps) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const frontInputRef = useRef<HTMLTextAreaElement>(null);
  const frontId = useId();
  const backId = useId();

  useEffect(() => {
    setFront(initialFront);
    setBack(initialBack);
  }, [initialBack, initialFront]);

  useEffect(() => {
    if (!open) {
      return;
    }
    frontInputRef.current?.focus();
  }, [open]);

  const frontTrimmed = useMemo(() => front.trim(), [front]);
  const backTrimmed = useMemo(() => back.trim(), [back]);

  const frontLength = useMemo(() => frontTrimmed.length, [frontTrimmed]);
  const backLength = useMemo(() => backTrimmed.length, [backTrimmed]);

  // Walidacja zgodna z regułami backendu
  const frontError = useMemo(() => {
    if (frontLength === 0) return "Pole nie może być puste";
    if (frontLength > FRONT_LIMIT) return `Maksymalnie ${FRONT_LIMIT} znaków`;
    return null;
  }, [frontLength]);

  const backError = useMemo(() => {
    if (backLength === 0) return "Pole nie może być puste";
    if (backLength > BACK_LIMIT) return `Maksymalnie ${BACK_LIMIT} znaków`;
    return null;
  }, [backLength]);

  const canSave = useMemo(() => {
    return !frontError && !backError;
  }, [frontError, backError]);

  const handleSave = () => {
    if (!canSave) return;
    onSaveAndAccept(frontTrimmed, backTrimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter do zapisu
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSave) {
      e.preventDefault();
      handleSave();
    }
    // Escape do anulowania
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edytuj propozycję</DialogTitle>
          <DialogDescription>Wprowadź zmiany, aby zaakceptować fiszkę.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Front field */}
          <div className="space-y-2">
            <label htmlFor={frontId} className="text-sm font-medium">
              Przód fiszki
            </label>
            <Textarea
              ref={frontInputRef}
              id={frontId}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pytanie lub pojęcie..."
              className="min-h-[80px] resize-y rounded-sm"
              aria-invalid={!!frontError}
              aria-describedby={frontError ? `${frontId}-error` : `${frontId}-counter`}
            />
            <div className="flex items-center justify-between text-xs">
              <span
                id={`${frontId}-counter`}
                className={frontLength > FRONT_LIMIT ? "font-medium text-destructive" : "text-muted-foreground"}
              >
                {frontLength} / {FRONT_LIMIT} znaków
              </span>
              {frontError && (
                <span id={`${frontId}-error`} className="font-medium text-destructive" role="alert">
                  {frontError}
                </span>
              )}
            </div>
          </div>

          {/* Back field */}
          <div className="space-y-2">
            <label htmlFor={backId} className="text-sm font-medium">
              Tył fiszki
            </label>
            <Textarea
              id={backId}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Odpowiedź lub definicja..."
              className="min-h-[120px] resize-y rounded-sm"
              aria-invalid={!!backError}
              aria-describedby={backError ? `${backId}-error` : `${backId}-counter`}
            />
            <div className="flex items-center justify-between text-xs">
              <span
                id={`${backId}-counter`}
                className={backLength > BACK_LIMIT ? "font-medium text-destructive" : "text-muted-foreground"}
              >
                {backLength} / {BACK_LIMIT} znaków
              </span>
              {backError && (
                <span id={`${backId}-error`} className="font-medium text-destructive" role="alert">
                  {backError}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={!canSave} size="sm" className="flex-1 rounded-sm">
              Zapisz i zaakceptuj
            </Button>
            <Button onClick={onCancel} variant="outline" size="sm" className="rounded-sm">
              Anuluj
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
