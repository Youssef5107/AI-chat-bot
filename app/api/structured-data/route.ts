import { streamObject } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { recipeSchema } from "./schema";

export async function POST(req: Request) {
  try {
    const { dish } = await req.json();

    if (typeof dish !== "string" || !dish.trim()) {
      return Response.json(
        { error: "Tell us what you'd like to cook." },
        { status: 400 },
      );
    }

    const result = streamObject({
      model: openrouter("openrouter/free"),
      schema: recipeSchema,
      prompt: `Generate a practical, flavorful recipe for ${dish.trim()}. Include clear ingredient amounts and concise numbered cooking steps.`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The recipe could not be generated. Please try again." },
      { status: 500 },
    );
  }
}
