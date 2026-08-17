"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const { messages, sendMessage, status, stop, error } = useChat({
    onError: (error) => {
      console.error("CLIENT CHAT ERROR:", error);
    },

    onFinish: ({ message, isError, isAbort, isDisconnect }) => {
      console.log("CHAT FINISHED");
      console.log("message:", message);
      console.log("isError:", isError);
      console.log("isAbort:", isAbort);
      console.log("isDisconnect:", isDisconnect);
    },

    onData: (data) => {
      console.log("DATA FROM SERVER:", data);
    },
  });
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
    <div className="flex h-screen flex-col bg-[#15161a] text-[#e9e6df]">
      {/* Header */}
      <header className="shrink-0 border-b border-[#2a2b30] px-6 py-5">
        <div className="mx-auto flex max-w-2xl items-baseline justify-between">
          <h1 className="font-serif text-lg italic tracking-tight text-[#e9e6df]">
            Correspondence
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6b6c72]">
            {isStreaming ? "receiving…" : "idle"}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          {messages.length === 0 && (
            <div className="py-24 text-center">
              <p className="font-serif text-xl italic text-[#4d4e54]">
                No letters yet.
              </p>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-[#3d3e44]">
                Write the first line below
              </p>
            </div>
          )}

          {messages.map((message) => {
            const text = message.parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("");

            const isUser = message.role === "user";

            return (
              <div key={message.id} className="flex flex-col gap-1.5">
                {error && <div className="text-red-500">{error.message}</div>}
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                      isUser ? "text-[#c9a227]" : "text-[#6b6c72]"
                    }`}
                  >
                    {isUser ? "You" : "Model"}
                  </span>
                  <span className="h-px flex-1 bg-[#2a2b30]" />
                </div>
                <p
                  className={`whitespace-pre-wrap text-[15px] leading-relaxed ${
                    isUser ? "text-[#e9e6df]" : "text-[#c7c5bd]"
                  }`}
                >
                  {text || (
                    <span className="inline-flex gap-1 py-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6b6c72]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6b6c72] [animation-delay:0.15s]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6b6c72] [animation-delay:0.3s]" />
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[#2a2b30] px-6 py-5">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl items-end gap-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Write your message…"
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent py-2 text-[15px] text-[#e9e6df] placeholder-[#4d4e54] outline-none"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={() => stop()}
              className="shrink-0 rounded-full border border-[#3a3b41] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[#c7c5bd] transition hover:border-[#c9a227] hover:text-[#c9a227]"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 rounded-full bg-[#c9a227] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[#15161a] transition hover:bg-[#dab648] disabled:cursor-not-allowed disabled:bg-[#3a3b41] disabled:text-[#6b6c72]"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
