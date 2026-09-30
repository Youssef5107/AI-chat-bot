"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useState } from "react";
import ChatNavigation from "../components/chat-navigation";

type GeneratedImage = {
  id: string;
  imageUrl: string;
  prompt: string;
};

const aspectRatios = [
  { label: "Square", width: 512, height: 512 },
  { label: "Portrait", width: 512, height: 768 },
  { label: "Landscape", width: 768, height: 512 },
] as const;

const imageTransport = new TextStreamChatTransport({
  api: "/api/images",
  prepareSendMessagesRequest: ({ messages, body }) => {
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    return {
      body: { ...body, messages: latestUserMessage ? [latestUserMessage] : [] },
    };
  },
});

function isGeneratedImage(value: unknown): value is Omit<GeneratedImage, "id"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "imageUrl" in value &&
    typeof value.imageUrl === "string" &&
    value.imageUrl.startsWith("data:image/") &&
    "prompt" in value &&
    typeof value.prompt === "string"
  );
}

function getReadableError(error: Error | undefined) {
  if (!error) return null;

  try {
    const payload: unknown = JSON.parse(error.message);
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    return error.message;
  }

  return error.message;
}

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState(0);
  const [steps, setSteps] = useState(24);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [resultError, setResultError] = useState<string | null>(null);
  const { sendMessage, status, error, clearError } = useChat({
    transport: imageTransport,
    onFinish: ({ message, isError }) => {
      if (isError) return;

      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");

      try {
        const result: unknown = JSON.parse(text);
        if (!isGeneratedImage(result)) {
          throw new Error(
            "Stable Diffusion returned an unexpected image result.",
          );
        }
        setImages((current) => [{ ...result, id: message.id }, ...current]);
      } catch (caughtError) {
        setResultError(
          caughtError instanceof Error
            ? caughtError.message
            : "The generated image could not be read.",
        );
      }
    },
  });

  const isGenerating = status === "submitted" || status === "streaming";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isGenerating) return;

    setResultError(null);
    clearError();
    const dimensions = aspectRatios[aspectRatio];
    try {
      await sendMessage(
        { text: nextPrompt },
        {
          body: {
            negativePrompt,
            width: dimensions.width,
            height: dimensions.height,
            steps,
          },
        },
      );
      setPrompt("");
    } catch (caughtError) {
      setResultError(
        caughtError instanceof Error
          ? caughtError.message
          : "Image generation failed. Please try again.",
      );
    }
  }

  return (
    <div className="min-h-screen bg-(--paper) text-(--ink)">
      <ChatNavigation active="images" />
      <main className="page-enter min-h-screen md:pl-57">
        <header className="border-b border-[#20251f]/15 px-5 sm:px-8">
          <div className="mx-auto flex min-h-20 max-w-330 items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-(--tomato)">
                03 / Image generation
              </p>
              <h1 className="mt-1 font-serif text-2xl leading-none sm:text-3xl">
                Image studio
              </h1>
            </div>
            <span className="flex shrink-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#767b70]">
              <span
                className={`size-1.5 rounded-full ${isGenerating ? "animate-pulse bg-(--tomato)" : "bg-(--leaf)"}`}
              />
              {isGenerating ? "Generating" : "Stable Diffusion"}
            </span>
          </div>
        </header>

        <div className="mx-auto grid max-w-330 gap-10 px-5 py-8 sm:px-8 sm:py-12 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] xl:gap-14">
          <section className="rise-in min-w-0 xl:sticky xl:top-10 xl:self-start">
            <p className="mb-4 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-(--tomato)">
              <span className="h-px w-7 bg-(--tomato)" />
              Describe what you see
            </p>
            <h2 className="max-w-lg font-serif text-4xl leading-[0.98] sm:text-[46px]">
              Give an idea
              <br />
              <em className="text-(--leaf)">a little shape.</em>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#686c62]">
              Write a scene, a subject, or a feeling. Stable Diffusion will turn
              your words into an image.
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
              <label
                htmlFor="image-prompt"
                className="mb-2 block font-mono text-[9px] uppercase tracking-[0.15em] text-[#73786d]"
              >
                Prompt
              </label>
              <textarea
                id="image-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="A greenhouse at dawn, dew on glass, warm sunlight through leaves..."
                maxLength={2000}
                rows={5}
                required
                className="composer-focus w-full resize-y border border-[#20251f]/20 bg-[#fffdf7] p-4 text-sm leading-6 text-[#42483f] outline-none placeholder:text-[#9a9b91]"
              />
              <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-widest text-[#999b91]">
                <span>Be descriptive</span>
                <span>{prompt.length}/2000</span>
              </div>

              <div className="mt-6">
                <label
                  htmlFor="aspect-ratio"
                  className="mb-2 block font-mono text-[9px] uppercase tracking-[0.15em] text-[#73786d]"
                >
                  Composition
                </label>
                <select
                  id="aspect-ratio"
                  value={aspectRatio}
                  onChange={(event) =>
                    setAspectRatio(Number(event.target.value))
                  }
                  className="w-full border border-[#20251f]/20 bg-[#fffdf7] px-3 py-3 text-sm text-[#42483f] outline-none focus:border-(--leaf)"
                >
                  {aspectRatios.map((ratio, index) => (
                    <option key={ratio.label} value={index}>
                      {ratio.label} · {ratio.width} × {ratio.height}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="steps"
                    className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#73786d]"
                  >
                    Sampling steps
                  </label>
                  <span className="font-mono text-xs tabular-nums text-(--leaf)">
                    {steps}
                  </span>
                </div>
                <input
                  id="steps"
                  type="range"
                  min="10"
                  max="40"
                  step="1"
                  value={steps}
                  onChange={(event) => setSteps(Number(event.target.value))}
                  className="w-full accent-(--leaf)"
                />
                <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-widest text-[#999b91]">
                  <span>Faster</span>
                  <span>More detail</span>
                </div>
              </div>

              <details className="group mt-5 border-t border-[#20251f]/10 pt-4">
                <summary className="cursor-pointer list-none font-mono text-[9px] uppercase tracking-[0.15em] text-[#73786d] marker:hidden">
                  <span className="mr-2 text-(--tomato)">＋</span>
                  Negative prompt
                </summary>
                <textarea
                  aria-label="Negative prompt"
                  value={negativePrompt}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  placeholder="Things to avoid in the image"
                  maxLength={1000}
                  rows={3}
                  className="mt-3 w-full resize-y border border-[#20251f]/20 bg-[#fffdf7] p-3 text-sm leading-6 text-[#42483f] outline-none focus:border-(--leaf) placeholder:text-[#9a9b91]"
                />
              </details>

              <button
                type="submit"
                disabled={!prompt.trim() || isGenerating}
                className="mt-6 flex min-h-12 w-full items-center justify-between bg-(--tomato) px-4 text-left font-mono text-[10px] uppercase tracking-[0.13em] text-white transition-colors hover:bg-[#a8402e] disabled:cursor-not-allowed disabled:bg-[#c8c4b8]"
              >
                <span>
                  {isGenerating ? "Creating your image" : "Generate image"}
                </span>
                <span aria-hidden="true">{isGenerating ? "···" : "↗"}</span>
              </button>
            </form>

            {(error || resultError) && (
              <div
                role="alert"
                className="mt-5 border-l-2 border-(--tomato) bg-[#f0e2d7] px-4 py-3 text-sm leading-6 text-[#75392d]"
              >
                <p>{resultError || getReadableError(error)}</p>
                {error && (
                  <button
                    type="button"
                    onClick={clearError}
                    className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] underline underline-offset-4"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}

            <p className="mt-6 border-t border-[#20251f]/15 pt-4 font-mono text-[9px] uppercase leading-5 tracking-widest text-[#898c81]">
              Local inference · No per-image API fee
            </p>
          </section>

          <section
            aria-label="Generated images"
            aria-live="polite"
            className="min-w-0 border-t border-[#20251f]/15 pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0"
          >
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl italic text-(--leaf)">
                Your canvas
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#92948a]">
                {images.length
                  ? `${images.length} created`
                  : "Ready when you are"}
              </span>
            </div>

            {isGenerating && (
              <div className="mb-5 grid min-h-72 place-items-center border border-[#20251f]/10 bg-[#e8e9de] px-6 py-10 text-center">
                <div>
                  <span className="mb-4 inline-grid size-11 place-items-center border border-(--leaf)/30 text-(--leaf)">
                    <span className="animate-spin font-serif text-2xl">✳</span>
                  </span>
                  <p className="font-serif text-2xl italic">
                    Finding the image...
                  </p>
                  <p className="mt-2 text-sm text-[#85877d]">
                    This can take a little while on local hardware.
                  </p>
                </div>
              </div>
            )}

            {images.length > 0 ? (
              <div className="space-y-6">
                {images.map((image) => (
                  <article
                    key={image.id}
                    className="overflow-hidden border border-[#20251f]/10 bg-[#fffdf7]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.imageUrl}
                      alt={image.prompt}
                      className="max-h-[70vh] w-full bg-[#e8e9de] object-contain"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#20251f]/10 px-4 py-3 sm:px-5">
                      <p className="min-w-0 flex-1 text-xs leading-5 text-[#696d63]">
                        {image.prompt}
                      </p>
                      <a
                        href={image.imageUrl}
                        download="relay-generated-image.png"
                        className="shrink-0 border border-[#20251f]/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#62685d] transition hover:border-(--leaf) hover:text-(--leaf)"
                      >
                        Download ↓
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : !isGenerating ? (
              <div className="flex min-h-72 flex-col justify-center border border-[#20251f]/10 bg-[#e8e9de] px-6 py-9 sm:px-9">
                <span className="mb-4 font-serif text-4xl italic text-(--leaf)">
                  Nothing here yet.
                </span>
                <p className="max-w-md text-sm leading-6 text-[#73776d]">
                  Your first generated image will appear here. Results stay in
                  this page while it is open.
                </p>
                <div className="mt-7 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[#898c81]">
                  <span className="h-px w-7 bg-(--tomato)" />
                  Describe it on the left
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
