import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const maxDuration = 120;

const LIVE_INFORMATION_PATTERN =
  /\b(now|today|current|currently|latest|recent|this week|this month|this year|weather|forecast|news|price|stock|score|schedule|opening hours|traffic|exchange rate|version|release date|search the web|look up|find online|browse for|cite sources|verify online|research)\b/i;

function getLatestUserText(messages: unknown[]) {
  const latestUserMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "role" in message &&
        message.role === "user",
    );
  if (
    typeof latestUserMessage !== "object" ||
    latestUserMessage === null ||
    !("parts" in latestUserMessage) ||
    !Array.isArray(latestUserMessage.parts)
  ) {
    return "";
  }

  return latestUserMessage.parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 4;

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

  if (!requestBody || typeof requestBody !== "object") {
    return Response.json(
      { error: "The chat request must be a JSON object." },
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
  for (const part of latestFiles) {
    if (
      !("mediaType" in part) ||
      typeof part.mediaType !== "string" ||
      !isSupportedMediaType(part.mediaType)
    ) {
      return Response.json(
        { error: "Attach images, PDFs, or text-based files." },
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

  // you can destructure messages which is an
  // array of all the messages that have been sent throught the chat with the ai
  // or destructure a prompt which is only the most recent message you
  // have sent to the ai and either ways you will be passing this
  // value to the ai function

  const latestUserText = getLatestUserText(messages);
  const shouldRequireSearch = LIVE_INFORMATION_PATTERN.test(latestUserText);
  const currentDate = new Date().toISOString().slice(0, 10);

  const result = streamText({
    model: openrouter("openrouter/free"),
    messages: await convertToModelMessages(messages),
    ...(shouldRequireSearch
      ? {
          tools: {
            web_search: openrouter.tools.webSearch({
              maxResults: 5,
              engine: "auto",
            }),
          },
        }
      : {}),
    system: `You are a friendly, thoughtful assistant. The current date is ${currentDate}. Treat this as authoritative and never substitute a date from training data.
  - Never reveal internal reasoning, tool instructions, tool-call syntax, or markup such as <tool_call>, <think>, or function-call JSON. Answer the user directly.
  - Answer simple factual or narrowly scoped questions in one or two short sentences. Do not add an overview, list, or background unless asked.
  - Give fuller explanations only when the user asks for detail or the subject genuinely requires context, reasoning, examples, or important caveats.
  - Avoid padding and repetition; match the answer length to the request.
  - Search the web when the question asks for current information, is outside your reliable knowledge, depends on specific or obscure facts, or when checking trustworthy sources would materially improve accuracy.
  - For live information such as current weather, prices, news, scores, or schedules, use the web results supplied with this request and do not guess current facts.
  - Do not search for stable common knowledge when it would not improve the answer. When you search, base the answer on results and cite useful source links.
  - When asked for sources for a previous answer, list only links actually present in the conversation or tool results. Never invent citations; if there are none, say no sources were used.
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
  return result.toUIMessageStreamResponse();
}
