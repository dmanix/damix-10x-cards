import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ProposalEditorProps {
  initialFront: string;
  initialBack: string;
  onSaveAndAccept: (front: string, back: string) => void;
  onCancel: () => void;
}

export function ProposalEditor({ initialFront, initialBack, onSaveAndAccept, onCancel }: ProposalEditorProps) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const frontInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus na pierwszym polu przy montowaniu
  useEffect(() => {
    frontInputRef.current?.focus();
  }, []);

  const frontTrimmed = useMemo(() => front.trim(), [front]);
  const backTrimmed = useMemo(() => back.trim(), [back]);

  const frontLength = useMemo(() => frontTrimmed.length, [frontTrimmed]);
  const backLength = useMemo(() => backTrimmed.length, [backTrimmed]);

  // Walidacja zgodna z regułami backendu
  const frontError = useMemo(() => {
    if (frontLength === 0) return "Pole nie może być puste";
    if (frontLength > 200) return "Maksymalnie 200 znaków";
    return null;
  }, [frontLength]);

  const backError = useMemo(() => {
    if (backLength === 0) return "Pole nie może być puste";
    if (backLength > 500) return "Maksymalnie 500 znaków";
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
    <div className="space-y-4 rounded-sm border border-border border-l-4 border-l-primary bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium">Edycja propozycji</span>
        <span className="text-xs text-muted-foreground">(Ctrl+Enter zapisuje, Esc anuluje)</span>
      </div>

      {/* Front field */}
      <div className="space-y-2">
        <label htmlFor="edit-front" className="text-sm font-medium">
          Przód fiszki
        </label>
        <Textarea
          ref={frontInputRef}
          id="edit-front"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pytanie lub pojęcie..."
          className="min-h-[80px] resize-y rounded-sm"
          aria-invalid={!!frontError}
          aria-describedby={frontError ? "front-error" : "front-counter"}
        />
        <div className="flex items-center justify-between text-xs">
          <span
            id="front-counter"
            className={frontLength > 200 ? "font-medium text-destructive" : "text-muted-foreground"}
          >
            {frontLength} / 200 znaków
          </span>
          {frontError && (
            <span id="front-error" className="font-medium text-destructive" role="alert">
              {frontError}
            </span>
          )}
        </div>
      </div>

      {/* Back field */}
      <div className="space-y-2">
        <label htmlFor="edit-back" className="text-sm font-medium">
          Tył fiszki
        </label>
        <Textarea
          id="edit-back"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Odpowiedź lub definicja..."
          className="min-h-[120px] resize-y rounded-sm"
          aria-invalid={!!backError}
          aria-describedby={backError ? "back-error" : "back-counter"}
        />
        <div className="flex items-center justify-between text-xs">
          <span
            id="back-counter"
            className={backLength > 500 ? "font-medium text-destructive" : "text-muted-foreground"}
          >
            {backLength} / 500 znaków
          </span>
          {backError && (
            <span id="back-error" className="font-medium text-destructive" role="alert">
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
  );
}
