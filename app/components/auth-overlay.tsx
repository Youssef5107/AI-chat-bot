"use client";

import { useActionState, useEffect, useState } from "react";
import { login, register } from "@/actions/auth";

type AuthMode = "prompt" | "login" | "register";

export default function AuthOverlay({
  initialMode,
  onClose,
}: {
  initialMode: AuthMode;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isClosing, setIsClosing] = useState(false);
  const [loginMessage, loginAction, isLoginPending] = useActionState(
    login,
    undefined,
  );
  const [registerMessage, registerAction, isRegisterPending] = useActionState(
    register,
    undefined,
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isClosing) {
        setIsClosing(true);
        window.setTimeout(onClose, 220);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isClosing, onClose]);

  function close() {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(onClose, 220);
  }

  return (
    <div className={`auth-overlay ${isClosing ? "auth-overlay--closing" : ""}`}>
      <button
        type="button"
        aria-label="Close sign in dialog"
        onClick={close}
        className="auth-overlay__backdrop"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className={`auth-dialog ${isClosing ? "auth-dialog--closing" : ""}`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close dialog"
          className="auth-dialog__close"
        >
          ×
        </button>
        <div className="auth-dialog__mark" aria-hidden="true">
          r
        </div>

        {mode === "prompt" ? (
          <div className="auth-dialog__content">
            <p className="auth-eyebrow">A little heads-up</p>
            <h2 id="auth-title" className="auth-title">
              Keep your conversations close.
            </h2>
            <p className="auth-copy">
              Your chat is underway. Chats started as a guest aren’t saved to an
              account, so they’ll only stay available while this page is open.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="auth-primary"
              >
                Log in <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className="auth-secondary"
              >
                Create an account
              </button>
            </div>
            <button type="button" onClick={close} className="auth-guest">
              Continue as a guest
            </button>
          </div>
        ) : (
          <div
            key={mode}
            className="auth-dialog__content auth-dialog__content--switch"
          >
            <p className="auth-eyebrow">
              {mode === "login" ? "Welcome back" : "Start a fresh chapter"}
            </p>
            <h2 id="auth-title" className="auth-title">
              {mode === "login" ? "Log in to Relay AI" : "Create your account"}
            </h2>
            <p className="auth-copy">
              {mode === "login"
                ? "Pick up your ideas and conversations right where you left them."
                : "Save your conversations and keep your ideas close."}
            </p>
            <form
              action={mode === "login" ? loginAction : registerAction}
              className="auth-form"
            >
              {mode === "register" && (
                <label>
                  <span>Your name</span>
                  <input name="name" autoComplete="name" />
                </label>
              )}
              <label>
                <span>Email address</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "register" ? 8 : undefined}
                  required
                />
              </label>
              {(mode === "login" ? loginMessage : registerMessage) && (
                <p role="alert" className="auth-error">
                  {mode === "login" ? loginMessage : registerMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoginPending || isRegisterPending}
                className="auth-primary mt-2 w-full disabled:cursor-wait disabled:opacity-70"
              >
                {isLoginPending || isRegisterPending
                  ? "One moment…"
                  : mode === "login"
                    ? "Log in"
                    : "Create account"}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
            <p className="auth-switch">
              {mode === "login"
                ? "New to Relay AI?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
