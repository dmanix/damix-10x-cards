import React, { useState, useEffect, useCallback } from "react";
import { RecentFlashcardsCard } from "./RecentFlashcardsCard";
import { RecentGenerationsCard } from "./RecentGenerationsCard";
import { getRecentFlashcards, getRecentGenerations } from "./api";
import type { DashboardTileState, RecentFlashcardsVm, RecentGenerationsVm, DashboardApiErrorVm } from "./types";

export const DashboardView = () => {
  const [flashcardsState, setFlashcardsState] = useState<DashboardTileState<RecentFlashcardsVm>>({
    status: "idle",
  });
  const [generationsState, setGenerationsState] = useState<DashboardTileState<RecentGenerationsVm>>({
    status: "idle",
  });

  const fetchFlashcards = useCallback(async () => {
    setFlashcardsState((prev) => ({ ...prev, status: "loading", error: undefined }));
    try {
      const data = await getRecentFlashcards();
      setFlashcardsState({
        status: data.items.length === 0 ? "empty" : "success",
        data,
      });
    } catch (error) {
      setFlashcardsState({
        status: "error",
        error: error as DashboardApiErrorVm,
      });
    }
  }, []);

  const fetchGenerations = useCallback(async () => {
    setGenerationsState((prev) => ({ ...prev, status: "loading", error: undefined }));
    try {
      const data = await getRecentGenerations();
      setGenerationsState({
        status: data.items.length === 0 ? "empty" : "success",
        data,
      });
    } catch (error) {
      setGenerationsState({
        status: "error",
        error: error as DashboardApiErrorVm,
      });
    }
  }, []);

  useEffect(() => {
    fetchFlashcards();
    fetchGenerations();
  }, [fetchFlashcards, fetchGenerations]);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Witaj w 10x Cards! Tutaj znajdziesz swoje ostatnie aktywności.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <RecentFlashcardsCard state={flashcardsState} onRetry={fetchFlashcards} />
        <RecentGenerationsCard state={generationsState} onRetry={fetchGenerations} />
      </section>
    </div>
  );
};
