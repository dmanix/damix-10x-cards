import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { Tables, TablesInsert } from "../../db/database.types.ts";
import type {
  FlashcardDto,
  FlashcardListQuery,
  FlashcardListResponse,
  FlashcardSource,
  UpdateFlashcardCommand,
  UpdateFlashcardResponse,
} from "../../types.ts";

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

export class FlashcardNotFoundError extends Error {
  constructor(flashcardId: string) {
    super(`Flashcard ${flashcardId} not found or not owned by the user.`);
    this.name = "FlashcardNotFoundError";
  }
}

/**
 * Converts a FlashcardRow object to a FlashcardDto object.
 * @param {FlashcardRow} row - The FlashcardRow object to convert.
 * @returns {FlashcardDto} The converted FlashcardDto object.
 */
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
  /**
   * @param supabase
   */
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Validates that the user owns the specified generations.
   * @param userId The ID of the user.
   * @param generationIds The IDs of the generations to validate.
   * @throws {Error} If there is an error fetching the generations.
   * @throws {GenerationOwnershipError} If the user does not own all of the specified generations.
   */
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

  /**
   * Builds a map of generation IDs to accept counts based on the given flashcards.
   * @param flashcards The flashcards to build the accept counts from.
   * @returns A map of generation IDs to accept counts.
   */
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

  /**
   * Creates new flashcards for a user.
   * @param userId The ID of the user creating the flashcards.
   * @param flashcards An array of flashcard input data.
   * @returns A promise that resolves to an array of created flashcard DTOs.
   * @throws {Error} If the flashcard insertion fails.
   */
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

  /**
   * Lists flashcards for a user based on the provided query parameters.
   * @param userId The ID of the user.
   * @param query The query parameters for listing flashcards.
   * @returns A promise that resolves to a FlashcardListResponse object.
   * @throws {Error} If there is an error listing the flashcards.
   */
  async listFlashcards(userId: string, query: FlashcardListQuery): Promise<FlashcardListResponse> {
    const { page = 1, pageSize = 20, sort = "createdAt", order = "desc", source, search, since } = query;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = this.supabase
      .from("flashcards")
      .select("id, front, back, source, generation_id, created_at, updated_at", { count: "exact" })
      .eq("user_id", userId);

    if (source) {
      request = request.eq("source", source);
    }

    if (search) {
      const trimmed = search.trim();
      request = request.or(`front.ilike.%${trimmed}%,back.ilike.%${trimmed}%`);
    }

    if (since) {
      request = request.gte("updated_at", since);
    }

    const orderColumn = sort === "updatedAt" ? "updated_at" : "created_at";
    const { data, error, count } = await request.order(orderColumn, { ascending: order === "asc" }).range(from, to);

    if (error) {
      throw new Error(`Failed to list flashcards: ${error.message}`);
    }

    return {
      items: (data ?? []).map((row) => toFlashcardDto(row as FlashcardRow)),
      page,
      pageSize,
      total: count ?? 0,
    };
  }

  /**
   * Retrieves a flashcard by its ID.
   * @param userId The ID of the user.
   * @param id The ID of the flashcard to retrieve.
   * @returns A promise that resolves to a FlashcardDto object or null if not found.
   * @throws {Error} If there is an error fetching the flashcard.
   */
  async getFlashcardById(userId: string, id: string): Promise<FlashcardDto | null> {
    const { data, error } = await this.supabase
      .from("flashcards")
      .select("id, front, back, source, generation_id, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch flashcard: ${error.message}`);
    }

    return data ? toFlashcardDto(data as FlashcardRow) : null;
  }

  /**
   * Applies the given accept counts to the corresponding generations.
   * @param userId The ID of the user.
   * @param acceptCounts The accept counts to apply.
   * @throws {Error} If there is an error loading or updating the generation counts.
   * @throws {GenerationOwnershipError} If the user does not own all of the specified generations.
   */
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

  /**
   * Updates an existing flashcard.
   * @param userId The ID of the user performing the update.
   * @param flashcardId The ID of the flashcard to update.
   * @param command The update command containing the new values.
   * @returns A promise that resolves to the updated flashcard data.
   * @throws {Error} If there is an error loading or updating the flashcard.
   * @throws {FlashcardNotFoundError} If the flashcard is not found or not owned by the user.
   */
  async updateFlashcard(
    userId: string,
    flashcardId: string,
    command: UpdateFlashcardCommand
  ): Promise<UpdateFlashcardResponse> {
    const { data: existing, error: selectError } = await this.supabase
      .from<FlashcardRow>("flashcards")
      .select("id, front, back, source, generation_id")
      .eq("id", flashcardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Failed to load flashcard: ${selectError.message}`);
    }

    if (!existing) {
      throw new FlashcardNotFoundError(flashcardId);
    }

    const hasFrontChange = command.front !== undefined && command.front !== existing.front;
    const hasBackChange = command.back !== undefined && command.back !== existing.back;

    const targetSource = this.resolveSource(existing.source, hasFrontChange || hasBackChange);

    const updatePayload: Partial<FlashcardRow> = {
      source: targetSource,
      updated_at: new Date().toISOString(),
    };

    if (hasFrontChange) {
      updatePayload.front = command.front;
    }
    if (hasBackChange) {
      updatePayload.back = command.back;
    }

    const { data: updatedRow, error: updateError } = await this.supabase
      .from<FlashcardRow>("flashcards")
      .update(updatePayload)
      .eq("id", flashcardId)
      .eq("user_id", userId)
      .select("id, source, updated_at")
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update flashcard: ${updateError.message}`);
    }

    if (!updatedRow) {
      throw new Error("Flashcard update did not return a record.");
    }

    if (this.requiresGenerationAdjustment(existing, targetSource) && existing.generation_id) {
      await this.markGenerationEdited(userId, existing.generation_id);
    }

    return {
      id: updatedRow.id,
      source: updatedRow.source as FlashcardSource,
      updatedAt: updatedRow.updated_at,
    };
  }

  /**
   * Deletes a flashcard.
   * @param userId The ID of the user performing the deletion.
   * @param flashcardId The ID of the flashcard to delete.
   * @throws {Error} If there is an error loading or deleting the flashcard.
   * @throws {FlashcardNotFoundError} If the flashcard is not found or not owned by the user.
   */
  async deleteFlashcard(userId: string, flashcardId: string): Promise<void> {
    const { data: existing, error: selectError } = await this.supabase
      .from<FlashcardRow>("flashcards")
      .select("id, source, generation_id")
      .eq("id", flashcardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Failed to load flashcard: ${selectError.message}`);
    }

    if (!existing) {
      throw new FlashcardNotFoundError(flashcardId);
    }

    const { data: deleted, error: deleteError } = await this.supabase
      .from<FlashcardRow>("flashcards")
      .delete()
      .eq("id", flashcardId)
      .eq("user_id", userId)
      .select("id");

    if (deleteError) {
      throw new Error(`Failed to delete flashcard: ${deleteError.message}`);
    }

    if (!deleted || deleted.length === 0) {
      throw new Error("Flashcard delete did not return a record.");
    }

    if (existing.generation_id && (existing.source === "ai" || existing.source === "ai-edited")) {
      await this.decrementGenerationCounts(userId, existing.generation_id, existing.source as FlashcardSource);
    }
  }

  /**
   * Resolves the source of a flashcard based on its current source and whether it has been changed.
   * @param current The current source of the flashcard.
   * @param hasChanges Whether the flashcard has been changed.
   * @returns The resolved source of the flashcard.
   */
  private resolveSource(current: FlashcardSource, hasChanges: boolean): FlashcardSource {
    if (current === "ai" && hasChanges) {
      return "ai-edited";
    }
    return current;
  }

  /**
   * Determines whether a generation adjustment is required based on the flashcard's row and target source.
   * @param row The flashcard row.
   * @param targetSource The target source.
   * @returns True if a generation adjustment is required, false otherwise.
   */
  private requiresGenerationAdjustment(row: FlashcardRow, targetSource: FlashcardSource): boolean {
    return row.source === "ai" && targetSource === "ai-edited" && Boolean(row.generation_id);
  }

  /**
   * Marks a generation as edited by incrementing the accepted_edited_count and decrementing the accepted_original_count.
   * @param userId The ID of the user.
   * @param generationId The ID of the generation to mark as edited.
   * @throws {Error} If there is an error loading or updating the generation.
   */
  private async markGenerationEdited(userId: string, generationId: string): Promise<void> {
    const { data: generation, error: generationError } = await this.supabase
      .from<GenerationRow>("generations")
      .select("id, accepted_original_count, accepted_edited_count")
      .eq("id", generationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (generationError) {
      throw new Error(`Failed to load generation counts: ${generationError.message}`);
    }

    if (!generation) {
      throw new Error(`Generation ${generationId} not found for user.`);
    }

    const nextOriginal = Math.max((generation.accepted_original_count ?? 0) - 1, 0);
    const nextEdited = (generation.accepted_edited_count ?? 0) + 1;

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
  }

  /**
   * Decrements the generation counts based on the source of the flashcard.
   * @param userId The ID of the user.
   * @param generationId The ID of the generation.
   * @param source The source of the flashcard.
   * @throws {Error} If there is an error loading or updating the generation counts.
   */
  private async decrementGenerationCounts(
    userId: string,
    generationId: string,
    source: FlashcardSource
  ): Promise<void> {
    const { data: generation, error: generationError } = await this.supabase
      .from<GenerationRow>("generations")
      .select("id, accepted_original_count, accepted_edited_count")
      .eq("id", generationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (generationError) {
      throw new Error(`Failed to load generation counts: ${generationError.message}`);
    }

    if (!generation) {
      throw new Error(`Generation ${generationId} not found for user.`);
    }

    const nextOriginal =
      source === "ai"
        ? Math.max((generation.accepted_original_count ?? 0) - 1, 0)
        : (generation.accepted_original_count ?? 0);
    const nextEdited =
      source === "ai-edited"
        ? Math.max((generation.accepted_edited_count ?? 0) - 1, 0)
        : (generation.accepted_edited_count ?? 0);

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
  }
}