import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateImage } from "ai";

type RequestBody = {
  messages?: unknown;
  width?: unknown;
  height?: unknown;
};

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});
const imageModel = openrouter.imageModel("openai/gpt-image-1");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPrompt(message: unknown) {
  if (!isRecord(message) || !Array.isArray(message.parts)) return "";

  return message.parts
    .filter(
      (part: unknown): part is { type: "text"; text: string } =>
        isRecord(part) && part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export const maxDuration = 180;

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "The image request was not valid JSON." },
      { status: 400 },
    );
  }

  if (
    !isRecord(body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return Response.json(
      { error: "Enter a prompt before generating an image." },
      { status: 400 },
    );
  }

  const prompt = getPrompt(body.messages[body.messages.length - 1]);
  if (!prompt) {
    return Response.json(
      { error: "Enter a prompt before generating an image." },
      { status: 400 },
    );
  }
  if (prompt.length > 2000) {
    return Response.json(
      { error: "Keep prompts under 2,000 characters." },
      { status: 400 },
    );
  }

  const width = body.width === 512 || body.width === 768 ? body.width : 512;
  const height = body.height === 512 || body.height === 768 ? body.height : 512;

  try {
    const { image } = await generateImage({
      model: imageModel,
      prompt,
      size: `${width}x${height}`,
      seed: Math.floor(Math.random() * 1_000_000),
      abortSignal: AbortSignal.timeout(120_000),
    });

    const payload = JSON.stringify({
      imageUrl: `data:${image.mediaType};base64,${image.base64}`,
      prompt,
    });

    return new Response(payload, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Image generation error:", error);
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Image generation timed out. Please try again."
        : "Could not generate image. Please check the server logs.";

    return Response.json({ error: message }, { status: 502 });
  }
}
