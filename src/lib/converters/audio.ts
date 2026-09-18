import { type ConvertOptions, type ConvertResult, FORMAT_META } from "./types";

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const samples = buffer.length;
  const dataSize = samples * channels * 2;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  const interleaved = new Int16Array(bytes, 44);
  const chans = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  let o = 0;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chans[c]![i] ?? 0));
      interleaved[o++] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

async function decodeAudio(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    const copy = await file.arrayBuffer();
    return await ctx.decodeAudioData(copy);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

async function encodeMp3(buffer: AudioBuffer, quality: number): Promise<Blob> {
  const lame = await import("@breezystack/lamejs");
  const Mp3Encoder = lame.Mp3Encoder ?? (lame as { default?: { Mp3Encoder: typeof lame.Mp3Encoder } }).default?.Mp3Encoder;
  if (!Mp3Encoder) throw new Error("MP3 encoder failed to load.");
  const kbps = Math.round(64 + quality * 128);
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps);
  const left = floatTo16(buffer.getChannelData(0));
  const right = floatTo16(buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)));
  const block = 1152;
  const parts: BlobPart[] = [];
  for (let i = 0; i < left.length; i += block) {
    const L = left.subarray(i, i + block);
    const R = right.subarray(i, i + block);
    const chunk = channels === 1 ? encoder.encodeBuffer(L) : encoder.encodeBuffer(L, R);
    if (chunk.length) {
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      parts.push(copy);
    }
  }
  const end = encoder.flush();
  if (end.length) {
    const copy = new Uint8Array(end.byteLength);
    copy.set(end);
    parts.push(copy);
  }
  return new Blob(parts, { type: "audio/mpeg" });
}

async function encodeRecorded(buffer: AudioBuffer, mime: string): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);
    const types = [mime, "audio/webm;codecs=opus", "audio/webm"].filter((type) => MediaRecorder.isTypeSupported(type));
    if (!types.length) throw new Error("This browser cannot record compressed audio.");
    const rec = new MediaRecorder(dest.stream, { mimeType: types[0] });
    const chunks: Blob[] = [];
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    const done = new Promise<void>((resolve, reject) => {
      rec.onstop = () => resolve();
      rec.onerror = () => reject(new Error("Audio recording failed."));
    });
    rec.start();
    src.start();
    await new Promise((resolve) => {
      src.onended = () => resolve(null);
      window.setTimeout(resolve, Math.ceil(buffer.duration * 1000) + 200);
    });
    if (rec.state !== "inactive") rec.stop();
    await done;
    return new Blob(chunks, { type: types[0] });
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export async function convertAudio(file: File, options: ConvertOptions): Promise<ConvertResult> {
  const buffer = await decodeAudio(file);
  if (options.format === "wav") {
    const blob = encodeWav(buffer);
    return { blob, ext: "wav", mime: "audio/wav", width: 0, height: 0 };
  }
  if (options.format === "mp3") {
    const blob = await encodeMp3(buffer, options.quality);
    return { blob, ext: "mp3", mime: "audio/mpeg", width: 0, height: 0 };
  }
  if (options.format === "ogg") {
    const blob = await encodeRecorded(buffer, "audio/ogg;codecs=opus");
    const ext = blob.type.includes("ogg") ? "ogg" : "webm";
    return { blob, ext, mime: blob.type, width: 0, height: 0 };
  }
  throw new Error(`Can't convert this audio to ${FORMAT_META[options.format].label}.`);
}
