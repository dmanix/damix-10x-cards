import { z } from "zod";

import type { CreateFlashcardsCommand } from "../../types.ts";

const flashcardBaseSchema = {
  front: z
    .string({
      required_error: "front is required",
      invalid_type_error: "front must be a string",
    })
    .trim()
    .min(1, "front must be at least 1 character")
    .max(200, "front must be at most 200 characters"),
  back: z
    .string({
      required_error: "back is required",
      invalid_type_error: "back must be a string",
    })
    .trim()
    .min(1, "back must be at least 1 character")
    .max(500, "back must be at most 500 characters"),
};

const manualFlashcardSchema = z
  .object({
    ...flashcardBaseSchema,
    source: z.literal("manual"),
    generationId: z.null().optional(),
  })
  .strict();

const aiFlashcardSchema = z
  .object({
    ...flashcardBaseSchema,
    source: z.literal("ai"),
    generationId: z.string().uuid("generationId must be a valid UUID"),
  })
  .strict();

const aiEditedFlashcardSchema = z
  .object({
    ...flashcardBaseSchema,
    source: z.literal("ai-edited"),
    generationId: z.string().uuid("generationId must be a valid UUID"),
  })
  .strict();

export const createFlashcardsSchema = z
  .object({
    flashcards: z
      .array(z.discriminatedUnion("source", [manualFlashcardSchema, aiFlashcardSchema, aiEditedFlashcardSchema]))
      .min(1, "flashcards must contain at least 1 item"),
  })
  .strict();

export type CreateFlashcardsInput = z.infer<typeof createFlashcardsSchema>;

/**
 * Validates the create flashcards command payload.
 *
 * @param payload - The payload to validate.
 * @returns A safe parse result containing either the parsed input or an error.
 */
export const validateCreateFlashcardsCommand = (
  payload: unknown
): z.SafeParseReturnType<CreateFlashcardsInput, CreateFlashcardsCommand> => {
  return createFlashcardsSchema.safeParse(payload);
};

export const updateFlashcardPayloadSchema = z
  .object({
    front: z
      .string({
        invalid_type_error: "front must be a string",
      })
      .trim()
      .min(1, "front must be at least 1 character")
      .max(200, "front must be at most 200 characters")
      .optional(),
    back: z
      .string({
        invalid_type_error: "back must be a string",
      })
      .trim()
      .min(1, "back must be at least 1 character")
      .max(500, "back must be at most 500 characters")
      .optional(),
    source: z.union([z.literal("ai"), z.literal("ai-edited"), z.literal("manual")]),
  })
  .refine((value) => value.front ?? value.back, {
    message: "front or back must be provided",
  });

const flashcardSortSchema = z.enum(["createdAt", "updatedAt"]);
const flashcardOrderSchema = z.enum(["desc", "asc"]);
const flashcardSourceSchema = z.enum(["ai", "ai-edited", "manual"]);

export const flashcardListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: flashcardSortSchema.default("createdAt"),
  order: flashcardOrderSchema.default("desc"),
  source: flashcardSourceSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  since: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
});

export type FlashcardListQueryInput = z.infer<typeof flashcardListQuerySchema>;

/**
 * Validates the flashcard list query payload.
 *
 * @param payload - The payload to validate.
 * @returns A safe parse result containing either the parsed input or an error.
 */
export const validateFlashcardListQuery = (
  payload: unknown
): z.SafeParseReturnType<FlashcardListQueryInput, FlashcardListQueryInput> => {
  return flashcardListQuerySchema.safeParse(payload);
};

export const flashcardIdParamSchema = z.object({
  id: z
    .string({
      required_error: "id is required",
      invalid_type_error: "id must be a string",
    })
    .uuid("id must be a valid UUID"),
});

export type FlashcardIdParamInput = z.infer<typeof flashcardIdParamSchema>;

/**
 * Validates the flashcard ID parameter payload.
 *
 * @param payload - The payload to validate.
 * @returns A safe parse result containing either the parsed input or an error.
 */
export const validateFlashcardIdParam = (
  payload: unknown
): z.SafeParseReturnType<FlashcardIdParamInput, FlashcardIdParamInput> => {
  return flashcardIdParamSchema.safeParse(payload);
};