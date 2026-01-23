import { useEffect, useId, useMemo, useState } from "react";

import type { FlashcardSource } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FlashcardInlineEditorProps {
  initial: { front: string; back: string; source: FlashcardSource };
  isSaving?: boolean;
  onSave: (values: { front: string; back: string }) => Promise<void>;
  onCancel: () => void;
  onCloseAfterSave?: () => void;
}

const FRONT_LIMIT = 200;
const BACK_LIMIT = 500;

export function FlashcardInlineEditor({
  initial,
  isSaving = false,
  onSave,
  onCancel,
  onCloseAfterSave,
}: FlashcardInlineEditorProps) {
  const frontId = useId();
  const backId = useId();
  const [front, setFront] = useState(initial.front);
  const [back, setBack] = useState(initial.back);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [backError, setBackError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setFront(initial.front);
    setBack(initial.back);
    setFrontError(null);
    setBackError(null);
    setFormError(null);
    setSuccessMessage(null);
  }, [initial.back, initial.front]);

  const trimmedFront = front.trim();
  const trimmedBack = back.trim();

  useEffect(() => {
    if (front.length > FRONT_LIMIT) {
      setFrontError(`Maksymalnie ${FRONT_LIMIT} znaków.`);
    } else {
      setFrontError(null);
    }

    if (back.length > BACK_LIMIT) {
      setBackError(`Maksymalnie ${BACK_LIMIT} znaków.`);
    } else {
      setBackError(null);
    }
  }, [back.length, front.length]);

  useEffect(() => {
    if (successMessage) {
      setSuccessMessage(null);
    }
  }, [back, front, successMessage]);

  const isDirty = useMemo(
    () => trimmedFront !== initial.front.trim() || trimmedBack !== initial.back.trim(),
    [initial.back, initial.front, trimmedBack, trimmedFront]
  );

  const isValid = useMemo(() => {
    return (
      trimmedFront.length >= 1 &&
      trimmedFront.length <= FRONT_LIMIT &&
      trimmedBack.length >= 1 &&
      trimmedBack.length <= BACK_LIMIT
    );
  }, [trimmedBack.length, trimmedFront.length]);

  const validate = () => {
    let valid = true;

    if (trimmedFront.length < 1 || trimmedFront.length > FRONT_LIMIT) {
      setFrontError(`Wprowadź od 1 do ${FRONT_LIMIT} znaków.`);
      valid = false;
    } else {
      setFrontError(null);
    }

    if (trimmedBack.length < 1 || trimmedBack.length > BACK_LIMIT) {
      setBackError(`Wprowadź od 1 do ${BACK_LIMIT} znaków.`);
      valid = false;
    } else {
      setBackError(null);
    }

    return valid;
  };

  const handleSave = async () => {
    setFormError(null);

    if (!validate()) {
      return;
    }

    if (!isDirty) {
      setFormError("Wprowadź zmianę w treści fiszki.");
      return;
    }

    try {
      await onSave({ front: trimmedFront, back: trimmedBack });
      setSuccessMessage("Zapisano zmiany.");
    } catch (error) {
      const message = (error as { message?: string })?.message ?? "Nie udało się zapisać zmian.";
      setFormError(message);
    }
  };

  return (
    <div className="space-y-4">
      {initial.source === "ai" ? (
        <p className="text-xs text-muted-foreground">Edycja oznaczy fiszkę jako AI (edytowana).</p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={frontId} className="text-sm font-medium">
          Przód
        </label>
        <Textarea
          id={frontId}
          value={front}
          onChange={(event) => setFront(event.target.value)}
          rows={3}
          className="max-h-40 break-words whitespace-pre-wrap [overflow-wrap:anywhere] [field-sizing:fixed] overflow-y-auto"
          aria-describedby={frontError ? `${frontId}-error` : undefined}
          aria-invalid={Boolean(frontError)}
          disabled={isSaving}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{frontError ? <span id={`${frontId}-error`}>{frontError}</span> : " "}</span>
          <span>
            {front.length}/{FRONT_LIMIT}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={backId} className="text-sm font-medium">
          Tył
        </label>
        <Textarea
          id={backId}
          value={back}
          onChange={(event) => setBack(event.target.value)}
          rows={4}
          className="max-h-48 break-words whitespace-pre-wrap [overflow-wrap:anywhere] [field-sizing:fixed] overflow-y-auto"
          aria-describedby={backError ? `${backId}-error` : undefined}
          aria-invalid={Boolean(backError)}
          disabled={isSaving}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{backError ? <span id={`${backId}-error`}>{backError}</span> : " "}</span>
          <span>
            {back.length}/{BACK_LIMIT}
          </span>
        </div>
      </div>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-emerald-600" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={!isDirty || !isValid || isSaving}>
          {isSaving ? "Zapisywanie..." : "Zapisz"}
        </Button>
        {successMessage && onCloseAfterSave ? (
          <Button type="button" variant="outline" onClick={onCloseAfterSave}>
            Zamknij
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
