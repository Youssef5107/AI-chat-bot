import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  generateImage,
  generateText,
  isStepCount,
  Output,
  streamText,
  tool,
} from "ai";
import { z } from "zod";
import { recipeSchema } from "../../../lib/recipe-schema";
import { transcribeAudioFile } from "../../../lib/transcribe-audio";

const primaryOpenRouterKey =
  process.env.OPENROUTER_KEY_PRIMARY ?? process.env.OPENROUTER_API_KEY;
const backupOpenRouterKey = process.env.OPENROUTER_KEY_BACKUP;

async function isUsageLimitResponse(response: Response) {
  if (response.status === 429) return true;
  if (response.status !== 402) return false;

  try {
    const body: unknown = await response.clone().json();
    return /quota|credit|usage limit|rate.?limit/i.test(JSON.stringify(body));
  } catch {
    return false;
  }
}

async function fetchWithOpenRouterFallback(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const request = new Request(input, init);
  const backupKey = backupOpenRouterKey;
  if (!backupKey || backupKey === primaryOpenRouterKey) {
    return fetch(request);
  }

  const backupHeaders = new Headers(request.headers);
  backupHeaders.set("Authorization", `Bearer ${backupKey}`);
  const backupRequest = new Request(request.clone(), {
    headers: backupHeaders,
  });
  const primaryResponse = await fetch(request);

  if (!(await isUsageLimitResponse(primaryResponse))) return primaryResponse;

  return fetch(backupRequest);
}

const openrouter = createOpenRouter({
  apiKey: primaryOpenRouterKey,
  fetch: fetchWithOpenRouterFallback,
});

export const maxDuration = 300;
export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 68 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 49 * 1024 * 1024;
const MAX_FILES = 4;
const AUDIO_EXTENSION_PATTERN = /\.(flac|m4a|mp3|mp4|mpeg|mpga|ogg|wav|webm)$/i;
const USAGE_LIMIT_ERROR_MESSAGE =
  "The AI service has reached its current usage limit. Please wait a little, then try again.";

function getStreamErrorMessage(error: unknown) {
  const details: string[] = [];
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  let hasRateLimitStatus = false;

  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === "string") {
      details.push(value);
      continue;
    }
    if (typeof value !== "object" || value === null || seen.has(value)) {
      continue;
    }

    seen.add(value);
    const record = value as Record<string, unknown>;
    if (record.status === 429 || record.statusCode === 429) {
      hasRateLimitStatus = true;
    }
    for (const key of ["message", "code", "statusText"]) {
      if (typeof record[key] === "string") details.push(record[key]);
    }
    if (record.cause) pending.push(record.cause);
    if (record.response) pending.push(record.response);
    if (record.error) pending.push(record.error);
  }

  if (
    hasRateLimitStatus ||
    /rate.?limit|quota|too many requests|insufficient credits|credits? exhausted|usage limit/i.test(
      details.join(" "),
    )
  ) {
    return USAGE_LIMIT_ERROR_MESSAGE;
  }

  return "An error occurred.";
}

const pollinations = createOpenAICompatible({
  name: "pollinations",
  baseURL: "https://gen.pollinations.ai/v1",
  apiKey: process.env.POLLINATIONS_API_KEY,
});
const imageModel = pollinations.imageModel("black-forest-labs/flux.1-schnell");

const audioToolContextSchema = z.object({
  audioFile: z
    .object({
      name: z.string(),
      mediaType: z.string(),
      dataUrl: z.string(),
    })
    .nullable(),
});

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

