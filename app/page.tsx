"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import AuthOverlay from "./components/auth-overlay";
import Conversation from "./components/conversation";
import FirstVisitIntro from "./components/first-visit-intro";
import { SaylaBrand } from "./components/sayla-brand";
import SideNav from "./components/side-nav";
import {
  AUDIO_EXTENSIONS,
  fileToUIPart,
  isSupportedFile,
  MAX_AUDIO_FILE_BYTES,
  MAX_FILES,
  MAX_OTHER_FILE_BYTES,
  MAX_TOTAL_FILE_BYTES,
  SOURCE_REQUEST_PROMPT,
} from "@/lib/chat-utils";
import {
  createGuestChat,
  deleteGuestChat,
  loadGuestChat,
  loadGuestChats,
  renameGuestChat,
  saveGuestChat,
} from "@/lib/guest-chat-storage";

const chatTransport = new DefaultChatTransport({ api: "/api/chat" });

type ChatSummary = { id: string; title: string | null; updatedAt?: string };

export default function MainChat() {
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    error,
    regenerate,
    clearError,
  } = useChat({ transport: chatTransport });
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatsLoaded, setIsChatsLoaded] = useState(false);
  const [authMode, setAuthMode] = useState<
    "prompt" | "login" | "register" | null
  >(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dismissedSourceMessageId, setDismissedSourceMessageId] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatLoadSequence = useRef(0);
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    let isCurrent = true;
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((session: { user?: { name?: string | null } | null }) => {
        if (isCurrent) {
          setIsAuthenticated(Boolean(session?.user));
          setUserName(session?.user?.name ?? null);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setIsAuthenticated(false);
          setUserName(null);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated === false) {
      const loadTimer = window.setTimeout(() => {
        const guestChats = loadGuestChats();
        setChats(guestChats);
        setIsChatsLoaded(true);
      }, 0);
      return () => window.clearTimeout(loadTimer);
    }
    if (isAuthenticated !== true) return;

    let isCurrent = true;
    fetch("/api/chats")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load chat history.");
        return (await response.json()) as ChatSummary[];
      })
      .then((loadedChats) => {
        if (isCurrent) {
          setChats(loadedChats);
          setIsChatsLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error("Could not load chat history:", error);
          setChats([]);
          setIsChatsLoaded(true);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (
      isAuthenticated !== false ||
      !activeChatId?.startsWith("guest-") ||
      messages.length === 0
    ) {
      return;
    }

    const guestChat = loadGuestChat(activeChatId);
    if (guestChat) {
      saveGuestChat({ ...guestChat, messages });
    }
  }, [activeChatId, isAuthenticated, messages]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if ((!text && files.length === 0) || isStreaming) return;
    if (isAuthenticated === null) {
      setUploadError("Checking your account. Please try again in a moment.");
      return;
    }

    try {
      const fileParts = await Promise.all(files.map(fileToUIPart));
      const shouldPromptForAuth =
        isAuthenticated === false && messages.length === 0;
      let chatId = activeChatId;
      if (isAuthenticated && !chatId) {
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstMessage: text }),
        });
        if (!response.ok) throw new Error("Could not start a saved chat.");
        const chat = (await response.json()) as ChatSummary;
        chatId = chat.id;
        setActiveChatId(chat.id);
        setChats((current) => [
          chat,
          ...current.filter((item) => item.id !== chat.id),
        ]);
      } else if (isAuthenticated === false && !chatId) {
        const guestChat = createGuestChat(text || files[0]?.name || "New chat");
        chatId = guestChat.id;
        saveGuestChat(guestChat);
        setActiveChatId(guestChat.id);
        setChats((current) => [
          guestChat,
          ...current.filter((item) => item.id !== guestChat.id),
        ]);
      }
      setIsSendingMessage(true);
      const sending = sendMessage(
        { text, files: fileParts },
        {
          body: isAuthenticated && chatId ? { chatId } : {},
        },
      );
      if (shouldPromptForAuth) setAuthMode("prompt");
      setInput("");
      setFiles([]);
      setUploadError(null);
      await sending;
      setIsSendingMessage(false);
      if (chatId) {
        setChats((current) => {
          const updatedChat = current.find((chat) => chat.id === chatId);
          return updatedChat
            ? [updatedChat, ...current.filter((chat) => chat.id !== chatId)]
            : current;
        });
      }
    } catch (caughtError) {
      setIsSendingMessage(false);
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
    setIsSendingMessage(true);
    void sendMessage(
      { text: SOURCE_REQUEST_PROMPT },
      { body: activeChatId ? { chatId: activeChatId } : {} },
    ).finally(() => setIsSendingMessage(false));
  }

  function startNewChat() {
    chatLoadSequence.current += 1;
    setIsChatLoading(false);
    if (isStreaming) stop();
    setIsSendingMessage(false);
    setMessages([]);
    setInput("");
    setFiles([]);
    setUploadError(null);
    setDismissedSourceMessageId(null);
    setAuthMode(null);
    setActiveChatId(null);
  }

  async function selectChat(chatId: string) {
    const requestSequence = ++chatLoadSequence.current;
    setIsChatLoading(true);
    if (isStreaming) await stop();
    setIsSendingMessage(false);
    if (requestSequence !== chatLoadSequence.current) return;
    setMessages([]);
    setInput("");
    setFiles([]);
    setUploadError(null);
    setDismissedSourceMessageId(null);
    setActiveChatId(null);

    try {
      if (chatId.startsWith("guest-")) {
        const guestChat = loadGuestChat(chatId);
        if (!guestChat) throw new Error("Could not open this chat.");
        if (requestSequence !== chatLoadSequence.current) return;
        setMessages(guestChat.messages);
        setActiveChatId(guestChat.id);
        return;
      }

      const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
      if (!response.ok) throw new Error("Could not open this chat.");
      const chat = (await response.json()) as {
        id: string;
        messages: UIMessage[];
      };
      if (requestSequence !== chatLoadSequence.current) return;
      setMessages(chat.messages);
      setActiveChatId(chat.id);
    } catch (caughtError) {
      if (requestSequence === chatLoadSequence.current) {
        setUploadError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not open this chat.",
        );
      }
    } finally {
      if (requestSequence === chatLoadSequence.current) {
        setIsChatLoading(false);
      }
    }
  }

  async function renameChat(chatId: string, title: string) {
    if (chatId.startsWith("guest-")) {
      if (!renameGuestChat(chatId, title)) {
        throw new Error("Could not rename this local chat.");
      }
      setChats((current) =>
        current.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
      );
      return;
    }

    const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new Error("Could not rename this chat.");
    const updated = (await response.json()) as { id: string; title: string };
    setChats((current) =>
      current.map((chat) =>
        chat.id === updated.id ? { ...chat, title: updated.title } : chat,
      ),
    );
  }

  async function deleteChat(chatId: string) {
    if (activeChatId === chatId && isStreaming) await stop();
    if (chatId.startsWith("guest-")) {
      if (!deleteGuestChat(chatId)) {
        throw new Error("Could not delete this local chat.");
      }
      setChats((current) => current.filter((chat) => chat.id !== chatId));
      if (activeChatId === chatId) startNewChat();
      return;
    }

    const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Could not delete this chat.");
    setChats((current) => current.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) startNewChat();
  }

  async function handleSignOut() {
    await signOut({ redirect: false });
    setIsAuthenticated(false);
    setUserName(null);
    setChats([]);
    setIsChatsLoaded(false);
    setActiveChatId(null);
    setMessages([]);
  }

  const firstName = userName?.trim().split(/\s+/)[0];
  const isChatsLoading = isAuthenticated === true && !isChatsLoaded;

  return (
    <div className="app-shell flex h-dvh overflow-hidden bg-(--paper) text-(--ink)">
      <FirstVisitIntro />
      <SideNav
        chats={chats}
        activeChatId={activeChatId}
        isNewChatActive={
          !activeChatId && messages.length === 0 && !isChatLoading
        }
        isAuthenticated={isAuthenticated}
        isChatsLoading={isChatsLoading}
        userName={userName}
        mobileNavOpen={mobileNavOpen}
        onMobileNavOpenChange={setMobileNavOpen}
        onNewChat={startNewChat}
        onSelectChat={(chatId) => void selectChat(chatId)}
        onRenameChat={renameChat}
        onDeleteChat={deleteChat}
        onLogin={() => setAuthMode("login")}
        onRegister={() => setAuthMode("register")}
        onLogout={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#20251f]/15 px-5 sm:px-8">
          <div className="mx-auto flex h-18 max-w-250 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                className="mobile-nav-trigger grid size-10 place-items-center border border-[#20251f]/15 text-(--leaf) transition hover:bg-[#e8e9de] md:hidden"
              >
                <Menu size={19} />
              </button>
              <span className="md:hidden">
                <SaylaBrand compact />
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <span className="max-w-32 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-(--leaf)">
                Welcome{isAuthenticated && firstName ? ` ${firstName}` : ""}
              </span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#767b70]">
                <span
                  className={`size-1.5 rounded-full ${isStreaming ? "animate-pulse bg-(--tomato)" : "bg-(--leaf)"}`}
                />
                {isStreaming ? "Working" : "Ready"}
              </span>
            </div>
          </div>
        </header>

        <main className="page-enter flex min-h-0 flex-1 flex-col">
          {isChatLoading ? (
            <section
              className="flex min-h-0 flex-1 items-center justify-center px-5 py-6"
              role="status"
              aria-live="polite"
            >
              <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-(--leaf)">
                <span className="size-2 animate-pulse rounded-full bg-(--tomato)" />
                Loading your chat
              </span>
            </section>
          ) : (
            <Conversation
              messages={messages}
              isStreaming={isStreaming}
              isSendingMessage={isSendingMessage}
              isReady={status === "ready"}
              dismissedSourceMessageId={dismissedSourceMessageId}
              onStarterPrompt={setInput}
              onShowSources={showSources}
              onDismissSources={setDismissedSourceMessageId}
            />
          )}

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
                      if (error)
                        void regenerate({
                          body: activeChatId ? { chatId: activeChatId } : {},
                        });
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
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
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
                  className="shrink-0 rounded-lg bg-[#e8e9de] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.13em] text-(--leaf) transition hover:bg-[#ead8cf]"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && files.length === 0}
                  className="shrink-0 rounded-lg bg-(--leaf) px-4 py-3 font-mono text-[10px] uppercase tracking-[0.13em] text-white transition hover:bg-[#914b35] disabled:cursor-not-allowed disabled:bg-[#c8c7bb]"
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
      {authMode && (
        <AuthOverlay initialMode={authMode} onClose={() => setAuthMode(null)} />
      )}
    </div>
  );
}
