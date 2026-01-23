import { useEffect, useState } from "react";

import type { FlashcardCardVm } from "./types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteFlashcardDialogProps {
  open: boolean;
  item: Pick<FlashcardCardVm, "id" | "front" | "back"> | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
  isPending?: boolean;
}

export function DeleteFlashcardDialog({
  open,
  item,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DeleteFlashcardDialogProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

  if (!item) {
    return null;
  }

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm(item.id);
      onOpenChange(false);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Nie udało się usunąć fiszki.";
      setError(message);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usuń fiszkę</AlertDialogTitle>
          <AlertDialogDescription>Tej akcji nie można cofnąć. Fiszka zostanie trwale usunięta.</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 rounded-sm border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <p className="line-clamp-2">
            <span className="font-medium text-foreground">Przód:</span> {item.front}
          </p>
          <p className="line-clamp-2">
            <span className="font-medium text-foreground">Tył:</span> {item.back}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Usuwanie..." : "Usuń"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
