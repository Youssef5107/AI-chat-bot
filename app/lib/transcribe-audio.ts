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
      throw new Error(
        "Use an MP3, MP4, M4A, MPEG, MPGA, WAV, WebM, OGG, or FLAC file.",
      );
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

export async function transcribeAudioFile(file: File) {
  if (file.size === 0) throw new Error("Choose an audio file to transcribe.");
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Choose an audio file smaller than 25 MB.");
  }
  if (
    !SUPPORTED_EXTENSIONS.test(file.name) ||
    (file.type && !SUPPORTED_AUDIO_TYPES.has(file.type))
  ) {
    throw new Error(
      "Use an MP3, MP4, M4A, MPEG, MPGA, WAV, WebM, OGG, or FLAC file.",
    );
  }

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
    throw new Error("Whisper could not find speech in this audio.");
  }

  return {
    text: transcription.text.trim(),
    durationInSeconds: samples.length / SAMPLE_RATE,
    segments:
      transcription.chunks?.map((chunk) => ({
        text: chunk.text,
        startSecond: chunk.timestamp[0],
        endSecond: chunk.timestamp[1],
      })) ?? [],
  };
}
