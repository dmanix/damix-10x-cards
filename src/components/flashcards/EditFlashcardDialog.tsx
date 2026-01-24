import type { FlashcardCardVm } from "./types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlashcardInlineEditor } from "./FlashcardInlineEditor";

interface EditFlashcardDialogProps {
  open: boolean;
  item: FlashcardCardVm | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, values: { front: string; back: string }) => Promise<void>;
  isSaving?: boolean;
}

export function EditFlashcardDialog({ open, item, onOpenChange, onSave, isSaving = false }: EditFlashcardDialogProps) {
  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edytuj fiszkę</DialogTitle>
          <DialogDescription>Zapisz zmiany w treści fiszki.</DialogDescription>
        </DialogHeader>

        <FlashcardInlineEditor
          initial={{ front: item.front, back: item.back, source: item.source }}
          isSaving={isSaving}
          onSave={(values) => onSave(item.id, values)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
