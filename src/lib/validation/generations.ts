import { z } from "zod";

import type { GenerationCreateCommand } from "../../types";

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
