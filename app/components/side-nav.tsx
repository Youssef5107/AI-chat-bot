"use client";

import {
  ArrowUpRight,
  LogIn,
  LogOut,
  Plus,
  Settings,
  UserRoundPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SaylaBrand } from "./sayla-brand";

type SideNavProps = {
  isAuthenticated: boolean | null;
  userName: string | null;
  mobileNavOpen: boolean;
  onMobileNavOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => Promise<void>;
};

export default function SideNav({
  isAuthenticated,
  userName,
  mobileNavOpen,
  onMobileNavOpenChange,
  onNewChat,
  onLogin,
  onRegister,
  onLogout,
}: SideNavProps) {
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

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
    </>
  );
}
