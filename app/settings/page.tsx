"use client";

import { ArrowLeft, Check, KeyRound, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import FirstVisitIntro from "../components/first-visit-intro";
import { SaylaBrand } from "../components/sayla-brand";

type SettingsProfile = {
  name: string;
  email: string;
  hasPassword: boolean;
  createdAt: string;
  chatCount: number;
};

type FormValues = {
  name: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyValues: FormValues = {
  name: "",
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    fetch("/api/settings")
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401)
            throw new Error("Sign in to manage your account settings.");
          throw new Error("Could not load your account settings.");
        }
        return (await response.json()) as SettingsProfile;
      })
      .then((settings) => {
        if (!isCurrent) return;
        setProfile(settings);
        setValues((current) => ({
          ...current,
          name: settings.name,
          email: settings.email,
        }));
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load your account settings.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
    setSuccess(null);
  }

  const nameChanged = Boolean(profile && values.name.trim() !== profile.name);
  const emailChanged = Boolean(
    profile &&
    values.email.trim().toLowerCase() !== profile.email.toLowerCase(),
  );
  const passwordChanged = values.newPassword.length > 0;
  const hasChanges = nameChanged || emailChanged || passwordChanged;
  const passwordsMatch = values.newPassword === values.confirmPassword;
  const sensitiveChange = emailChanged || passwordChanged;
  const canReview =
    hasChanges &&
    Boolean(values.name.trim()) &&
    Boolean(values.email.trim()) &&
    (!passwordChanged || (values.newPassword.length >= 8 && passwordsMatch)) &&
    (!sensitiveChange || Boolean(values.currentPassword));

  function changeSummary() {
    const items: string[] = [];
    if (nameChanged)
      items.push(
        `Display name: ${profile?.name || "Not set"} → ${values.name.trim()}`,
      );
    if (emailChanged)
      items.push(
        `Email: ${profile?.email || "Not set"} → ${values.email.trim().toLowerCase()}`,
      );
    if (passwordChanged) items.push("Password: update to a new password");
    return items;
  }

  async function saveChanges() {
    if (!canReview || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(nameChanged ? { name: values.name.trim() } : {}),
          ...(emailChanged ? { email: values.email.trim().toLowerCase() } : {}),
          ...(passwordChanged
            ? {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
              }
            : sensitiveChange
              ? { currentPassword: values.currentPassword }
              : {}),
        }),
      });
      const result = (await response.json()) as
        | { name: string | null; email: string | null }
        | { error: string };
      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result ? result.error : "Could not update your settings.",
        );
      }

      setProfile((current) =>
        current
          ? { ...current, name: result.name ?? "", email: result.email ?? "" }
          : current,
      );
      setValues((current) => ({
        ...current,
        name: result.name ?? "",
        email: result.email ?? "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setIsReviewOpen(false);
      setSuccess("Your account settings have been updated.");
    } catch (caughtError) {
      setIsReviewOpen(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update your settings.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function resetChanges() {
    if (!profile) return;
    setValues({ ...emptyValues, name: profile.name, email: profile.email });
    setError(null);
    setSuccess(null);
  }

  return (
    <main className="min-h-dvh bg-(--paper) text-(--ink)">
      <FirstVisitIntro playOnMount durationMs={1000} />
      <header className="border-b border-[#20251f]/15 bg-[#eeece2]">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            aria-label="Back to Sayla"
            className="flex items-center gap-3 text-sm text-[#62675d] hover:text-(--ink)"
          >
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">Back to chat</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <SaylaBrand compact />
          <span className="w-20" aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 border-b border-[#20251f]/12 pb-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-(--tomato)">
            Account
          </p>
          <h1 className="mt-2 font-serif text-4xl text-(--ink)">Settings</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#666b60]">
            Manage your profile and sign-in details.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 border border-[#c84f38]/20 bg-[#f0e2d7] px-4 py-3 text-sm text-[#75392d]"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mb-5 flex items-center gap-2 border border-[#a85d41]/20 bg-[#e8e9de] px-4 py-3 text-sm text-[#42483f]"
          >
            <Check size={16} className="text-(--leaf)" />
            {success}
          </div>
        )}

        {isLoading ? (
          <div
            className="flex min-h-64 items-center justify-center"
            role="status"
          >
            <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-(--leaf)">
              <span className="size-2 animate-pulse rounded-full bg-(--tomato)" />
              Loading account settings
            </span>
          </div>
        ) : profile ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (canReview) setIsReviewOpen(true);
              }}
              className="min-w-0"
            >
              <section className="border-b border-[#20251f]/12 pb-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-[#e8e9de] text-(--leaf)">
                    <UserRound size={17} />
                  </span>
                  <div>
                    <h2 className="text-base font-medium">Profile</h2>
                    <p className="mt-0.5 text-xs text-[#85897e]">
                      The name shown with your account.
                    </p>
                  </div>
                </div>
                <label className="grid max-w-xl gap-2 text-xs text-[#565c51]">
                  Display name
                  <input
                    value={values.name}
                    onChange={(event) =>
                      updateValue("name", event.target.value)
                    }
                    maxLength={80}
                    required
                    autoComplete="name"
                    className="h-11 border border-[#20251f]/18 bg-[#fffdf7] px-3 text-sm text-(--ink) outline-none transition focus:border-(--leaf) focus:ring-2 focus:ring-(--leaf)/15"
                  />
                </label>
              </section>

              <section className="border-b border-[#20251f]/12 py-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-[#f0e2d7] text-(--tomato)">
                    <Mail size={17} />
                  </span>
                  <div>
                    <h2 className="text-base font-medium">Email address</h2>
                    <p className="mt-0.5 text-xs text-[#85897e]">
                      Used to sign in to your account.
                    </p>
                  </div>
                </div>
                <label className="grid max-w-xl gap-2 text-xs text-[#565c51]">
                  Email
                  <input
                    value={values.email}
                    onChange={(event) =>
                      updateValue("email", event.target.value)
                    }
                    type="email"
                    required
                    autoComplete="email"
                    className="h-11 border border-[#20251f]/18 bg-[#fffdf7] px-3 text-sm text-(--ink) outline-none transition focus:border-(--leaf) focus:ring-2 focus:ring-(--leaf)/15"
                  />
                </label>
              </section>

              <section className="border-b border-[#20251f]/12 py-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-[#e8e9de] text-(--leaf)">
                    <KeyRound size={17} />
                  </span>
                  <div>
                    <h2 className="text-base font-medium">Password</h2>
                    <p className="mt-0.5 text-xs text-[#85897e]">
                      Leave these blank to keep your current password.
                    </p>
                  </div>
                </div>
                <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-xs text-[#565c51] sm:col-span-2">
                    Current password
                    <input
                      value={values.currentPassword}
                      onChange={(event) =>
                        updateValue("currentPassword", event.target.value)
                      }
                      type="password"
                      autoComplete="current-password"
                      required={sensitiveChange}
                      className="h-11 border border-[#20251f]/18 bg-[#fffdf7] px-3 text-sm text-(--ink) outline-none transition focus:border-(--leaf) focus:ring-2 focus:ring-(--leaf)/15"
                    />
                  </label>
                  <label className="grid gap-2 text-xs text-[#565c51]">
                    New password
                    <input
                      value={values.newPassword}
                      onChange={(event) =>
                        updateValue("newPassword", event.target.value)
                      }
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      className="h-11 border border-[#20251f]/18 bg-[#fffdf7] px-3 text-sm text-(--ink) outline-none transition focus:border-(--leaf) focus:ring-2 focus:ring-(--leaf)/15"
                    />
                  </label>
                  <label className="grid gap-2 text-xs text-[#565c51]">
                    Confirm new password
                    <input
                      value={values.confirmPassword}
                      onChange={(event) =>
                        updateValue("confirmPassword", event.target.value)
                      }
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      className="h-11 border border-[#20251f]/18 bg-[#fffdf7] px-3 text-sm text-(--ink) outline-none transition focus:border-(--leaf) focus:ring-2 focus:ring-(--leaf)/15"
                    />
                  </label>
                  {passwordChanged && !passwordsMatch && (
                    <p
                      role="alert"
                      className="text-xs text-[#9d3b2a] sm:col-span-2"
                    >
                      The new passwords do not match.
                    </p>
                  )}
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-3 pt-6">
                <button
                  type="submit"
                  disabled={!canReview || isSaving}
                  className="inline-flex h-11 items-center justify-center gap-2 bg-(--leaf) px-5 text-sm text-white transition hover:bg-[#914b35] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Review changes
                </button>
                <button
                  type="button"
                  onClick={resetChanges}
                  disabled={!hasChanges || isSaving}
                  className="h-11 px-4 text-sm text-[#62675d] transition hover:bg-[#e8e9de] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Discard
                </button>
              </div>
            </form>

            <aside className="h-fit border-t border-[#20251f]/12 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <h2 className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#85897e]">
                Account overview
              </h2>
              <dl className="mt-4 divide-y divide-[#20251f]/10 text-sm">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-[#777b71]">Chats saved</dt>
                  <dd className="font-medium text-(--ink)">
                    {profile.chatCount}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-[#777b71]">Member since</dt>
                  <dd className="text-right text-(--ink)">
                    {new Date(profile.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-[#85897e]">
                {profile.hasPassword
                  ? "Your password is stored securely and never displayed here."
                  : "This account does not have a password set."}
              </p>
            </aside>
          </div>
        ) : null}
      </div>

      {isReviewOpen && (
        <div className="auth-overlay">
          <button
            type="button"
            aria-label="Cancel settings review"
            onClick={() => setIsReviewOpen(false)}
            disabled={isSaving}
            className="auth-overlay__backdrop"
          />
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="settings-review-title"
            aria-describedby="settings-review-description"
            className="auth-dialog"
          >
            <p className="auth-eyebrow">Review before saving</p>
            <h2 id="settings-review-title" className="auth-title">
              Confirm account changes
            </h2>
            <p id="settings-review-description" className="auth-copy">
              Check these updates before applying them to your account.
            </p>
            <ul className="mt-5 divide-y divide-[#20251f]/10 border-y border-[#20251f]/10 text-sm text-[#42483f]">
              {changeSummary().map((item) => (
                <li key={item} className="py-3">
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                disabled={isSaving}
                className="auth-secondary"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => void saveChanges()}
                disabled={isSaving}
                className="auth-primary disabled:cursor-wait disabled:opacity-70"
              >
                {isSaving ? "Saving changes..." : "Confirm and save"}
              </button>
            </div>
            {isSaving && (
              <p
                role="status"
                className="mt-4 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.13em] text-(--leaf)"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-(--tomato)" />
                Updating your account
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
