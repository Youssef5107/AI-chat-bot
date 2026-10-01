import decodeFlac from "@audio/decode-flac";
import decodeMp3 from "@audio/decode-mp3";
import decodeMp4 from "@audio/decode-mp4";
import decodeOpus from "@audio/decode-opus";
import decodeVorbis from "@audio/decode-vorbis";
import decodeWav from "@audio/decode-wav";
import decodeWebm from "@audio/decode-webm";
import { pipeline } from "@xenova/transformers";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const SAMPLE_RATE = 16_000;
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "application/mp4",
  "video/mp4",
]);
const SUPPORTED_EXTENSIONS = /\.(flac|m4a|mp3|mp4|mpeg|mpga|ogg|wav|webm)$/i;

export const runtime = "nodejs";
export const maxDuration = 300;

let transcriberPromise: ReturnType<typeof createTranscriber> | undefined;

function createTranscriber() {
  return pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
    quantized: true,
  });
}

async function decodeUploadedAudio(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "flac":
      return decodeFlac(bytes);
    case "m4a":
    case "mp4":
      return decodeMp4(bytes);
    case "mp3":
    case "mpeg":
    case "mpga":
      return decodeMp3(bytes);
    case "ogg":
      try {
        return await decodeVorbis(bytes);
      } catch {
        return decodeOpus(bytes);
      }
    case "wav":
      return decodeWav(bytes);
    case "webm":
      return decodeWebm(bytes);
    default:
      throw new Error("Unsupported audio format");
  }
}

function decodeMonoAtSampleRate(
  channels: Float32Array[],
  sourceSampleRate: number,
) {
  const frameCount = channels[0]?.length ?? 0;
  const mono = new Float32Array(frameCount);

  for (const channel of channels) {
    for (let frame = 0; frame < frameCount; frame++) {
      mono[frame] += channel[frame] / channels.length;
    }
  }

  if (sourceSampleRate === SAMPLE_RATE) return mono;

  const outputLength = Math.floor(
    (frameCount * SAMPLE_RATE) / sourceSampleRate,
  );
  const resampled = new Float32Array(outputLength);
  const ratio = sourceSampleRate / SAMPLE_RATE;

  for (let index = 0; index < outputLength; index++) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, frameCount - 1);
    const fraction = position - left;
    resampled[index] = mono[left] * (1 - fraction) + mono[right] * fraction;
  }

  return resampled;
}

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
    const decoded = await decodeUploadedAudio(file);
    const samples = decodeMonoAtSampleRate(
      decoded.channelData,
      decoded.sampleRate,
    );
    transcriberPromise ??= createTranscriber();
    const transcriber = await transcriberPromise;
    const result = await transcriber(samples, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const transcription = Array.isArray(result) ? result[0] : result;

    if (!transcription) {
      return Response.json(
        { error: "Whisper could not find speech in this audio." },
        { status: 422 },
      );
    }

    return Response.json(
      {
        text: transcription.text.trim(),
        durationInSeconds: samples.length / SAMPLE_RATE,
        segments:
          transcription.chunks?.map((chunk) => ({
            text: chunk.text,
            startSecond: chunk.timestamp[0],
            endSecond: chunk.timestamp[1],
          })) ?? [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Local audio transcription error:", error);
    return Response.json(
      {
        error:
          "Local Whisper could not process this audio. Check the format and available memory, then try again.",
      },
      { status: 500 },
    );
  }
}
