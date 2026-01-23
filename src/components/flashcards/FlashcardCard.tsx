import type { FlashcardCardVm } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { FlashcardInlineEditor } from "./FlashcardInlineEditor";
import { FlashcardSourceBadge } from "./FlashcardSourceBadge";

interface FlashcardCardProps {
  item: FlashcardCardVm;
  mode: "view" | "edit" | "deleting";
  isSaving?: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSaveEdit: (id: string, values: { front: string; back: string }) => Promise<void>;
  onCloseAfterSave: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

export function FlashcardCard({
  item,
  mode,
  isSaving = false,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onCloseAfterSave,
  onRequestDelete,
}: FlashcardCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <FlashcardSourceBadge source={item.source} />
          <p className="text-xs text-muted-foreground">Utworzono: {item.createdAtLabel}</p>
        </div>
        <p className="text-xs text-muted-foreground">Aktualizacja: {item.updatedAtLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "edit" ? (
          <FlashcardInlineEditor
            initial={{ front: item.front, back: item.back, source: item.source }}
            isSaving={isSaving}
            onSave={(values) => onSaveEdit(item.id, values)}
            onCancel={() => onCancelEdit(item.id)}
            onCloseAfterSave={() => onCloseAfterSave(item.id)}
          />
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Przód</p>
              <p className="text-sm text-muted-foreground">{item.front}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Tył</p>
              <p className="text-sm text-muted-foreground">{item.back}</p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onStartEdit(item.id)}
          disabled={mode === "edit" || isSaving}
        >
          Edytuj
        </Button>
        <Button type="button" variant="destructive" onClick={() => onRequestDelete(item.id)} disabled={mode === "edit"}>
          Usuń
        </Button>
      </CardFooter>
    </Card>
  );
}
