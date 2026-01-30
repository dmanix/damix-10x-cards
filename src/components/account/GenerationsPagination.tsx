import React from "react";
import { Button } from "@/components/ui/button";

interface GenerationsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export const GenerationsPagination = ({
  page,
  totalPages,
  total,
  onPageChange,
  disabled,
}: GenerationsPaginationProps) => {
  if (totalPages <= 1 && total <= 0) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="text-muted-foreground">
        Strona <span className="font-medium text-foreground">{page}</span> z{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Poprzednia
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Następna
        </Button>
      </div>
    </div>
  );
};
