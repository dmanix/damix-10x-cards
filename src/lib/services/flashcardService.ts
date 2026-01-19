import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { Tables, TablesInsert } from "../../db/database.types.ts";
import type { FlashcardDto, FlashcardSource } from "../../types.ts";

type FlashcardRow = Tables<"flashcards">;
type GenerationRow = Tables<"generations">;
type FlashcardInsert = TablesInsert<"flashcards">;

export interface CreateFlashcardsInput {
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
  source: FlashcardSource;
  generationId: FlashcardRow["generation_id"];
}

export interface GenerationAcceptCount {
  originalDelta: number;
  editedDelta: number;
}

export type GenerationAcceptCounts = Record<string, GenerationAcceptCount>;

export class GenerationOwnershipError extends Error {
  constructor(public readonly missingIds: string[]) {
    super("Generation ownership mismatch.");
    this.name = "GenerationOwnershipError";
  }
}

const toFlashcardDto = (row: FlashcardRow): FlashcardDto => ({
  id: row.id,
  front: row.front,
  back: row.back,
  source: row.source as FlashcardSource,
  generationId: row.generation_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class FlashcardService {
  constructor(private readonly supabase: SupabaseClient) {}

  async validateGenerationOwnership(userId: string, generationIds: string[]): Promise<void> {
    if (generationIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(generationIds)];
    const { data, error } = await this.supabase
      .from("generations")
      .select("id")
      .in("id", uniqueIds)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to validate generation ownership: ${error.message}`);
    }

    const foundIds = new Set((data ?? []).map((row) => row.id));
    const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new GenerationOwnershipError(missingIds);
    }
  }

  buildAcceptCounts(flashcards: CreateFlashcardsInput[]): GenerationAcceptCounts {
    return flashcards.reduce<GenerationAcceptCounts>((acc, flashcard) => {
      if (!flashcard.generationId) {
        return acc;
      }

      const current = acc[flashcard.generationId] ?? { originalDelta: 0, editedDelta: 0 };
      if (flashcard.source === "ai") {
        current.originalDelta += 1;
      } else if (flashcard.source === "ai-edited") {
        current.editedDelta += 1;
      }

      acc[flashcard.generationId] = current;
      return acc;
    }, {});
  }

  async createFlashcards(userId: string, flashcards: CreateFlashcardsInput[]): Promise<FlashcardDto[]> {
    const inserts: FlashcardInsert[] = flashcards.map((flashcard) => ({
      front: flashcard.front,
      back: flashcard.back,
      source: flashcard.source,
      generation_id: flashcard.generationId,
      user_id: userId,
    }));

    const { data, error } = await this.supabase
      .from("flashcards")
      .insert(inserts)
      .select("id, front, back, source, generation_id, created_at, updated_at");

    if (error || !data) {
      throw new Error(`Failed to insert flashcards: ${error?.message ?? "Unknown error"}`);
    }

    const acceptCounts = this.buildAcceptCounts(flashcards);
    await this.applyAcceptCounts(userId, acceptCounts);

    return data.map((row) => toFlashcardDto(row as FlashcardRow));
  }

  private async applyAcceptCounts(userId: string, acceptCounts: GenerationAcceptCounts): Promise<void> {
    const generationIds = Object.keys(acceptCounts);
    if (generationIds.length === 0) {
      return;
    }

    const { data, error } = await this.supabase
      .from("generations")
      .select("id, accepted_original_count, accepted_edited_count")
      .in("id", generationIds)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to load generation counts: ${error.message}`);
    }

    const generationMap = new Map((data ?? []).map((row) => [row.id, row as GenerationRow]));
    const missingIds = generationIds.filter((id) => !generationMap.has(id));
    if (missingIds.length > 0) {
      throw new GenerationOwnershipError(missingIds);
    }

    await Promise.all(
      generationIds.map(async (generationId) => {
        const current = generationMap.get(generationId);
        const delta = acceptCounts[generationId];
        if (!current || !delta) {
          return;
        }

        const nextOriginal = (current.accepted_original_count ?? 0) + delta.originalDelta;
        const nextEdited = (current.accepted_edited_count ?? 0) + delta.editedDelta;

        const { error: updateError } = await this.supabase
          .from("generations")
          .update({
            accepted_original_count: nextOriginal,
            accepted_edited_count: nextEdited,
          })
          .eq("id", generationId)
          .eq("user_id", userId);

        if (updateError) {
          throw new Error(`Failed to update generation counts: ${updateError.message}`);
        }
      })
    );
  }
}
