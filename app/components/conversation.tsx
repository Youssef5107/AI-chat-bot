"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import ChatToolResult from "./chat-tool-result";
import {
  getActiveMediaTool,
  getToolOutputs,
  isWebSearchActive,
  SOURCE_REQUEST_PROMPT,
  STARTER_PROMPTS,
  stripInternalMarkup,
} from "@/lib/chat-utils";

type ConversationProps = {
  messages: UIMessage[];
  isStreaming: boolean;
  isSendingMessage: boolean;
  isReady: boolean;
  dismissedSourceMessageId: string | null;
  onStarterPrompt: (prompt: string) => void;
  onShowSources: () => void;
  onDismissSources: (messageId: string) => void;
};

export default function Conversation({
  messages,
  isStreaming,
  isSendingMessage,
  isReady,
  dismissedSourceMessageId,
  onStarterPrompt,
  onShowSources,
  onDismissSources,
}: ConversationProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const latestAssistantMessage =
    messages.at(-1)?.role === "assistant" ? messages.at(-1) : undefined;
  const isSearchingWeb =
    isStreaming && isWebSearchActive(latestAssistantMessage);
  const activeMediaTool = isStreaming ? getActiveMediaTool(messages) : null;
  const shouldShowImmediatePlaceholder =
    isSendingMessage && messages.at(-1)?.role === "user";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  return (
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
              className="image-reveal relative min-h-48 overflow-hidden bg-[#a95f43] bg-cover bg-center sm:min-h-60"
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
                <em className="text-(--leaf)">We’ll find the right tool.</em>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#666b60]">
                Ask anything, request a recipe or image, or attach a recording
                to transcribe.
              </p>
            </div>
            <div className="stagger-in flex flex-wrap items-center gap-2 border-t border-[#20251f]/10 bg-[#f8f6ef] p-4 sm:px-8">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onStarterPrompt(prompt)}
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
            isReady &&
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
                  {isUser ? "You" : "Sayla · response"}
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
                      ) : activeMediaTool === "image" ? (
                        <span
                          className="image-generation-waiting"
                          role="status"
                          aria-label="Generating your image"
                        >
                          <span
                            className="image-generation-waiting__frame"
                            aria-hidden="true"
                          >
                            <span className="image-generation-waiting__sun" />
                            <span className="image-generation-waiting__hill image-generation-waiting__hill--back" />
                            <span className="image-generation-waiting__hill image-generation-waiting__hill--front" />
                            <span className="image-generation-waiting__scan" />
                          </span>
                          <span className="image-generation-waiting__caption">
                            Developing your image
                            <span
                              className="image-generation-waiting__dots"
                              aria-hidden="true"
                            >
                              ···
                            </span>
                          </span>
                        </span>
                      ) : activeMediaTool === "transcription" ? (
                        <span
                          className="audio-transcription-waiting"
                          role="status"
                          aria-label="Transcribing your audio"
                        >
                          <span
                            className="audio-transcription-waiting__wave"
                            aria-hidden="true"
                          >
                            {Array.from({ length: 9 }, (_, index) => (
                              <span key={index} />
                            ))}
                          </span>
                          <span className="audio-transcription-waiting__label">
                            Listening for every word
                            <span>Turning your recording into text</span>
                          </span>
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
                    <ChatToolResult
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
                      onClick={onShowSources}
                      className="inline-flex items-center gap-2 border border-(--leaf)/30 bg-[#e8e9de] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-(--leaf) transition hover:border-(--leaf) hover:bg-[#dfe4d8] hover:shadow-[0_5px_14px_rgba(44,47,37,0.08)]"
                    >
                      <span aria-hidden="true">↗</span>Show sources
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSources(message.id)}
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

        {shouldShowImmediatePlaceholder && (
          <article
            className="message-arrive flex justify-start"
            aria-live="polite"
          >
            <div className="w-full sm:max-w-[90%]">
              <p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-(--leaf)">
                <span className="size-1.5 rounded-full bg-(--leaf)" />
                Sayla · response
              </p>
              <div
                className="inline-flex items-center gap-1.5 border-l-2 border-(--leaf) bg-[#fffdf7] px-5 py-4 shadow-[0_8px_24px_rgba(44,47,37,0.04)]"
                role="status"
                aria-label="Preparing response"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-(--tomato)" />
                <span className="size-1.5 animate-pulse rounded-full bg-(--tomato) [animation-delay:0.15s]" />
                <span className="size-1.5 animate-pulse rounded-full bg-(--tomato) [animation-delay:0.3s]" />
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
