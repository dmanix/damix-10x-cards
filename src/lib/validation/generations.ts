import { z } from "zod";

import type { GenerationCreateCommand, GenerationListQuery } from "../../types";

export const generationCreateSchema = z.object({
  text: z
    .string({
      required_error: "text is required",
      invalid_type_error: "text must be a string",
    })
    .trim()
    .min(1000, "text must be at least 1000 characters")
    .max(20000, "text must be at most 20000 characters"),
});

export type GenerationCreateInput = z.infer<typeof generationCreateSchema>;

export const validateGenerationCreateCommand = (
  payload: unknown
): z.SafeParseReturnType<GenerationCreateInput, GenerationCreateCommand> => {
  return generationCreateSchema.safeParse(payload);
};

const generationStatusSchema = z.enum(["pending", "succeeded", "failed"]);
const generationSortSchema = z.enum(["createdAt", "finishedAt"]);
const generationOrderSchema = z.enum(["desc", "asc"]);

export const generationListQuerySchema = z.object({
  status: generationStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: generationSortSchema.default("createdAt"),
  order: generationOrderSchema.default("desc"),
});

export type GenerationListQueryInput = z.infer<typeof generationListQuerySchema>;

export const validateGenerationListQuery = (
  payload: unknown
): z.SafeParseReturnType<GenerationListQueryInput, GenerationListQueryInput> => {
  return generationListQuerySchema.safeParse(payload);
};

export const generationIdParamSchema = z.object({
  id: z
    .string({
      required_error: "id is required",
      invalid_type_error: "id must be a string",
    })
    .uuid("id must be a valid UUID"),
});

export type GenerationIdParamInput = z.infer<typeof generationIdParamSchema>;

export const validateGenerationIdParam = (
  payload: unknown
): z.SafeParseReturnType<GenerationIdParamInput, GenerationIdParamInput> => {
  return generationIdParamSchema.safeParse(payload);
};
