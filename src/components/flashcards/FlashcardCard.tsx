import type { FlashcardCardVm } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { FlashcardSourceBadge } from "./FlashcardSourceBadge";

interface FlashcardCardProps {
  item: FlashcardCardVm;
  isEditing?: boolean;
  onStartEdit: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

export function FlashcardCard({ item, isEditing = false, onStartEdit, onRequestDelete }: FlashcardCardProps) {
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
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Przód</p>
            <p className="text-sm text-muted-foreground break-all whitespace-pre-wrap [overflow-wrap:anywhere]">
              {item.front}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Tył</p>
            <p className="text-sm text-muted-foreground break-all whitespace-pre-wrap [overflow-wrap:anywhere]">
              {item.back}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onStartEdit(item.id)} disabled={isEditing}>
          Edytuj
        </Button>
        <Button type="button" variant="destructive" onClick={() => onRequestDelete(item.id)} disabled={isEditing}>
          Usuń
        </Button>
      </CardFooter>
    </Card>
  );
}
