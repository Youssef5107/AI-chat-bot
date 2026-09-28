import { streamObject } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { recipeSchema } from "./schema";

export async function POST(req: Request) {
  try {
    const { dish } = await req.json();

    const result = streamObject({
      model: openrouter("openrouter/free"),
      schema: recipeSchema,
      prompt: `generate a recipe for ${dish}`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error(error);
  }
}
