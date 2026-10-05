"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { FileUIPart, UIMessage } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const MAX_FILES = 4;
const MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024;
const MAX_OTHER_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 49 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(flac|m4a|mp3|mp4|mpeg|mpga|ogg|wav|webm)$/i;
const SOURCE_REQUEST_PROMPT =
  "Show the sources for your previous answer. Use only source links that are already present in this conversation; do not search again or invent sources. If no source links were used, say that no sources were used.";
const STARTER_PROMPTS = [
  "Help me think through a new idea",
  "Make a recipe with what I have",
  "Create an image of a greenhouse at dawn",
  "I attached audio. Please transcribe it.",
];
const chatTransport = new DefaultChatTransport({ api: "/api/chat" });

type ToolOutput = Record<string, unknown>;

function isRecord(value: unknown): value is ToolOutput {
  return typeof value === "object" && value !== null;
}

function isSupportedFile(file: File) {
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

function fileToUIPart(file: File): Promise<FileUIPart> {
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

function stripInternalMarkup(text: string) {
  return text
    .replace(
      /<(?:tool_call|think)\b[\s\S]*?(?:<\/think>|<\/tool_call>|$)/gi,
      "",
    )
    .replace(/<\/?(?:tool_call|think)>/gi, "")
    .trim();
}

function getToolOutputs(message: UIMessage) {
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

function isWebSearchActive(message: UIMessage | undefined) {
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

function ToolResultView({ value }: { value: unknown }) {
  if (!isRecord(value) || typeof value.kind !== "string") return null;

  if (
    value.kind === "image" &&
    typeof value.imageUrl === "string" &&
    value.imageUrl.startsWith("data:image/")
  ) {
    return (
      <figure className="mt-4 overflow-hidden border border-[#20251f]/10 bg-[#e8e9de]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value.imageUrl}
          alt={
            typeof value.prompt === "string" ? value.prompt : "Generated image"
          }
          className="max-h-[65vh] w-full object-contain"
        />
        {typeof value.prompt === "string" && (
          <figcaption className="border-t border-[#20251f]/10 px-4 py-3 text-xs text-[#666b60]">
            {value.prompt}
          </figcaption>
        )}
      </figure>
    );
  }

  if (value.kind === "recipe" && isRecord(value.recipe)) {
    const recipe = value.recipe;
    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.filter(isRecord)
      : [];
    const steps = Array.isArray(recipe.steps)
      ? recipe.steps.filter((step): step is string => typeof step === "string")
      : [];
    const sources = Array.isArray(recipe.sources)
      ? recipe.sources.filter(
          (source): source is { title: string; url: string } =>
            isRecord(source) &&
            typeof source.title === "string" &&
            typeof source.url === "string",
        )
      : [];

    return (
      <section className="mt-4 border border-[#20251f]/10 bg-[#f8f6ef] p-4 sm:p-5">
        <h3 className="font-serif text-2xl text-(--leaf)">
          {typeof recipe.name === "string" ? recipe.name : "Your recipe"}
        </h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#85897e]">
              Ingredients
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-[#42483f]">
              {ingredients.map((ingredient, index) => (
                <li key={`${String(ingredient.name)}-${index}`}>
                  <span className="font-medium">
                    {typeof ingredient.name === "string"
                      ? ingredient.name
                      : "Item"}
                  </span>
                  {typeof ingredient.amount === "string" && (
                    <span className="text-[#85877d]">
                      {" "}
                      · {ingredient.amount}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#85897e]">
              Method
            </h4>
            <ol className="mt-2 list-inside list-decimal space-y-2 text-sm leading-6 text-[#42483f]">
              {steps.map((step, index) => (
                <li key={`${index}-${step}`}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
        {sources.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#20251f]/10 pt-3">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-(--leaf) underline underline-offset-4 hover:text-(--tomato)"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (value.kind === "transcription" && typeof value.text === "string") {
    return (
      <section className="mt-4 border border-[#20251f]/10 bg-[#f8f6ef] p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-[9px] uppercase tracking-widest text-(--leaf)">
            Transcript
            {typeof value.fileName === "string" ? ` · ${value.fileName}` : ""}
          </h3>
          {typeof value.durationInSeconds === "number" && (
            <span className="font-mono text-[9px] text-[#85897e]">
              {Math.floor(value.durationInSeconds / 60)}:
              {String(Math.floor(value.durationInSeconds % 60)).padStart(
                2,
                "0",
              )}
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-[#42483f]">
          {value.text}
        </p>
      </section>
    );
  }

  return null;
}

export default function MainChat() {
  const { messages, sendMessage, status, stop, error, regenerate, clearError } =
    useChat({ transport: chatTransport });
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dismissedSourceMessageId, setDismissedSourceMessageId] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";
  const latestAssistantMessage =
    messages.at(-1)?.role === "assistant" ? messages.at(-1) : undefined;
  const isSearchingWeb =
    isStreaming && isWebSearchActive(latestAssistantMessage);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if ((!text && files.length === 0) || isStreaming) return;

    try {
      const fileParts = await Promise.all(files.map(fileToUIPart));
      await sendMessage({ text, files: fileParts });
      setInput("");
      setFiles([]);
      setUploadError(null);
    } catch (caughtError) {
      setUploadError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not send your message.",
      );
    }
  }

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const nextFiles = [...files, ...selected];
    const totalBytes = nextFiles.reduce((total, file) => total + file.size, 0);
    const unsupported = selected.find((file) => !isSupportedFile(file));
    const oversized = selected.find(
      (file) =>
        file.size >
        (file.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name)
          ? MAX_AUDIO_FILE_BYTES
          : MAX_OTHER_FILE_BYTES),
    );

    if (nextFiles.length > MAX_FILES) {
      setUploadError(`Attach up to ${MAX_FILES} files per message.`);
    } else if (unsupported) {
      setUploadError("Attach images, PDFs, text files, or audio recordings.");
    } else if (oversized) {
      setUploadError(
        AUDIO_EXTENSIONS.test(oversized.name)
          ? "Audio files must be 25 MB or smaller."
          : "Each image, PDF, or text file must be 8 MB or smaller.",
      );
    } else if (totalBytes > MAX_TOTAL_FILE_BYTES) {
      setUploadError("Attachments must total 49 MB or less.");
    } else {
      setFiles(nextFiles);
      setUploadError(null);
    }
    event.target.value = "";
  }

  function showSources() {
    if (isStreaming) return;
    void sendMessage({ text: SOURCE_REQUEST_PROMPT });
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-(--paper) text-(--ink)">
      <header className="shrink-0 border-b border-[#20251f]/15 px-5 sm:px-8">
        <div className="mx-auto flex h-18 max-w-250 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Relay AI home"
          >
            <span className="grid size-9 place-items-center rounded-full bg-(--tomato) font-serif text-xl italic text-white">
              r
            </span>
            <span className="font-serif text-[22px] leading-none text-(--ink)">
              Relay <span className="text-(--leaf)">AI</span>
            </span>
          </Link>
          <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#767b70]">
            <span
              className={`size-1.5 rounded-full ${isStreaming ? "animate-pulse bg-(--tomato)" : "bg-(--leaf)"}`}
            />
            {isStreaming ? "Working" : "Ready"}
          </span>
        </div>
      </header>

      <main className="page-enter flex min-h-0 flex-1 flex-col">
        <section
          ref={scrollRef}
          aria-label="Conversation"
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8"
        >
          <div className="mx-auto flex max-w-250 flex-col gap-7">
            {messages.length === 0 && (
              <div className="rise-in overflow-hidden border border-[#20251f]/10 bg-[#e8e9de]">
                <div
                  aria-hidden="true"
                  className="image-reveal relative min-h-48 overflow-hidden bg-[#536451] bg-cover bg-center sm:min-h-60"
                  style={{
                    backgroundImage:
                      'url("https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1400&q=85")',
                  }}
                >
                  <div className="absolute inset-0 bg-[#25342d]/25" />
                  <p className="absolute bottom-5 left-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white sm:bottom-7 sm:left-7">
                    One conversation, many ways to make
                  </p>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-(--tomato)">
                    A clear place to think
                  </p>
                  <h1 className="mt-2 max-w-3xl font-serif text-4xl leading-[0.98] sm:text-[42px]">
                    Bring the thought.{" "}
                    <em className="text-(--leaf)">
                      We’ll find the right tool.
                    </em>
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[#666b60]">
                    Ask anything, request a recipe or image, or attach a
                    recording to transcribe.
                  </p>
                </div>
                <div className="stagger-in flex flex-wrap items-center gap-2 border-t border-[#20251f]/10 bg-[#f8f6ef] p-4 sm:px-8">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="lift-on-hover border border-[#20251f]/15 px-3 py-2 text-left text-xs text-[#565c51] transition hover:border-(--leaf) hover:text-(--leaf)"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, messageIndex) => {
              const text = stripInternalMarkup(
                message.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join(""),
              );
              const attachments = message.parts.filter(
                (part) => part.type === "file",
              );
              const outputs = getToolOutputs(message);
              const isUser = message.role === "user";
              const previousMessage = messages[messageIndex - 1];
              const isSourcesReply =
                !isUser &&
                previousMessage?.role === "user" &&
                previousMessage.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("\n") === SOURCE_REQUEST_PROMPT;
              const canOfferSources =
                !isUser &&
                message.id === latestAssistantMessage?.id &&
                status === "ready" &&
                !isSourcesReply &&
                (text.length > 0 || outputs.length > 0) &&
                dismissedSourceMessageId !== message.id;

              return (
                <article
                  key={message.id}
                  className={`message-arrive flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[94%] ${isUser ? "sm:max-w-[78%]" : "w-full sm:max-w-[90%]"}`}
                  >
                    <p
                      className={`mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] ${isUser ? "justify-end text-(--tomato)" : "text-(--leaf)"}`}
                    >
                      {!isUser && (
                        <span className="size-1.5 rounded-full bg-(--leaf)" />
                      )}
                      {isUser ? "You" : "Relay AI · response"}
                    </p>
                    <div
                      className={`whitespace-pre-wrap text-[15px] leading-7 ${isUser ? "border border-[#c84f38]/10 bg-[#f0e2d7] px-4 py-3 text-[#49332c] sm:px-5" : "border-l-2 border-(--leaf) bg-[#fffdf7] px-5 py-4 text-[#42483f] shadow-[0_8px_24px_rgba(44,47,37,0.04)] sm:px-6"}`}
                    >
                      {attachments.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {attachments.map((part, index) =>
                            part.mediaType?.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={`${part.filename}-${index}`}
                                src={part.url}
                                alt={part.filename || "Attached image"}
                                className="max-h-48 max-w-48 border border-[#20251f]/10 object-contain"
                              />
                            ) : (
                              <span
                                key={`${part.filename}-${index}`}
                                className="inline-flex items-center gap-2 border border-[#20251f]/15 bg-white/60 px-3 py-2 font-mono text-[10px] text-[#565c51]"
                              >
                                <span aria-hidden="true">↗</span>
                                {part.filename || "Attached file"}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                      {text || outputs.length > 0 ? (
                        text
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 py-2"
                          aria-label={
                            isSearchingWeb
                              ? "Searching the web"
                              : "Response is being prepared"
                          }
                        >
                          {isSearchingWeb ? (
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-(--leaf)">
                              <span className="mr-2 inline-block size-1.5 animate-pulse rounded-full bg-(--tomato)" />
                              Searching the web for useful sources
                            </span>
                          ) : (
                            <>
                              <span className="size-1.5 animate-pulse rounded-full bg-(--leaf)" />
                              <span className="size-1.5 animate-pulse rounded-full bg-(--leaf) [animation-delay:0.15s]" />
                              <span className="size-1.5 animate-pulse rounded-full bg-(--leaf) [animation-delay:0.3s]" />
                            </>
                          )}
                        </span>
                      )}
                      {outputs.map((output, index) => (
                        <ToolResultView
                          key={`${message.id}-tool-${index}`}
                          value={output}
                        />
                      ))}
                    </div>
                    {canOfferSources && (
                      <div className="source-prompt-enter mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#85897e]">
                          Need the references?
                        </span>
                        <button
                          type="button"
                          onClick={() => void showSources()}
                          className="inline-flex items-center gap-2 border border-(--leaf)/30 bg-[#e8e9de] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-(--leaf) transition hover:border-(--leaf) hover:bg-[#dfe4d8] hover:shadow-[0_5px_14px_rgba(44,47,37,0.08)]"
                        >
                          <span aria-hidden="true">↗</span>Show sources
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDismissedSourceMessageId(message.id)
                          }
                          className="px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-[#85897e] transition hover:text-(--tomato)"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {(error || uploadError) && (
          <div
            role="alert"
            className="shrink-0 border-t border-[#c84f38]/20 bg-[#f0e2d7] px-5 py-3 sm:px-8"
          >
            <div className="mx-auto flex max-w-250 flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#75392d]">
                {uploadError ||
                  error?.message ||
                  "Something went wrong. Please try again."}
              </p>
              <div className="flex shrink-0 items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    if (error) void regenerate();
                  }}
                  className="font-mono text-[10px] uppercase tracking-[0.13em] text-(--leaf) underline underline-offset-4 transition hover:text-(--tomato)"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    clearError();
                  }}
                  className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#777b71] transition hover:text-(--ink)"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="shrink-0 border-t border-[#20251f]/15 bg-[#f4f1e7]/95 px-5 py-4 backdrop-blur sm:px-8 sm:py-5">
          <form
            onSubmit={handleSubmit}
            className="composer-focus mx-auto flex max-w-250 items-end gap-3 border border-[#20251f]/20 bg-[#fffdf7] p-2 pl-3 shadow-[0_8px_24px_rgba(44,47,37,0.05)] sm:pl-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/*,.csv,.md,audio/*,.flac,.m4a,.mp3,.mp4,.mpeg,.mpga,.ogg,.wav,.webm"
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || files.length >= MAX_FILES}
              aria-label="Attach images, documents, or audio"
              title="Attach images, documents, or audio"
              className="mb-1 grid size-9 shrink-0 place-items-center border border-[#20251f]/15 text-lg text-(--leaf) transition hover:border-(--leaf) hover:bg-[#e8e9de] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ＋
            </button>
            <label htmlFor="message" className="sr-only">
              Write your message
            </label>
            <textarea
              id="message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit(event);
                }
              }}
              placeholder="Ask, create, cook, or attach audio..."
              rows={1}
              className="max-h-40 min-h-11 flex-1 resize-y bg-transparent py-3 text-[15px] text-(--ink) outline-none placeholder:text-[#a2a398]"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={() => stop()}
                className="shrink-0 bg-[#e8e9de] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.13em] text-(--leaf) transition hover:bg-[#dce1d7]"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && files.length === 0}
                className="shrink-0 bg-(--leaf) px-4 py-3 font-mono text-[10px] uppercase tracking-[0.13em] text-white transition hover:bg-[#334c38] disabled:cursor-not-allowed disabled:bg-[#c8c7bb]"
              >
                Send <span aria-hidden="true">↗</span>
              </button>
            )}
          </form>
          {files.length > 0 && (
            <div className="mx-auto mt-3 flex max-w-250 flex-wrap gap-2">
              {files.map((file, index) => (
                <span
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="inline-flex max-w-full items-center gap-2 border border-[#20251f]/15 bg-[#fffdf7] px-3 py-1.5 text-xs text-[#565c51]"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index),
                      )
                    }
                    aria-label={`Remove ${file.name}`}
                    className="font-mono text-sm text-[#929387] hover:text-(--tomato)"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mx-auto mt-2 max-w-250 font-mono text-[8px] uppercase tracking-[0.12em] text-[#9a9c92]">
            Images, documents up to 8 MB · Audio up to 25 MB · 4 files max
          </p>
        </footer>
      </main>
    </div>
  );
}
