import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getGenerationDetail } from "./api";
import type { AccountApiErrorVm, GenerationDetailStateVm } from "./types";

interface GenerationDetailsDialogProps {
  open: boolean;
  generationId: string | null;
  onOpenChange: (open: boolean) => void;
  returnTo?: string;
}

export const GenerationDetailsDialog = ({
  open,
  generationId,
  onOpenChange,
  returnTo = "/account",
}: GenerationDetailsDialogProps) => {
  const [detailState, setDetailState] = useState<GenerationDetailStateVm>({ status: "idle" });

  const fetchDetails = useCallback(async () => {
    if (!generationId) {
      return;
    }

    setDetailState({ status: "loading" });
    try {
      const data = await getGenerationDetail(generationId, returnTo);
      setDetailState({ status: "success", data });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return;
      }
      setDetailState({ status: "error", error: error as AccountApiErrorVm });
    }
  }, [generationId, returnTo]);

  useEffect(() => {
    if (open && generationId) {
      fetchDetails();
    }
  }, [open, generationId, fetchDetails]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Szczegóły generacji</DialogTitle>
        </DialogHeader>

        {detailState.status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : null}

        {detailState.status === "error" ? (
          <div role="alert" className="space-y-3 text-sm">
            <p className="text-muted-foreground">{detailState.error?.message}</p>
            {detailState.error?.canRetry ? (
              <Button type="button" variant="outline" onClick={fetchDetails}>
                Spróbuj ponownie
              </Button>
            ) : null}
          </div>
        ) : null}

        {detailState.status === "success" && detailState.data ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-medium break-all">{detailState.data.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{detailState.data.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Utworzono</dt>
              <dd className="font-medium">{detailState.data.createdAtLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Zakończono</dt>
              <dd className="font-medium">{detailState.data.finishedAtLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Wygenerowano</dt>
              <dd className="font-medium">{detailState.data.generatedCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Zaakceptowano</dt>
              <dd className="font-medium">{detailState.data.acceptedTotalCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Zaakceptowano (oryginalne)</dt>
              <dd className="font-medium">{detailState.data.acceptedOriginalCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Zaakceptowano (edytowane)</dt>
              <dd className="font-medium">{detailState.data.acceptedEditedCount ?? "—"}</dd>
            </div>
            {detailState.data.status === "failed" ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Błąd</dt>
                <dd className="font-medium">
                  {detailState.data.errorCode ? `${detailState.data.errorCode}: ` : ""}
                  {detailState.data.errorMessage ?? "—"}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
