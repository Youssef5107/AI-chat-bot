"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import ChatNavigation from "./components/chat-navigation";

const starterPrompts = [
  "Help me think through a new idea",
  "Explain something I have been curious about",
  "Make a plan for the week ahead",
];

export default function Home() {
  const { messages, sendMessage, status, stop, error, regenerate, clearError } =
    useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-(--paper) text-(--ink) md:block">
      <ChatNavigation active="main" />
      <main className="page-enter flex min-h-0 flex-1 flex-col md:ml-57 md:h-dvh">
        <header className="shrink-0 border-b border-[#20251f]/15 px-5 sm:px-8">
          <div className="mx-auto flex h-18 max-w-250 items-center justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-(--tomato)">
                01 / Main chat
              </p>
              <h1 className="mt-0.5 font-serif text-xl leading-none">
                A clear place to think
              </h1>
            </div>
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#767b70]">
              <span
                className={`size-1.5 rounded-full ${isStreaming ? "animate-pulse bg-(--tomato)" : "bg-(--leaf)"}`}
              />
              {isStreaming ? "Replying" : "Ready"}
            </span>
          </div>
        </header>

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
                  className="image-reveal relative min-h-55 overflow-hidden bg-[#536451] bg-cover bg-center sm:min-h-65"
                  style={{
                    backgroundImage:
                      'url("https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1400&q=85")',
                  }}
                >
                  <div className="absolute inset-0 bg-[#25342d]/20" />
                  <p className="absolute left-5 top-5 flex items-center gap-2 border border-white/45 bg-[#20251f]/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white backdrop-blur-sm sm:left-7 sm:top-7">
                    <span className="size-1.5 rounded-full bg-(--butter)" />
                    Open conversation
                  </p>
                  <p className="absolute bottom-5 right-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white sm:bottom-7 sm:right-7">
                    Make room for a new thought
                  </p>
                </div>
                <div className="p-6 sm:p-8">
                  <h2 className="max-w-3xl font-serif text-4xl leading-[0.98] tracking-tight sm:text-[42px]">
                    A good question can start{" "}
                    <em className="text-(--leaf)">anywhere.</em>
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-[#666b60]">
                    Bring a half-formed thought, a practical problem, or just a
                    little curiosity. We’ll work it out together.
                  </p>
                </div>
                <div className="stagger-in flex flex-wrap items-center gap-2 border-t border-[#20251f]/10 bg-[#f8f6ef] p-4 sm:px-8">
                  <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#898d82]">
                    Start with
                  </span>
                  {starterPrompts.map((prompt) => (
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

            {messages.map((message) => {
              const text = message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("");
              const isUser = message.role === "user";

              return (
                <article
                  key={message.id}
                  className={`message-arrive flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] ${isUser ? "sm:max-w-[78%]" : "w-full sm:max-w-[88%]"}`}
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
                      className={`whitespace-pre-wrap text-[15px] leading-7 ${
                        isUser
                          ? "border border-[#c84f38]/10 bg-[#f0e2d7] px-4 py-3 text-[#49332c] sm:px-5"
                          : "border-l-2 border-(--leaf) bg-[#fffdf7] px-5 py-4 text-[#42483f] shadow-[0_8px_24px_rgba(44,47,37,0.04)] sm:px-6"
                      }`}
                    >
                      {text || (
                        <span
                          className="inline-flex gap-1.5 py-2"
                          aria-label="Response is being prepared"
                        >
                          <span className="size-1.5 animate-pulse rounded-full bg-(--leaf)" />
                          <span className="size-1.5 animate-pulse rounded-full bg-(--leaf) [animation-delay:0.15s]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-(--leaf) [animation-delay:0.3s]" />
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="shrink-0 border-t border-[#c84f38]/20 bg-[#f0e2d7] px-5 py-3 sm:px-8"
          >
            <div className="mx-auto flex max-w-250 flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#75392d]">
                {error.message || "Something went wrong. Please try again."}
              </p>
              <div className="flex shrink-0 items-center gap-4">
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  className="font-mono text-[10px] uppercase tracking-[0.13em] text-(--leaf) underline underline-offset-4 transition hover:text-(--tomato)"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={clearError}
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
            className="composer-focus mx-auto flex max-w-250 items-end gap-3 border border-[#20251f]/20 bg-[#fffdf7] p-2 pl-4 shadow-[0_8px_24px_rgba(44,47,37,0.05)]"
          >
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
                  handleSubmit(event);
                }
              }}
              placeholder="Write your message..."
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
                disabled={!input.trim()}
                className="shrink-0 bg-(--leaf) px-4 py-3 font-mono text-[10px] uppercase tracking-[0.13em] text-white transition hover:bg-[#334c38] disabled:cursor-not-allowed disabled:bg-[#c8c7bb]"
              >
                Send <span aria-hidden="true">↗</span>
              </button>
            )}
          </form>
          <p className="mx-auto mt-2 max-w-250 font-mono text-[8px] uppercase tracking-[0.12em] text-[#9a9c92]">
            Enter to send · Shift + Enter for a new line
          </p>
        </footer>
      </main>
    </div>
  );
}
