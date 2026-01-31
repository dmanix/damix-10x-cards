import { useState, useCallback, useMemo } from "react";
import { GenerateInputPanel } from "./GenerateInputPanel";
import { BlockingOverlay } from "./BlockingOverlay";
import { GenerationErrorNotice } from "./GenerationErrorNotice";
import { ProposalsReviewPanel } from "./ProposalsReviewPanel";
import { generateFlashcards, saveFlashcards, mapNetworkError } from "./api";
import { mapProposalDtoToVm } from "./types";
import type { GenerationSessionVm, ProposalVm, ApiErrorVm } from "./types";
import type { CreateFlashcardsCommand } from "@/types";

interface GenerateViewProps {
  initialText?: string;
}

export default function GenerateView({ initialText = "" }: GenerateViewProps) {
  // Stan formularza
  const [inputText, setInputText] = useState(initialText);
  const [inputTouched, setInputTouched] = useState(false);

  // Stan procesów
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Stan danych
  const [generationSession, setGenerationSession] = useState<GenerationSessionVm | null>(null);
  const [proposals, setProposals] = useState<ProposalVm[]>([]);

  // Stan błędów
  const [error, setError] = useState<ApiErrorVm | null>(null);

  // Stan sukcesu
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Walidacja długości tekstu
  const textTrimmed = useMemo(() => inputText.trim(), [inputText]);
  const textLength = useMemo(() => textTrimmed.length, [textTrimmed]);

  const validationMessage = useMemo(() => {
    if (!inputTouched) return undefined;

    if (textLength < 1000) {
      return "Tekst musi mieć co najmniej 1000 znaków.";
    }
    if (textLength > 20000) {
      return "Tekst może mieć maksymalnie 20000 znaków.";
    }
    return undefined;
  }, [textLength, inputTouched]);

  const canGenerate = useMemo(() => {
    if (isGenerating) return false;
    if (textLength < 1000 || textLength > 20000) return false;
    if (generationSession?.dailyLimit.remaining === 0) return false;
    return true;
  }, [isGenerating, textLength, generationSession?.dailyLimit.remaining]);

  // Handler zmiany tekstu
  const handleTextChange = useCallback(
    (value: string) => {
      setInputText(value);
      if (!inputTouched) {
        setInputTouched(true);
      }
    },
    [inputTouched]
  );

  // Handler generowania
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateFlashcards(textTrimmed);

      // Mapowanie odpowiedzi na ViewModel
      const session: GenerationSessionVm = {
        generationId: response.generation.id,
        createdAt: response.generation.createdAt,
        dailyLimit: response.dailyLimit,
      };

      const proposalsVm = response.proposals.map(mapProposalDtoToVm);

      setGenerationSession(session);
      setProposals(proposalsVm);
    } catch (err) {
      // Obsługa błędów API
      if (err && typeof err === "object" && "kind" in err) {
        setError(err as ApiErrorVm);
      } else if (err instanceof Error) {
        setError(mapNetworkError());
      } else {
        setError({
          kind: "unknown",
          message: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
          canRetry: true,
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, textTrimmed]);

  // Akcje na propozycjach
  const handleAccept = useCallback((id: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;

        const wasEdited = p.current.front !== p.original.front || p.current.back !== p.original.back;

        return {
          ...p,
          decision: wasEdited ? "accepted_edited" : "accepted_original",
          isEditing: false,
        };
      })
    );
  }, []);

  const handleReject = useCallback((id: string) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, decision: "rejected", isEditing: false } : p)));
  }, []);

  const handleUndoDecision = useCallback((id: string) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, decision: "unreviewed", isEditing: false } : p)));
  }, []);

  const handleStartEdit = useCallback((id: string) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, isEditing: true } : p)));
  }, []);

  const handleCancelEdit = useCallback((id: string) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, isEditing: false } : p)));
  }, []);

  const handleSaveEditAndAccept = useCallback((id: string, front: string, back: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;

        return {
          ...p,
          current: { front: front.trim(), back: back.trim() },
          decision: "accepted_edited",
          isEditing: false,
        };
      })
    );
  }, []);

  // Helper: budowanie CreateFlashcardsCommand
  const buildSaveCommand = useCallback(
    (mode: "all" | "approved"): CreateFlashcardsCommand | null => {
      if (!generationSession) return null;

      let flashcardsToSave = proposals;

      if (mode === "all") {
        // Zapisz wszystkie nieodrzucone
        flashcardsToSave = proposals.filter((p) => p.decision !== "rejected");
      } else {
        // Zapisz tylko zatwierdzone
        flashcardsToSave = proposals.filter(
          (p) => p.decision === "accepted_original" || p.decision === "accepted_edited"
        );
      }

      if (flashcardsToSave.length === 0) return null;

      return {
        flashcards: flashcardsToSave.map((p) => {
          const wasEdited = p.current.front !== p.original.front || p.current.back !== p.original.back;
          const source = wasEdited ? ("ai-edited" as const) : ("ai" as const);

          return {
            front: p.current.front.trim(),
            back: p.current.back.trim(),
            source,
            generationId: generationSession.generationId,
          };
        }),
      };
    },
    [proposals, generationSession]
  );

  // Zapisywanie fiszek
  const handleSaveAll = useCallback(async () => {
    const command = buildSaveCommand("all");
    if (!command) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await saveFlashcards(command);
      setSaveSuccess(true);
      setGenerationSession(null);
      setProposals([]);
      setInputText("");
      setInputTouched(false);
    } catch (err) {
      if (err && typeof err === "object" && "kind" in err) {
        setError(err as ApiErrorVm);
      } else if (err instanceof Error && err.message !== "Unauthorized") {
        setError(mapNetworkError());
      }
      // Jeśli Unauthorized, to już nastąpił redirect
    } finally {
      setIsSaving(false);
    }
  }, [buildSaveCommand]);

  const handleSaveApproved = useCallback(async () => {
    const command = buildSaveCommand("approved");
    if (!command) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await saveFlashcards(command);
      setSaveSuccess(true);
      setGenerationSession(null);
      setProposals([]);
      setInputText("");
      setInputTouched(false);
    } catch (err) {
      if (err && typeof err === "object" && "kind" in err) {
        setError(err as ApiErrorVm);
      } else if (err instanceof Error && err.message !== "Unauthorized") {
        setError(mapNetworkError());
      }
      // Jeśli Unauthorized, to już nastąpił redirect
    } finally {
      setIsSaving(false);
    }
  }, [buildSaveCommand]);

  const handleRetry = useCallback(() => {
    setError(null);
    // Resetowanie stanu w zależności od kontekstu
    if (!generationSession) {
      handleGenerate();
    }
  }, [generationSession, handleGenerate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Blocking Overlay */}
      <BlockingOverlay
        open={isGenerating || isSaving}
        label={isGenerating ? "Generowanie fiszek..." : "Zapisywanie fiszek..."}
      />

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isGenerating && "Generowanie fiszek w toku..."}
        {isSaving && "Zapisywanie fiszek..."}
        {saveSuccess && "Fiszki zostały pomyślnie zapisane"}
        {error && `Błąd: ${error.message}`}
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Generuj fiszki</h1>
          <p className="text-muted-foreground">
            Wklej materiał do nauki (1000–20000 znaków), a AI wygeneruje dla Ciebie fiszki.
          </p>
        </header>

        <main className="space-y-6" role="main">
          {/* Input Panel */}
          <GenerateInputPanel
            value={inputText}
            onChange={handleTextChange}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            dailyLimit={generationSession?.dailyLimit}
            validationMessage={validationMessage}
          />

          {/* Error Notice */}
          <GenerationErrorNotice error={error} onRetry={handleRetry} onDismiss={() => setError(null)} />

          {/* Success Notice */}
          {saveSuccess && (
            <div className="rounded-sm border border-border border-l-4 border-l-green-600 bg-card p-4" role="alert">
              <div className="flex items-start gap-3">
                <span className="text-2xl text-green-700 dark:text-green-300" aria-hidden="true">
                  ✓
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Fiszki zostały zapisane!</p>
                  <p className="mt-1 text-xs text-muted-foreground">Możesz rozpocząć generowanie kolejnych fiszek.</p>
                </div>
                <button
                  onClick={() => setSaveSuccess(false)}
                  className="inline-flex items-center rounded-sm border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Zamknij
                </button>
              </div>
            </div>
          )}

          {/* Proposals Panel */}
          {generationSession && proposals.length > 0 && (
            <ProposalsReviewPanel
              proposals={proposals}
              onAccept={handleAccept}
              onReject={handleReject}
              onUndoDecision={handleUndoDecision}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEditAndAccept={handleSaveEditAndAccept}
              onSaveAll={handleSaveAll}
              onSaveApproved={handleSaveApproved}
              isSaving={isSaving}
            />
          )}
        </main>
      </div>
    </div>
  );
}
