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

  private resolveSource(current: FlashcardSource, hasChanges: boolean): FlashcardSource {
    if (current === "ai" && hasChanges) {
      return "ai-edited";
    }
    return current;
  }

  private requiresGenerationAdjustment(row: FlashcardRow, targetSource: FlashcardSource): boolean {
    return row.source === "ai" && targetSource === "ai-edited" && Boolean(row.generation_id);
  }

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
}
