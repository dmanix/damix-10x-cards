import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GenerationsOrderVm, GenerationsQueryVm, GenerationsSortVm, GenerationStatusFilterVm } from "./types";

interface GenerationsFiltersProps {
  query: GenerationsQueryVm;
  onQueryChange: (next: GenerationsQueryVm) => void;
  onReset: () => void;
  disabled?: boolean;
}

export const GenerationsFilters = ({ query, onQueryChange, onReset, disabled }: GenerationsFiltersProps) => {
  const handleStatusChange = (value: GenerationStatusFilterVm) => {
    onQueryChange({
      ...query,
      status: value,
      page: 1,
    });
  };

  const handleSortChange = (value: GenerationsSortVm) => {
    onQueryChange({
      ...query,
      sort: value,
      page: 1,
    });
  };

  const handleOrderChange = (value: GenerationsOrderVm) => {
    onQueryChange({
      ...query,
      order: value,
      page: 1,
    });
  };

  const handlePageSizeChange = (value: string) => {
    const nextSize = Number(value);
    if (!Number.isNaN(nextSize)) {
      onQueryChange({
        ...query,
        pageSize: nextSize,
        page: 1,
      });
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <div className="flex flex-wrap gap-2">
          <Select value={query.status} onValueChange={handleStatusChange} disabled={disabled}>
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="pending">W trakcie</SelectItem>
              <SelectItem value="succeeded">Sukces</SelectItem>
              <SelectItem value="failed">Błąd</SelectItem>
            </SelectContent>
          </Select>

          <Select value={query.sort} onValueChange={handleSortChange} disabled={disabled}>
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder="Sortowanie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Data utworzenia</SelectItem>
              <SelectItem value="finishedAt">Data zakończenia</SelectItem>
            </SelectContent>
          </Select>

          <Select value={query.order} onValueChange={handleOrderChange} disabled={disabled}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Kolejność" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Najnowsze</SelectItem>
              <SelectItem value="asc">Najstarsze</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Na stronę</span>
          <Select value={String(query.pageSize)} onValueChange={handlePageSizeChange} disabled={disabled}>
            <SelectTrigger className="h-8 w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={disabled}>
          Wyczyść
        </Button>
      </CardContent>
    </Card>
  );
};
