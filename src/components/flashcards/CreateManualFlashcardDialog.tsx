import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface CreateManualFlashcardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: { front: string; back: string }) => Promise<void>;
  isSubmitting?: boolean;
}

const FRONT_LIMIT = 200;
const BACK_LIMIT = 500;

export function CreateManualFlashcardDialog({
  open,
  onOpenChange,
  onCreate,
  isSubmitting = false,
}: CreateManualFlashcardDialogProps) {
  const frontId = useId();
  const backId = useId();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [frontError, setFrontError] = useState<string | null>(null);
  const [backError, setBackError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFront("");
      setBack("");
      setFrontError(null);
      setBackError(null);
      setFormError(null);
    }
  }, [open]);

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

  const isValid =
    trimmedFront.length >= 1 &&
    trimmedFront.length <= FRONT_LIMIT &&
    trimmedBack.length >= 1 &&
    trimmedBack.length <= BACK_LIMIT;

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

  const handleSubmit = async () => {
    setFormError(null);
    if (!validate()) {
      return;
    }

    try {
      await onCreate({ front: trimmedFront, back: trimmedBack });
      onOpenChange(false);
    } catch (error) {
      const message = (error as { message?: string })?.message ?? "Nie udało się dodać fiszki.";
      setFormError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj nową fiszkę</DialogTitle>
          <DialogDescription>Wprowadź treść fiszki, która trafi do Twojej kolekcji.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={frontId} className="text-sm font-medium">
              Przód
            </label>
            <Textarea
              id={frontId}
              value={front}
              onChange={(event) => setFront(event.target.value)}
              rows={3}
              className="max-h-40 break-all whitespace-pre-wrap [overflow-wrap:anywhere] [field-sizing:fixed] overflow-y-auto"
              aria-describedby={frontError ? `${frontId}-error` : undefined}
              aria-invalid={Boolean(frontError)}
              disabled={isSubmitting}
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
              className="max-h-48 break-all whitespace-pre-wrap [overflow-wrap:anywhere] [field-sizing:fixed] overflow-y-auto"
              aria-describedby={backError ? `${backId}-error` : undefined}
              aria-invalid={Boolean(backError)}
              disabled={isSubmitting}
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Anuluj
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !isValid}>
            {isSubmitting ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
