"use client";

import { useState } from "react";
import { useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, convertFileListToFileUIParts } from "ai";
import type { FileUIPart, UIMessage } from "ai";
import ChatNavigation from "../components/chat-navigation";

type Ingredient = {
  name: string;
  amount: string;
};

type Recipe = {
  name: string;
  ingredients: Ingredient[];
  steps: string[];
  sources?: Array<{ title: string; url: string }>;
};

const ideas = ["lemony pasta", "crispy chickpeas", "mushrooms & rice"];
const MAX_FILES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 12 * 1024 * 1024;
const recipeTransport = new DefaultChatTransport({
  api: "/api/structured-data",
});

type SelectedFile = {
  file: File;
  part: FileUIPart;
};

function isSupportedFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("text/") ||
    file.type === "application/pdf"
  );
}

function isWebSearchActive(messages: UIMessage[]) {
  return messages.some(
    (message) =>
      message.role === "assistant" &&
      message.parts.some((part) => {
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
      }),
  );
}

function isRecipeResponse(value: unknown): value is { recipe: Recipe } {
  if (!value || typeof value !== "object" || !("recipe" in value)) {
    return false;
  }

  const recipe = value.recipe;
  return (
    typeof recipe === "object" &&
    recipe !== null &&
    "name" in recipe &&
    typeof recipe.name === "string" &&
    "ingredients" in recipe &&
    Array.isArray(recipe.ingredients) &&
    recipe.ingredients.every(
      (ingredient) =>
        typeof ingredient === "object" &&
        ingredient !== null &&
        "name" in ingredient &&
        typeof ingredient.name === "string" &&
        "amount" in ingredient &&
        typeof ingredient.amount === "string",
    ) &&
    "steps" in recipe &&
    Array.isArray(recipe.steps) &&
    recipe.steps.every((step) => typeof step === "string") &&
    (! ("sources" in recipe) ||
      (Array.isArray(recipe.sources) &&
        recipe.sources.every(
          (source) =>
            typeof source === "object" &&
            source !== null &&
            "title" in source &&
            typeof source.title === "string" &&
            "url" in source &&
            typeof source.url === "string",
        )))
  );
}