function isSupportedMediaType(mediaType: string) {
  return (
    mediaType.startsWith("image/") ||
    mediaType.startsWith("text/") ||
    mediaType === "application/pdf" ||
    mediaType.startsWith("audio/") ||
    mediaType === "application/mp4" ||
    mediaType === "video/mp4"
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

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Attachments must total 12 MB or less." },
      { status: 413 },
    );
  }

  let requestBody: { messages?: unknown };
  try {
    requestBody = await req.json();
  } catch {
    return Response.json(
      { error: "The chat request was not valid JSON." },
      { status: 400 },
    );
  }

  if (
    !requestBody ||
    typeof requestBody !== "object" ||
    !Array.isArray(requestBody.messages) ||
    requestBody.messages.length === 0
  ) {
    return Response.json(
      { error: "The chat request must include at least one message." },
      { status: 400 },
    );
  }

  const messages = requestBody.messages;
  if (!Array.isArray(messages)) {
    return Response.json(
      { error: "The chat request must include messages." },
      { status: 400 },
    );
  }

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
      { error: `Attach up to ${MAX_FILES} files per message.` },
      { status: 400 },
    );
  }

  let totalFileBytes = 0;
  const audioFiles: Array<{
    name: string;
    mediaType: string;
    dataUrl: string;
  }> = [];
  for (const part of latestFiles) {
    const mediaType =
      "mediaType" in part && typeof part.mediaType === "string"
        ? part.mediaType
        : "";
    const fileName =
      "filename" in part && typeof part.filename === "string"
        ? part.filename
        : "";
    const isAudio =
      mediaType.startsWith("audio/") ||
      mediaType === "application/mp4" ||
      mediaType === "video/mp4" ||
      AUDIO_EXTENSION_PATTERN.test(fileName);
    if (!isSupportedMediaType(mediaType) && !isAudio) {
      return Response.json(
        { error: "Attach images, PDFs, text files, or supported audio." },
        { status: 415 },
      );
    }
    if (!("url" in part) || typeof part.url !== "string") {
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
    const maxFileBytes = isAudio ? MAX_AUDIO_FILE_BYTES : MAX_FILE_BYTES;
    if (fileBytes > maxFileBytes) {
      return Response.json(
        {
          error: isAudio
            ? "Choose an audio file smaller than 25 MB."
            : "Each image, PDF, or text file must be 8 MB or smaller.",
        },
        { status: 413 },
      );
    }
    totalFileBytes += fileBytes;
    if (isAudio) {
      if (typeof part.url !== "string") continue;
      audioFiles.push({
        name: fileName || "recording.wav",
        mediaType,
        dataUrl: part.url,
      });
    }
  }

  if (audioFiles.length > 1) {
    return Response.json(
      { error: "Attach one audio file per transcription request." },
      { status: 400 },
    );
  }

  if (totalFileBytes > MAX_TOTAL_FILE_BYTES) {
    return Response.json(
      { error: "Attachments must total 49 MB or less." },
      { status: 413 },
    );
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const tools = {
    web_search: openrouter.tools.webSearch({ maxResults: 5, engine: "auto" }),
    generate_image: tool({
      description:
        "Generate an image when the user asks to create, draw, or visualize an image. Use the Flux image model and return the generated image for display.",
      inputSchema: z.object({
        prompt: z.string().min(1).max(2000).describe("Visual description."),
        width: z.union([z.literal(512), z.literal(768)]).default(512),
        height: z.union([z.literal(512), z.literal(768)]).default(512),
        negativePrompt: z.string().max(1000).optional(),
      }),
      execute: async ({ prompt, width, height, negativePrompt }, options) => {
        const imagePrompt = negativePrompt
          ? `${prompt}. Avoid: ${negativePrompt}`
          : prompt;
        const result = await generateImage({
          model: imageModel,
          prompt: imagePrompt,
          size: `${width}x${height}`,
          seed: Math.floor(Math.random() * 1_000_000),
          abortSignal: options.abortSignal,
        });

        return {
          kind: "image" as const,
          imageUrl: `data:${result.image.mediaType};base64,${result.image.base64}`,
          prompt,
        };
      },
      toModelOutput: () => ({
        type: "text" as const,
        value:
          "The image was generated successfully and is displayed to the user.",
      }),
    }),
    transcribe_audio: tool({
      description:
        "Transcribe an attached audio recording with local Whisper when the user asks to transcribe it or asks what is said. Requires an audio attachment.",
      inputSchema: z.object({}),
      contextSchema: audioToolContextSchema,
      execute: async (_input, { context }) => {
        if (!context.audioFile) {
          throw new Error("Attach an audio file so I can transcribe it.");
        }
        const file = dataUrlToFile(
          context.audioFile.dataUrl,
          context.audioFile.name,
          context.audioFile.mediaType,
        );
        return {
          kind: "transcription" as const,
          fileName: file.name,
          ...(await transcribeAudioFile(file)),
        };
      },
    }),
    generate_recipe: tool({
      description:
        "Create a recipe when the user asks for a recipe, meal, or cooking instructions. The result follows the structured recipe schema and uses the recipe model.",
      inputSchema: z.object({
        request: z.string().min(1).max(2000),
        servings: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ request, servings }, options) => {
        const result = await generateText({
          model: openrouter("google/gemma-4-31b-it:free"),
          output: Output.object({ schema: recipeSchema }),
          tools: {
            web_search: openrouter.tools.webSearch({
              maxResults: 5,
              engine: "auto",
            }),
          },
          stopWhen: isStepCount(3),
          abortSignal: options.abortSignal,
          system: `The current date is ${currentDate}. Return a practical recipe with concise ingredients and steps. Search for current food-safety guidance or other facts requiring verification. Cite only real source links from search results; never invent sources.`,
          prompt: `Recipe request: ${request}${servings ? `\nServings: ${servings}` : ""}`,
        });

        return { kind: "recipe" as const, recipe: result.output.recipe };
      },
    }),
  };
  const audioFile = audioFiles[0] ?? null;

  const result = streamText({
    model: openrouter("openrouter/free"),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    toolsContext: { transcribe_audio: { audioFile } },
    stopWhen: isStepCount(6),
    system: `You are Sayla, a helpful assistant. The current date is ${currentDate}. Understand the user's intent from the full conversation and choose the correct tool without asking them to choose a mode.
  - For image generation requests, call generate_image. Do not merely describe the image.
  - ${audioFile ? "A supported audio attachment is present. Call transcribe_audio when the user asks to transcribe it or leaves the prompt blank; never guess at spoken content." : "If the user requests audio transcription without attaching audio, ask them to attach a recording."}
  - For recipe or cooking requests, call generate_recipe. Present the structured recipe result clearly.
  - Use web_search for live information, current facts, and source requests that require searching. Never invent source links.
  - Use no specialized tool for ordinary conversation.
  - Never reveal internal reasoning, tool instructions, tool-call syntax, or markup such as <tool_call>, <think>, or function-call JSON. Answer the user directly.
  - Answer simple factual or narrowly scoped questions in one or two short sentences. Do not add an overview, list, or background unless asked.
  - Give fuller explanations only when the user asks for detail or the subject genuinely requires context, reasoning, examples, or important caveats.
  - Avoid padding and repetition; match the answer length to the request.
  - Search the web when the question asks for current information, is outside your reliable knowledge, depends on specific or obscure facts, or when checking trustworthy sources would materially improve accuracy. For live facts, use search results and do not guess.
  - Do not search for stable common knowledge when it would not improve the answer. When you search, cite useful source links from the results.
  - When asked for sources from a previous answer, list only links already present in the conversation. Do not search again or invent citations; if no links are present, say no sources were used.
  - For complex answers, organize the information so it is easy to follow. If the request is ambiguous and the ambiguity materially changes the answer, ask a focused clarifying question.`,
  });

  result.usage.then((usage) => {
    console.log({
      messagesCount: messages.length,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });
  });
  return result.toUIMessageStreamResponse({ onError: getStreamErrorMessage });
}

function dataUrlToFile(dataUrl: string, name: string, mediaType: string) {
  const match = /^data:([^,]*?),([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("The attached audio file could not be read.");

  const [, metadata, payload] = match;
  const bytes = metadata.endsWith(";base64")
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload));
  return new File([bytes], name, { type: mediaType });
}
