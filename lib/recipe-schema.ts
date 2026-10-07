import { z } from "zod";

export const recipeSchema = z.object({
  recipe: z.object({
    name: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    ),
    steps: z.array(z.string()),
    sources: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
        }),
      )
      .optional(),
  }),
});