export default function StructuredDatePage() {
  const {
    messages,
    sendMessage,
    status,
    error: chatError,
    clearError,
  } = useChat({
    transport: recipeTransport,
    onFinish: ({ message, isError }) => {
      if (isError) return;
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");

      try {
        const payload: unknown = JSON.parse(text);
        if (!isRecipeResponse(payload)) {
          throw new Error("The recipe came back in an unexpected format.");
        }
        setRecipe(payload.recipe);
        setFiles([]);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The recipe could not be read.",
        );
      }
    },
  });
  const [dish, setDish] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isGenerating = status === "submitted" || status === "streaming";
  const isSearchingWeb = isGenerating && isWebSearchActive(messages);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestDish = dish.trim();
    if ((!requestDish && files.length === 0) || isGenerating) return;

    setError(null);
    setRecipe(null);
    setCheckedIngredients([]);
    setCompletedSteps([]);

    try {
      await sendMessage({
        text: requestDish,
        files: files.map(({ part }) => part),
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  async function handleFilesSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selected = Array.from(event.target.files ?? []);
    const nextFiles = [...files.map(({ file }) => file), ...selected];
    const totalBytes = nextFiles.reduce((total, file) => total + file.size, 0);

    if (nextFiles.length > MAX_FILES) {
      setError(`Attach up to ${MAX_FILES} files per recipe.`);
    } else if (selected.some((file) => !isSupportedFile(file))) {
      setError("Attach images, PDFs, or text-based files.");
    } else if (selected.some((file) => file.size > MAX_FILE_BYTES)) {
      setError("Each file must be 8 MB or smaller.");
    } else if (totalBytes > MAX_TOTAL_FILE_BYTES) {
      setError("Attachments must total 12 MB or less.");
    } else {
      try {
        const parts = await convertFileListToFileUIParts(
          event.target.files ?? undefined,
        );
        setFiles((current) => [
          ...current,
          ...selected.map((file, index) => ({ file, part: parts[index] })),
        ]);
        setError(null);
      } catch {
        setError("Could not read one or more selected files.");
      }
    }

    event.target.value = "";
  }

  function toggleNumber(values: number[], value: number) {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  }

  return (
    <div className="min-h-screen bg-(--paper) text-(--ink)">
      <ChatNavigation active="recipe" />
      <main className="page-enter min-h-screen md:pl-57">
        <div className="mx-auto grid min-w-0 max-w-330 gap-10 px-5 pb-12 pt-9 sm:px-8 sm:pt-14 xl:grid-cols-[0.88fr_1.12fr] xl:gap-16 xl:pt-19">
          <section className="rise-in flex min-w-0 flex-col justify-center xl:pb-16">
            <p className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-(--tomato)">
              <span className="h-px w-8 bg-(--tomato)" />
              Your everyday recipe desk
            </p>
            <h1 className="max-w-xl font-serif text-[clamp(3.25rem,6vw,5.8rem)] leading-[0.94] tracking-[-0.035em]">
              What sounds <em className="text-(--leaf)">good?</em>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-[#64685e]">
              Start with a craving, a leftover, or whatever is waiting in the
              fridge. We’ll turn it into a recipe worth sitting down for.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 max-w-lg">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,text/*,.csv,.md"
                onChange={handleFilesSelected}
                className="hidden"
              />
              <label
                htmlFor="dish"
                className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#62685d]"
              >
                I feel like making...
              </label>
              <div className="flex min-h-15 items-stretch border-b-2 border-(--ink) focus-within:border-(--tomato)">
                <input
                  id="dish"
                  value={dish}
                  onChange={(event) => setDish(event.target.value)}
                  placeholder="e.g. a bright lunch with tomatoes"
                  maxLength={160}
                  className="min-w-0 flex-1 bg-transparent py-3 pr-3 font-serif text-[19px] outline-none placeholder:text-[#a6a69b]"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating || files.length >= MAX_FILES}
                  aria-label="Attach images or files"
                  title="Attach images or files"
                  className="my-2 mr-2 grid size-10 shrink-0 place-items-center border border-[#20251f]/15 text-lg text-(--leaf) transition hover:border-(--leaf) hover:bg-[#e8e9de] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span aria-hidden="true">＋</span>
                </button>
                <button
                  type="submit"
                  disabled={
                    (!dish.trim() && files.length === 0) || isGenerating
                  }
                  className="my-2 flex shrink-0 items-center gap-3 bg-(--tomato) px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#a8402e] disabled:cursor-not-allowed disabled:bg-[#c8c4b8] sm:px-5"
                >
                  {isSearchingWeb
                    ? "Searching the web"
                    : isGenerating
                      ? "Working"
                      : "Make it"}
                  <span aria-hidden="true">{isGenerating ? "···" : "↗"}</span>
                </button>
              </div>
              {files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <span
                      key={`${file.file.name}-${file.file.lastModified}-${index}`}
                      className="inline-flex max-w-full items-center gap-2 border border-[#20251f]/15 bg-[#fffdf7] px-3 py-1.5 text-xs text-[#565c51]"
                    >
                      <span className="truncate">{file.file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((current) =>
                            current.filter(
                              (_, fileIndex) => fileIndex !== index,
                            ),
                          )
                        }
                        aria-label={`Remove ${file.file.name}`}
                        className="font-mono text-sm text-[#929387] hover:text-(--tomato)"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.13em] text-[#8b8d82]">
                  Try
                </span>
                {ideas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setDish(idea)}
                    className="rounded-full border border-[#20251f]/20 px-3 py-1.5 text-xs text-[#545a50] transition hover:border-(--leaf) hover:text-(--leaf)"
                  >
                    {idea}
                  </button>
                ))}
              </div>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[#929387]">
                Images, PDFs, text · Up to 4 files / 12 MB
              </p>
            </form>

            {(error || chatError) && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-3 border-l-2 border-(--tomato) bg-[#eadfd3] px-4 py-3 text-sm text-[#75392d]"
              >
                <span
                  aria-hidden="true"
                  className="font-serif text-lg leading-5"
                >
                  !
                </span>
                <span>{error || chatError?.message}</span>
                {chatError && (
                  <button
                    type="button"
                    onClick={clearError}
                    className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] underline underline-offset-4"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}

            <div className="mt-12 flex items-center gap-4 border-t border-[#20251f]/15 pt-5 text-[11px] text-[#7d8176]">
              <span className="font-serif text-lg italic text-(--leaf)">
                01
              </span>
              <span>Made around your ingredients</span>
              <span className="h-px flex-1 bg-[#20251f]/15" />
              <span className="font-serif text-lg italic text-(--leaf)">
                02
              </span>
              <span>Ready for your kitchen</span>
            </div>
          </section>

          <section
            aria-label="Recipe result"
            aria-live="polite"
            className="rise-in min-w-0 overflow-hidden border border-[#20251f]/10 bg-[#fffdf7] shadow-[0_18px_50px_rgba(44,47,37,0.08)] [animation-delay:100ms]"
          >
            <div
              className="image-reveal relative min-h-55 overflow-hidden bg-[#536451] bg-cover bg-center sm:min-h-70"
              style={{
                backgroundImage:
                  'url("https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1500&q=85")',
              }}
            >
              <div className="absolute inset-0 bg-[#17251d]/35" />
              <div className="absolute left-5 top-5 flex items-center gap-2 border border-white/45 bg-[#20251f]/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-white backdrop-blur-sm sm:left-7 sm:top-7">
                <span className="size-1.5 rounded-full bg-(--butter)" />
                The everyday table
              </div>
              <p className="absolute bottom-5 left-5 max-w-md font-serif text-3xl italic leading-tight text-white sm:bottom-7 sm:left-7 sm:text-[40px]">
                A little inspiration
                <br />
                for what’s next.
              </p>
              <span className="absolute bottom-6 right-6 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-white/80 sm:block">
                Good things, made simply
              </span>
            </div>

            {isGenerating ? (
              <div className="flex min-h-70 flex-col items-center justify-center px-6 py-12 text-center">
                <span className="mb-5 grid size-12 place-items-center rounded-full border border-(--leaf)/30 text-(--leaf)">
                  <span className="animate-spin font-serif text-2xl">✳</span>
                </span>
                <p className="font-serif text-2xl italic">
                  {isSearchingWeb
                    ? "Searching the web..."
                    : "Finding the good bits..."}
                </p>
                <p className="mt-2 text-sm text-[#85877d]">
                  {isSearchingWeb
                    ? "Checking reliable cooking and food-safety sources"
                    : "Putting your recipe together"}
                </p>
              </div>
            ) : recipe ? (
              <div className="rise-in p-5 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#20251f]/15 pb-5">
                  <div>
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-(--tomato)">
                      Your recipe
                    </p>
                    <h2 className="max-w-xl font-serif text-3xl leading-tight sm:text-[38px]">
                      {recipe.name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="border border-[#20251f]/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#62685d] transition hover:border-(--leaf) hover:text-(--leaf)"
                  >
                    Print recipe
                  </button>
                </div>

                <div className="grid gap-8 pt-6 sm:grid-cols-[0.72fr_1.28fr] sm:gap-10">
                  <div>
                    <div className="mb-4 flex items-baseline justify-between">
                      <h3 className="font-serif text-xl italic">Gather</h3>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#92948a]">
                        {recipe.ingredients.length} things
                      </span>
                    </div>
                    <ul className="recipe-stagger space-y-3">
                      {recipe.ingredients.map((ingredient, index) => {
                        const isChecked = checkedIngredients.includes(index);
                        return (
                          <li key={`${ingredient.name}-${index}`}>
                            <label className="lift-on-hover flex cursor-pointer items-start gap-3 text-sm leading-5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  setCheckedIngredients((current) =>
                                    toggleNumber(current, index),
                                  )
                                }
                                className="mt-1 size-3.5 accent-(--leaf)"
                              />
                              <span
                                className={
                                  isChecked
                                    ? "text-[#9a9b91] line-through"
                                    : "text-[#42483f]"
                                }
                              >
                                <span className="font-medium">
                                  {ingredient.name}
                                </span>
                                <span className="text-[#85877d]">
                                  {" "}
                                  · {ingredient.amount}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div>
                    <div className="mb-4 flex items-baseline justify-between">
                      <h3 className="font-serif text-xl italic">Make it</h3>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#92948a]">
                        {completedSteps.length}/{recipe.steps.length} done
                      </span>
                    </div>
                    <ol className="recipe-stagger space-y-4">
                      {recipe.steps.map((step, index) => {
                        const isComplete = completedSteps.includes(index);
                        return (
                          <li key={`${step}-${index}`}>
                            <button
                              type="button"
                              onClick={() =>
                                setCompletedSteps((current) =>
                                  toggleNumber(current, index),
                                )
                              }
                              className="lift-on-hover group flex w-full items-start gap-3 text-left"
                              aria-pressed={isComplete}
                            >
                              <span
                                className={`grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[9px] transition ${isComplete ? "border-(--leaf) bg-(--leaf) text-white" : "border-[#20251f]/20 text-[#73786d] group-hover:border-(--leaf) group-hover:text-(--leaf)"}`}
                              >
                                {isComplete
                                  ? "✓"
                                  : String(index + 1).padStart(2, "0")}
                              </span>
                              <span
                                className={`pt-0.5 text-sm leading-6 ${isComplete ? "text-[#96988e] line-through" : "text-[#42483f]"}`}
                              >
                                {step}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
                {recipe.sources && recipe.sources.length > 0 && (
                  <div className="mt-7 border-t border-[#20251f]/10 pt-4">
                    <h3 className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#85897e]">
                      Sources
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                      {recipe.sources.map((source) => (
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
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-62.5 flex-col justify-center px-6 py-9 sm:px-10">
                <span className="mb-4 font-serif text-3xl italic text-(--leaf)">
                  Your page is open.
                </span>
                <p className="max-w-md text-sm leading-6 text-[#73776d]">
                  Tell us what you’re in the mood for and your recipe will land
                  here, with ingredients to gather and steps you can tick off as
                  you go.
                </p>
                <div className="mt-7 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#989a90]">
                  <span className="h-px w-7 bg-(--butter)" />A fresh page, every
                  time
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-[#20251f]/15 px-5 sm:px-8">
          <div className="mx-auto flex min-h-14 max-w-330 flex-wrap items-center justify-between gap-2 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#898c81]">
            <span>Made for the pleasure of a good meal</span>
            <span>Take your time · Taste as you go</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
