import type { FileUIPart, UIMessage } from "ai";

export const MAX_FILES = 4;
export const MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_OTHER_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_FILE_BYTES = 49 * 1024 * 1024;
export const AUDIO_EXTENSIONS = /\.(flac|m4a|mp3|mp4|mpeg|mpga|ogg|wav|webm)$/i;
export const SOURCE_REQUEST_PROMPT =
  "Show the sources for your previous answer. Use only source links that are already present in this conversation; do not search again or invent sources. If no source links were used, say that no sources were used.";
export const STARTER_PROMPTS = [
  "Help me think through a new idea",
  "Make a recipe with what I have",
  "Create an image of a greenhouse at dawn",
  "I attached audio. Please transcribe it.",
];

type ToolOutput = Record<string, unknown>;

export function isRecord(value: unknown): value is ToolOutput {
  return typeof value === "object" && value !== null;
}

export function isSupportedFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("text/") ||
    file.type === "application/pdf" ||
    file.type.startsWith("audio/") ||
    file.type === "application/mp4" ||
    file.type === "video/mp4" ||
    AUDIO_EXTENSIONS.test(file.name)
  );
}

export function fileToUIPart(file: File): Promise<FileUIPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }
      resolve({
        type: "file",
        filename: file.name,
        mediaType: file.type || "application/octet-stream",
        url: reader.result,
      });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export function stripInternalMarkup(text: string) {
  return text
    .replace(
      /<(?:tool_call|think)\b[\s\S]*?(?:<\/think>|<\/tool_call>|$)/gi,
      "",
    )
    .replace(/<\/?(?:tool_call|think)>/gi, "")
    .trim();
}

export function getToolOutputs(message: UIMessage) {
  return message.parts.flatMap((part) => {
    if (
      (part.type === "dynamic-tool" || part.type.startsWith("tool-")) &&
      "state" in part &&
      part.state === "output-available" &&
      "output" in part
    ) {
      return [part.output];
    }
    return [];
  });
}

export function isWebSearchActive(message: UIMessage | undefined) {
  return (
    message?.parts.some((part) => {
      const toolName =
        part.type === "dynamic-tool"
          ? part.toolName
          : part.type.startsWith("tool-")
            ? part.type.slice("tool-".length)
            : "";
      const state = "state" in part ? part.state : undefined;
      return (
        toolName.includes("web_search") &&
        state !== "output-available" &&
        state !== "output-error" &&
        state !== "output-denied"
      );
    }) ?? false
  );
}

export function getActiveMediaTool(messages: UIMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant") continue;

    for (const part of [...message.parts].reverse()) {
      const toolName =
        part.type === "dynamic-tool"
          ? part.toolName
          : part.type.startsWith("tool-")
            ? part.type.slice("tool-".length)
            : "";
      const state = "state" in part ? part.state : undefined;
      if (state !== "input-streaming" && state !== "input-available") {
        continue;
      }
      if (toolName === "generate_image") return "image" as const;
      if (toolName === "transcribe_audio") return "transcription" as const;
    }
  }

  return null;
}
