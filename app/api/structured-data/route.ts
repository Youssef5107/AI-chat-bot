import { convertToModelMessages, isStepCount, Output, streamText } from "ai";
import type { UIMessage } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { recipeSchema } from "./schema";

export const maxDuration = 120;

const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 4;

function isSupportedMediaType(mediaType: string) {
  return (
    mediaType.startsWith("image/") ||
    mediaType.startsWith("text/") ||
    mediaType === "application/pdf"
  );
}

function isFilePart(
  part: unknown,
): part is { type: "file"; mediaType?: unknown; url?: unknown } {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    part.type === "file"
  );
}

function getDataUrlSize(url: string) {
  const match = /^data:([^,]*?),([\s\S]*)$/.exec(url);
  if (!match) return null;

  const [, metadata, payload] = match;
  if (metadata.endsWith(";base64")) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.floor((payload.length * 3) / 4) - padding;
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      {
        error:
          "The recipe request is too large. Reduce the conversation attachments and try again.",
      },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "The recipe chat request was not valid JSON." },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("messages" in body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return Response.json(
      { error: "The recipe chat request must include messages." },
      { status: 400 },
    );
  }

  const messages = body.messages as unknown[];
  const latestMessage = messages[messages.length - 1];
  const latestParts: unknown[] =
    latestMessage &&
    typeof latestMessage === "object" &&
    "parts" in latestMessage &&
    Array.isArray(latestMessage.parts)
      ? latestMessage.parts
      : [];
  const latestFiles = latestParts.filter(isFilePart);

  if (latestFiles.length > MAX_FILES) {
    return Response.json(
      { error: `Attach up to ${MAX_FILES} files per recipe.` },
      { status: 400 },
    );
  }

  let totalFileBytes = 0;
  for (const part of latestFiles) {
    if (
      typeof part.mediaType !== "string" ||
      !isSupportedMediaType(part.mediaType)
    ) {
      return Response.json(
        { error: "Attach images, PDFs, or text-based files." },
        { status: 415 },
      );
    }
    if (typeof part.url !== "string") {
      return Response.json(
        { error: "An attachment could not be read." },
        { status: 400 },
      );
    }

    const fileBytes = getDataUrlSize(part.url);
    if (fileBytes === null) {
      return Response.json(
        { error: "Attachments must be uploaded directly." },
        { status: 400 },
      );
    }
    if (fileBytes > MAX_FILE_BYTES) {
      return Response.json(
        { error: "Each file must be 8 MB or smaller." },
        { status: 413 },
      );
    }
    totalFileBytes += fileBytes;
  }

  if (totalFileBytes > MAX_TOTAL_FILE_BYTES) {
    return Response.json(
      { error: "Attachments must total 12 MB or less." },
      { status: 413 },
    );
  }

  try {
    const result = streamText({
      model: openrouter("openrouter/free"),
      output: Output.object({ schema: recipeSchema }),
      stopWhen: isStepCount(4),
      tools: {
        web_search: openrouter.tools.webSearch({
          maxResults: 5,
          engine: "auto",
        }),
      },
      system:
        "Generate a practical, flavorful recipe based on the conversation and any attached images or files. Include clear ingredient amounts and concise cooking steps. Search the web when current food-safety guidance, a specific technique, or reliable ingredient information would improve accuracy. Do not search for ordinary recipe ideas when it would not help. Use trustworthy results, and include source links only when you actually used search; never invent sources.",
      messages: await convertToModelMessages(messages as UIMessage[]),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The recipe could not be generated. Please try again." },
      { status: 500 },
    );
  }
}
