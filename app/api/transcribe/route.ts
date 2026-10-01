import { openai } from "@ai-sdk/openai";
import { transcribe } from "ai";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
]);
const SUPPORTED_EXTENSIONS = /\.(flac|m4a|mp3|mp4|mpeg|mpga|ogg|wav|webm)$/i;

export const maxDuration = 120;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
    return Response.json(
      { error: "Choose an audio file smaller than 25 MB." },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "The audio upload could not be read." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { error: "Choose an audio file to transcribe." },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "Choose an audio file smaller than 25 MB." },
      { status: 413 },
    );
  }
  if (
    !SUPPORTED_EXTENSIONS.test(file.name) ||
    (file.type && !SUPPORTED_AUDIO_TYPES.has(file.type))
  ) {
    return Response.json(
      {
        error:
          "Use an MP3, MP4, M4A, MPEG, MPGA, WAV, WebM, OGG, or FLAC file.",
      },
      { status: 415 },
    );
  }

  try {
    const result = await transcribe({
      model: openai.transcription("whisper-1"),
      audio: new Uint8Array(await file.arrayBuffer()),
      abortSignal: AbortSignal.timeout(120_000),
    });

    return Response.json(
      {
        text: result.text,
        language: result.language,
        durationInSeconds: result.durationInSeconds,
        segments: result.segments,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Audio transcription error:", error);
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Transcription timed out. Please try again."
        : "Could not transcribe this audio. Check the server logs and OpenAI API key.";

    return Response.json({ error: message }, { status: 502 });
  }
}
