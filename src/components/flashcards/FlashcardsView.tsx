import { useCallback, useMemo, useState } from "react";

import { FlashcardsList } from "./FlashcardsList";
import { FlashcardsPagination } from "./FlashcardsPagination";
import { FlashcardsToolbar } from "./FlashcardsToolbar";
import { useFlashcardsCollection } from "@/components/hooks/useFlashcardsCollection";
import type { FlashcardsApiErrorVm, FlashcardsQueryVm } from "./types";
import { CreateManualFlashcardDialog } from "./CreateManualFlashcardDialog";
import { DeleteFlashcardDialog } from "./DeleteFlashcardDialog";
import { EditFlashcardDialog } from "./EditFlashcardDialog";

export function FlashcardsView() {
  const {
    query,
    setQuery,
    listState,
    isFetching,
    refetch,
    createManual,
    updateItem,
    deleteItem,
    createDialogOpen,
    setCreateDialogOpen,
    editingId,
    setEditingId,
    deleteTargetId,
    setDeleteTargetId,
    isCreating,
    isUpdatingById,
    isDeletingById,
  } = useFlashcardsCollection();

  const [statusMessage, setStatusMessage] = useState("");

  const handleQueryChange = useCallback(
    (nextQuery: FlashcardsQueryVm) => {
      setQuery(nextQuery);
    },
    [setQuery]
  );

  const handleResetFilters = useCallback(() => {
    setQuery({
      ...query,
      page: 1,
      search: undefined,
      source: undefined,
    });
  }, [query, setQuery]);

  const handleOpenCreate = useCallback(() => {
    setCreateDialogOpen(true);
  }, [setCreateDialogOpen]);

  const handleCreate = useCallback(
    async (values: { front: string; back: string }) => {
      await createManual(values.front, values.back);
      setStatusMessage("Dodano fiszkę.");
    },
    [createManual]
  );

  const handleStartEdit = useCallback(
    (id: string) => {
      setEditingId(id);
    },
    [setEditingId]
  );

  const handleRequestDelete = useCallback(
    (id: string) => {
      setDeleteTargetId(id);
    },
    [setDeleteTargetId]
  );

  const handleSaveEdit = useCallback(
    async (id: string, values: { front: string; back: string }) => {
      const item = listState.data?.items.find((card) => card.id === id);
      if (!item) {
        return;
      }

      try {
        await updateItem(id, { ...values, source: item.source });
        setEditingId(null);
        refetch();
        setStatusMessage("Zapisano zmiany.");
      } catch (error) {
        const apiError = error as FlashcardsApiErrorVm;
        if (apiError?.kind === "not_found") {
          setEditingId(null);
          refetch();
          setStatusMessage("Nie znaleziono fiszki. Lista została odświeżona.");
        }
        throw error;
      }
    },
    [listState.data?.items, refetch, setEditingId, updateItem]
  );

  const handleCloseEditDialog = useCallback(
    (open: boolean) => {
      if (!open) {
        setEditingId(null);
      }
    },
    [setEditingId]
  );

  const editingTarget = useMemo(() => {
    if (!editingId) {
      return null;
    }
    return listState.data?.items.find((item) => item.id === editingId) ?? null;
  }, [editingId, listState.data?.items]);

  const deleteTarget = useMemo(() => {
    if (!deleteTargetId) {
      return null;
    }
    return listState.data?.items.find((item) => item.id === deleteTargetId) ?? null;
  }, [deleteTargetId, listState.data?.items]);

  const handleConfirmDelete = useCallback(
    async (id: string) => {
      try {
        await deleteItem(id);
        setStatusMessage("Usunięto fiszkę.");
        setDeleteTargetId(null);
      } catch (error) {
        const apiError = error as FlashcardsApiErrorVm;
        if (apiError?.kind === "not_found") {
          setDeleteTargetId(null);
          setStatusMessage("Fiszka była już usunięta.");
        }
        throw error;
      }
    },
    [deleteItem, setDeleteTargetId]
  );

  const handleCloseDeleteDialog = useCallback(
    (open: boolean) => {
      if (!open) {
        setDeleteTargetId(null);
      }
    },
    [setDeleteTargetId]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setQuery({
        ...query,
        page,
      });
    },
    [query, setQuery]
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      setQuery({
        ...query,
        page: 1,
        pageSize,
      });
    },
    [query, setQuery]
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Moja kolekcja</h1>
        <p className="text-sm text-muted-foreground">
          Przeglądaj i zarządzaj zapisanymi fiszkami. Filtruj, sortuj i aktualizuj swoją kolekcję.
        </p>
      </header>

      <div className="mt-6">
        <FlashcardsToolbar
          query={query}
          onQueryChange={handleQueryChange}
          onOpenCreate={handleOpenCreate}
          onResetFilters={handleResetFilters}
          isBusy={isFetching}
        />
      </div>

      <section className="mt-6" aria-busy={isFetching}>
        <FlashcardsList
          state={listState}
          editingId={editingId}
          onRetry={refetch}
          onStartEdit={handleStartEdit}
          onRequestDelete={handleRequestDelete}
          onResetFilters={handleResetFilters}
          onOpenCreate={handleOpenCreate}
        />
      </section>

      {listState.data ? (
        <FlashcardsPagination
          page={listState.data.page}
          totalPages={listState.data.totalPages}
          pageSize={listState.data.pageSize}
          total={listState.data.total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          disabled={isFetching}
        />
      ) : null}

      <CreateManualFlashcardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
        isSubmitting={isCreating}
      />

      <DeleteFlashcardDialog
        open={Boolean(deleteTargetId)}
        item={deleteTarget}
        onOpenChange={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isPending={deleteTargetId ? Boolean(isDeletingById[deleteTargetId]) : false}
      />

      <EditFlashcardDialog
        open={Boolean(editingId)}
        item={editingTarget}
        onOpenChange={handleCloseEditDialog}
        onSave={handleSaveEdit}
        isSaving={editingId ? Boolean(isUpdatingById[editingId]) : false}
      />

      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
    </main>
  );
}
