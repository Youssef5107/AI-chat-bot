"use client";

import { useEffect, useState } from "react";
import ChatNavigation from "../components/chat-navigation";

type Transcript = {
  text: string;
  language?: string;
  durationInSeconds?: number;
  segments: Array<{
    text: string;
    startSecond: number;
    endSecond: number;
  }>;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_AUDIO = ".flac,.m4a,.mp3,.mp4,.mpeg,.mpga,.ogg,.wav,.webm";
const SUPPORTED_AUDIO_EXTENSION =
  /\.(flac|m4a|mp3|mp4|mpeg|mpga|ogg|wav|webm)$/i;

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | undefined) {
  if (seconds === undefined) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function TranscriptionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progressMessage, setProgressMessage] = useState(
    "Preparing local Whisper model",
  );

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setError(null);
    setTranscript(null);
    setCopied(false);

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setPreviewUrl(null);
      setError("Choose an audio file smaller than 25 MB.");
      return;
    }
    if (!SUPPORTED_AUDIO_EXTENSION.test(nextFile.name)) {
      setFile(null);
      setPreviewUrl(null);
      setError(
        "Choose an MP3, MP4, M4A, MPEG, MPGA, WAV, WebM, OGG, or FLAC file.",
      );
      return;
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isTranscribing) return;

    setError(null);
    setTranscript(null);
    setIsTranscribing(true);
    setProgressMessage("Loading the local model and transcribing");
    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Could not transcribe this audio. Please try again.";
        throw new Error(message);
      }

      if (
        typeof result !== "object" ||
        result === null ||
        !("text" in result) ||
        typeof result.text !== "string"
      ) {
        throw new Error("The transcription response could not be read.");
      }

      setTranscript(result as Transcript);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Local transcription failed. Try another audio file or browser.",
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  async function copyTranscript() {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript.text);
    setCopied(true);
  }

  function downloadTranscript() {
    if (!transcript) return;
    const url = URL.createObjectURL(
      new Blob([transcript.text], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${file?.name.replace(/\.[^.]+$/, "") || "transcript"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-(--paper) text-(--ink)">
      <ChatNavigation active="transcription" />
      <main className="page-enter min-h-screen md:pl-57">
        <header className="border-b border-[#20251f]/15 px-5 sm:px-8">
          <div className="mx-auto flex min-h-20 max-w-330 items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-(--tomato)">
                04 / Audio transcription
              </p>
              <h1 className="mt-1 font-serif text-2xl leading-none sm:text-3xl">
                Voice to text
              </h1>
            </div>
            <span className="flex shrink-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#767b70]">
              <span
                className={`size-1.5 rounded-full ${isTranscribing ? "animate-pulse bg-(--tomato)" : "bg-(--leaf)"}`}
              />
              {isTranscribing ? "Working locally" : "Local Whisper"}
            </span>
          </div>
        </header>

        <div className="mx-auto grid max-w-330 gap-10 px-5 py-8 sm:px-8 sm:py-12 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] xl:gap-14">
          <section className="rise-in min-w-0 xl:sticky xl:top-10 xl:self-start">
            <p className="mb-4 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-(--tomato)">
              <span className="h-px w-7 bg-(--tomato)" />
              Start with a recording
            </p>
            <h2 className="max-w-lg font-serif text-4xl leading-[0.98] sm:text-[46px]">
              Let every
              <br />
              <em className="text-(--leaf)">word land.</em>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#686c62]">
              Add an audio file and Whisper will turn the spoken words into an
              editable transcript.
            </p>

            <form onSubmit={handleSubmit} className="mt-8">
              <label
                htmlFor="audio-file"
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  selectFile(event.dataTransfer.files[0]);
                }}
                className={`flex min-h-44 cursor-pointer flex-col items-center justify-center border border-dashed px-5 py-7 text-center transition-colors ${isDragging ? "border-(--leaf) bg-[#e2e7dc]" : "border-[#20251f]/25 bg-[#fffdf7] hover:border-(--leaf)"}`}
              >
                <input
                  id="audio-file"
                  type="file"
                  accept={ACCEPTED_AUDIO}
                  className="sr-only"
                  onChange={(event) => selectFile(event.target.files?.[0])}
                />
                <span
                  className="mb-3 grid size-10 place-items-center border border-(--leaf)/30 font-serif text-xl text-(--leaf)"
                  aria-hidden="true"
                >
                  ♪
                </span>
                <span className="font-serif text-lg">
                  {file ? file.name : "Drop an audio file here"}
                </span>
                <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#85897e]">
                  {file
                    ? `${formatFileSize(file.size)} · Change file`
                    : "or click to browse · up to 25 MB"}
                </span>
              </label>

              {previewUrl && (
                <div className="mt-4 border border-[#20251f]/15 bg-[#fffdf7] p-3">
                  <audio
                    className="w-full"
                    controls
                    src={previewUrl}
                    aria-label="Audio preview"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={!file || isTranscribing}
                className="mt-5 flex min-h-12 w-full items-center justify-between bg-(--tomato) px-4 text-left font-mono text-[10px] uppercase tracking-[0.13em] text-white transition-colors hover:bg-[#a8402e] disabled:cursor-not-allowed disabled:bg-[#c8c4b8]"
              >
                <span>
                  {isTranscribing ? "Transcribing audio" : "Transcribe audio"}
                </span>
                <span aria-hidden="true">{isTranscribing ? "···" : "↗"}</span>
              </button>
            </form>

            {error && (
              <p
                role="alert"
                className="mt-5 border-l-2 border-(--tomato) bg-[#f0e2d7] px-4 py-3 text-sm leading-6 text-[#75392d]"
              >
                {error}
              </p>
            )}

            <p className="mt-6 border-t border-[#20251f]/15 pt-4 font-mono text-[9px] uppercase leading-5 tracking-widest text-[#898c81]">
              Audio is processed by the local app. Model downloads on first use.
            </p>
          </section>

          <section
            aria-label="Transcript"
            aria-live="polite"
            className="min-w-0 border-t border-[#20251f]/15 pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0"
          >
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl italic text-(--leaf)">
                Transcript
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#92948a]">
                {transcript ? "Ready to use" : "Waiting for audio"}
              </span>
            </div>

            {isTranscribing ? (
              <div className="grid min-h-72 place-items-center border border-[#20251f]/10 bg-[#e8e9de] px-6 py-10 text-center">
                <div>
                  <span className="mb-4 inline-grid size-11 place-items-center border border-(--leaf)/30 text-(--leaf)">
                    <span className="animate-pulse font-serif text-2xl">
                      ···
                    </span>
                  </span>
                  <p className="font-serif text-2xl italic">
                    {progressMessage}
                  </p>
                  <p className="mt-2 text-sm text-[#85877d]">
                    Longer recordings can take a little while.
                  </p>
                </div>
              </div>
            ) : transcript ? (
              <article className="border border-[#20251f]/15 bg-[#fffdf7]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#20251f]/10 px-4 py-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-widest text-[#85897e]">
                    {transcript.language && (
                      <span>
                        Language · {transcript.language.toUpperCase()}
                      </span>
                    )}
                    {formatDuration(transcript.durationInSeconds) && (
                      <span>
                        Length · {formatDuration(transcript.durationInSeconds)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 font-mono text-[9px] uppercase tracking-widest">
                    <button
                      type="button"
                      onClick={copyTranscript}
                      className="text-(--leaf) underline underline-offset-4 hover:text-(--tomato)"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={downloadTranscript}
                      className="text-(--leaf) underline underline-offset-4 hover:text-(--tomato)"
                    >
                      Download .txt
                    </button>
                  </div>
                </div>
                <textarea
                  aria-label="Editable transcript"
                  value={transcript.text}
                  onChange={(event) =>
                    setTranscript({ ...transcript, text: event.target.value })
                  }
                  className="min-h-80 w-full resize-y bg-transparent px-5 py-5 text-sm leading-7 text-[#42483f] outline-none"
                />
              </article>
            ) : (
              <div className="grid min-h-72 place-items-center border border-dashed border-[#20251f]/15 px-6 py-10 text-center">
                <div>
                  <p className="font-serif text-2xl italic text-[#73786d]">
                    Your words will appear here.
                  </p>
                  <p className="mt-2 text-sm text-[#92948a]">
                    Choose a file to begin.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
