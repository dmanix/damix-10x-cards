import React, { useCallback, useEffect, useState } from "react";
import { ProfileSection } from "./ProfileSection";
import { QuotaCard } from "./QuotaCard";
import { GenerationsHistorySection } from "./GenerationsHistorySection";
import { getGenerationQuota } from "./api";
import type { AccountApiErrorVm, QuotaStateVm } from "./types";

interface AccountViewProps {
  email?: string | null;
  returnTo?: string;
}

export const AccountView = ({ email, returnTo = "/account" }: AccountViewProps) => {
  const [quotaState, setQuotaState] = useState<QuotaStateVm>({ status: "idle" });
  const [statusMessage, setStatusMessage] = useState("");

  const fetchQuota = useCallback(async () => {
    setQuotaState((prev) => ({ ...prev, status: "loading", error: undefined }));
    try {
      const data = await getGenerationQuota(returnTo);
      setQuotaState({ status: "success", data });
      setStatusMessage("Odświeżono limit generowania.");
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return;
      }
      setQuotaState({
        status: "error",
        error: error as AccountApiErrorVm,
      });
    }
  }, [returnTo]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Konto</h1>
        <p className="text-muted-foreground mt-2">Zarządzaj sesją i sprawdzaj status generowań.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <ProfileSection email={email} />
        <QuotaCard state={quotaState} />
      </section>

      <GenerationsHistorySection returnTo={returnTo} />

      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
    </main>
  );
};
