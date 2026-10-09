"use client";

import {
  ArrowUpRight,
  Check,
  EllipsisVertical,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SaylaBrand } from "./sayla-brand";

type SideNavProps = {
  chats: Array<{ id: string; title: string | null }>;
  activeChatId: string | null;
  isAuthenticated: boolean | null;
  isChatsLoading: boolean;
  userName: string | null;
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => Promise<void>;
  onDeleteChat: (chatId: string) => Promise<void>;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => Promise<void>;
};

export default function SideNav({
  chats,
  activeChatId,
  isAuthenticated,
  isChatsLoading,
  userName,
  mobileNavOpen,
  onMobileNavOpenChange,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onLogin,
  onRegister,
  onLogout,
}: SideNavProps) {
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editedChatTitle, setEditedChatTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [chatActionError, setChatActionError] = useState<string | null>(null);

  function beginSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(
        Math.max(220, Math.min(360, startWidth + moveEvent.clientX - startX)),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function confirmLogout() {
    setIsLogoutPending(true);
    setLogoutError(null);
    try {
      await onLogout();
      setIsLogoutConfirmOpen(false);
    } catch {
      setLogoutError("Could not log out. Please try again.");
    } finally {
      setIsLogoutPending(false);
    }
  }

  function renderAccountControls(isMobile = false) {
    if (isAuthenticated === null) return null;

    if (isAuthenticated) {
      const initial = userName?.trim().charAt(0).toUpperCase() || "U";

      return (
        <>
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="flex h-10 w-full items-center gap-3 px-3 text-left text-sm text-[#62675d] transition hover:bg-[#e4e4d9] hover:text-(--ink)"
          >
            <span className="grid size-9 shrink-0 place-items-center">
              <LogOut aria-hidden="true" size={17} />
            </span>
            Log out
          </button>
          <div className="flex h-10 min-w-0 items-center gap-3 px-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[#20251f]/10 bg-(--tomato) font-serif text-lg text-white">
              {initial}
            </span>
            <span className="min-w-0 truncate text-sm text-(--ink)">
              {userName || "Your account"}
            </span>
          </div>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={() => {
            onLogin();
            if (isMobile) onMobileNavOpenChange(false);
          }}
          className="flex h-10 w-full items-center gap-3 px-3 text-left text-sm text-[#62675d] transition hover:bg-[#e4e4d9] hover:text-(--ink)"
        >
          <span className="grid size-9 shrink-0 place-items-center">
            <LogIn aria-hidden="true" size={17} />
          </span>
          Log in
        </button>
        <button
          type="button"
          onClick={() => {
            onRegister();
            if (isMobile) onMobileNavOpenChange(false);
          }}
          className="flex h-10 w-full items-center justify-center gap-2 bg-(--leaf) px-3 text-sm text-white transition hover:bg-[#914b35]"
        >
          <UserRoundPlus aria-hidden="true" size={16} />
          Create account <ArrowUpRight aria-hidden="true" size={14} />
        </button>
      </>
    );
  }

  function renderNewChatButton() {
    return (
      <button
        type="button"
        onClick={() => {
          onNewChat();
          onMobileNavOpenChange(false);
        }}
        className="new-chat-button flex h-11 w-full items-center gap-3 border border-[#20251f]/15 bg-[#f8f6ef] px-3 text-sm text-[#42483f] transition hover:border-(--leaf) hover:bg-white"
      >
        <Plus aria-hidden="true" size={18} className="text-(--leaf)" />
        New chat
      </button>
    );
  }

  function renderSettingsButton() {
    return (
      <button
        type="button"
        className="flex h-10 w-full items-center gap-3 px-3 text-left text-sm text-[#62675d] transition hover:bg-[#e4e4d9] hover:text-(--ink)"
      >
        <span className="grid size-9 shrink-0 place-items-center">
          <Settings aria-hidden="true" size={17} />
        </span>
        Settings
      </button>
    );
  }

  async function saveChatTitle(chatId: string) {
    const title = editedChatTitle.trim();
    if (!title) return;
    try {
      await onRenameChat(chatId, title);
      setEditingChatId(null);
      setOpenChatMenuId(null);
      setChatActionError(null);
    } catch {
      setChatActionError("Could not rename this chat. Please try again.");
    }
  }

  async function confirmDeleteChat() {
    if (!deleteTarget) return;
    setIsDeletePending(true);
    setChatActionError(null);
    try {
      await onDeleteChat(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setChatActionError("Could not delete this chat. Please try again.");
    } finally {
      setIsDeletePending(false);
    }
  }

  function renderChatHistory() {
    return (
      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <h2 className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[#85897e]">
          Chats
        </h2>
        {isChatsLoading ? (
          <p className="px-3 py-2 text-xs text-[#85897e]">Loading chats...</p>
        ) : chats.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#85897e]">No chats yet</p>
        ) : (
          <ul className="space-y-1">
            {chats.map((chat) => (
              <li key={chat.id} className="relative">
                {editingChatId === chat.id ? (
                  <div className="flex min-h-10 items-center gap-1 border border-(--leaf)/30 bg-[#f8f6ef] px-2">
                    <input
                      autoFocus
                      aria-label="Chat title"
                      value={editedChatTitle}
                      maxLength={80}
                      onChange={(event) =>
                        setEditedChatTitle(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveChatTitle(chat.id);
                        if (event.key === "Escape") setEditingChatId(null);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-xs text-(--ink) outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Save chat title"
                      onClick={() => void saveChatTitle(chat.id)}
                      className="grid size-7 shrink-0 place-items-center text-(--leaf) hover:bg-[#e8e9de]"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel rename"
                      onClick={() => setEditingChatId(null)}
                      className="grid size-7 shrink-0 place-items-center text-[#85897e] hover:bg-[#e8e9de]"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`group flex min-h-10 items-center gap-1 ${activeChatId === chat.id ? "bg-[#e4e4d9] text-(--ink)" : "text-[#62675d] hover:bg-[#e8e9de]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectChat(chat.id);
                        onMobileNavOpenChange(false);
                      }}
                      className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs"
                      title={chat.title || "New chat"}
                    >
                      {chat.title || "New chat"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Actions for ${chat.title || "chat"}`}
                      aria-expanded={openChatMenuId === chat.id}
                      onClick={() =>
                        setOpenChatMenuId((current) =>
                          current === chat.id ? null : chat.id,
                        )
                      }
                      className="mr-1 grid size-8 shrink-0 place-items-center text-[#777b71] opacity-100 transition hover:bg-white/70 hover:text-(--ink) md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                    >
                      <EllipsisVertical size={17} />
                    </button>
                    {openChatMenuId === chat.id && (
                      <div className="absolute top-9 right-1 z-30 w-32 border border-[#20251f]/12 bg-[#fffdf7] py-1 shadow-[0_8px_24px_rgba(44,47,37,0.12)]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditedChatTitle(chat.title || "");
                            setEditingChatId(chat.id);
                            setOpenChatMenuId(null);
                          }}
                          className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-[#565c51] hover:bg-[#e8e9de]"
                        >
                          <Pencil size={14} /> Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget({
                              id: chat.id,
                              title: chat.title || "New chat",
                            });
                            setOpenChatMenuId(null);
                          }}
                          className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-[#9d3b2a] hover:bg-[#f0e2d7]"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {chatActionError && (
          <p role="alert" className="mt-2 px-3 text-xs text-[#9d3b2a]">
            {chatActionError}
          </p>
        )}
      </section>
    );
  }

  function renderDeleteConfirmation() {
    if (!deleteTarget) return null;
    return (
      <div className="auth-overlay">
        <button
          type="button"
          aria-label="Cancel chat deletion"
          onClick={() => setDeleteTarget(null)}
          className="auth-overlay__backdrop"
        />
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-chat-title"
          aria-describedby="delete-chat-description"
          className="auth-dialog"
        >
          <p className="auth-eyebrow">Delete chat</p>
          <h2 id="delete-chat-title" className="auth-title">
            Delete this conversation?
          </h2>
          <p id="delete-chat-description" className="auth-copy">
            “{deleteTarget.title}” and its messages will be permanently deleted.
          </p>
          {chatActionError && (
            <p role="alert" className="auth-error mt-3">
              {chatActionError}
            </p>
          )}
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletePending}
              className="auth-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDeleteChat()}
              disabled={isDeletePending}
              className="auth-primary disabled:cursor-wait disabled:opacity-70"
            >
              {isDeletePending ? "Deleting..." : "Delete chat"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <aside
        className="sidebar-shell relative z-20 hidden shrink-0 flex-col border-r border-[#20251f]/12 bg-[#eeece2] md:flex"
        style={{ width: sidebarWidth }}
      >
        <div className="flex h-18 shrink-0 items-center px-6">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Sayla home"
          >
            <SaylaBrand />
          </Link>
        </div>
        <div className="px-4">{renderNewChatButton()}</div>
        {renderChatHistory()}
        <div className="mt-auto space-y-2 border-t border-[#20251f]/10 p-4">
          {renderSettingsButton()}
          {renderAccountControls()}
        </div>
        <div
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={220}
          aria-valuemax={360}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={beginSidebarResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft")
              setSidebarWidth((width) => Math.max(220, width - 16));
            if (event.key === "ArrowRight")
              setSidebarWidth((width) => Math.min(360, width + 16));
          }}
          className="sidebar-resizer absolute inset-y-0 right-0 z-10 w-1 translate-x-1/2 cursor-col-resize touch-none"
        />
      </aside>

      {mobileNavOpen && (
        <div className="mobile-nav-layer fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => onMobileNavOpenChange(false)}
            className="mobile-nav-backdrop absolute inset-0 bg-[#20251f]/25 backdrop-blur-[2px]"
          />
          <aside className="mobile-sidebar absolute inset-y-0 left-0 flex w-[min(88vw,18rem)] flex-col border-r border-[#20251f]/12 bg-[#eeece2] shadow-[12px_0_40px_rgba(32,37,31,0.12)]">
            <div className="flex h-18 shrink-0 items-center justify-between px-6">
              <Link
                href="/"
                className="flex items-center gap-3"
                aria-label="Sayla home"
              >
                <SaylaBrand compact />
              </Link>
              <button
                type="button"
                onClick={() => onMobileNavOpenChange(false)}
                aria-label="Close navigation"
                className="grid size-9 place-items-center text-[#696e63] hover:bg-[#e1e1d6]"
              >
                <X size={19} />
              </button>
            </div>
            <div className="px-4">{renderNewChatButton()}</div>
            {renderChatHistory()}
            <div className="mt-auto space-y-2 border-t border-[#20251f]/10 p-4">
              {renderSettingsButton()}
              {renderAccountControls(true)}
            </div>
          </aside>
        </div>
      )}

      {isLogoutConfirmOpen && (
        <div className="auth-overlay">
          <button
            type="button"
            aria-label="Cancel log out"
            onClick={() => setIsLogoutConfirmOpen(false)}
            className="auth-overlay__backdrop"
          />
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            className="auth-dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !isLogoutPending) {
                setIsLogoutConfirmOpen(false);
              }
            }}
          >
            <SaylaBrand compact />
            <div className="auth-dialog__content">
              <p className="auth-eyebrow">Before you go</p>
              <h2 id="logout-title" className="auth-title">
                Log out of Sayla?
              </h2>
              <p id="logout-description" className="auth-copy">
                You can log back in anytime to access your account.
              </p>
              {logoutError && (
                <p role="alert" className="auth-error">
                  {logoutError}
                </p>
              )}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  disabled={isLogoutPending}
                  className="auth-secondary"
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmLogout()}
                  disabled={isLogoutPending}
                  className="auth-primary disabled:cursor-wait disabled:opacity-70"
                >
                  {isLogoutPending ? "Logging out…" : "Log out"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {renderDeleteConfirmation()}
    </>
  );
}
