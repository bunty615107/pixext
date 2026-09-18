import { encodeCanvas, fillCanvas, targetSize } from "./canvas";
import { convertAudio } from "./audio";
import { type ConvertOptions, type ConvertResult, FORMAT_META } from "./types";

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const timer = window.setTimeout(() => reject(new Error("Video timed out.")), 8000);
    video.onloadeddata = () => {
      window.clearTimeout(timer);
      resolve(video);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("This video could not be opened."));
    };
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeek = () => {
      video.removeEventListener("seeked", onSeek);
      resolve();
    };
    video.addEventListener("seeked", onSeek);
    video.currentTime = Math.min(Math.max(time, 0), Math.max(0, video.duration || 0));
  });
}

function drawFrame(video: HTMLVideoElement, maxEdge: number, flatten: ConvertOptions["flatten"], opaque: boolean) {
  const size = targetSize(video.videoWidth || 640, video.videoHeight || 360, maxEdge || 720);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  fillCanvas(ctx, size.width, size.height, flatten, opaque);
  ctx.drawImage(video, 0, 0, size.width, size.height);
  return canvas;
}

async function videoToGif(video: HTMLVideoElement, options: ConvertOptions): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const duration = Number.isFinite(video.duration) ? Math.min(video.duration, 4) : 2;
  const frames = 16;
  const gif = GIFEncoder();
  let palette: number[][] | null = null;
  for (let i = 0; i < frames; i++) {
    await seek(video, (duration * i) / frames);
    const canvas = drawFrame(video, options.maxEdge || 480, options.flatten, true);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!palette) palette = quantize(image.data, 256);
    const index = applyPalette(image.data, palette);
    gif.writeFrame(index, canvas.width, canvas.height, {
      palette: i === 0 ? palette : undefined,
      delay: Math.round((duration * 100) / frames),
      repeat: 0,
    });
  }
  gif.finish();
  const bytes = gif.bytes();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "image/gif" });
}

async function videoToWebm(video: HTMLVideoElement): Promise<Blob> {
  if (typeof video.captureStream !== "function") {
    throw new Error("This browser cannot re-encode video.");
  }
  await video.play();
  const stream = video.captureStream();
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";
  if (!mime) throw new Error("WebM recording is not supported here.");
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (ev) => {
    if (ev.data.size) chunks.push(ev.data);
  };
  const done = new Promise<void>((resolve, reject) => {
    rec.onstop = () => resolve();
    rec.onerror = () => reject(new Error("Video recording failed."));
  });
  rec.start();
  await new Promise((resolve) => {
    video.onended = () => resolve(null);
    window.setTimeout(resolve, Math.min(15000, Math.ceil((video.duration || 3) * 1000) + 400));
  });
  video.pause();
  if (rec.state !== "inactive") rec.stop();
  await done;
  return new Blob(chunks, { type: "video/webm" });
}

export async function convertVideo(file: File, options: ConvertOptions): Promise<ConvertResult> {
  if (options.format === "wav" || options.format === "mp3" || options.format === "ogg") {
    return convertAudio(file, options);
  }

  const url = URL.createObjectURL(file);
  try {
    const video = await loadVideo(url);
    if (options.format === "gif") {
      const blob = await videoToGif(video, options);
      return { blob, ext: "gif", mime: "image/gif", width: video.videoWidth, height: video.videoHeight };
    }
    if (options.format === "png" || options.format === "jpeg" || options.format === "webp") {
      await seek(video, Math.min(0.1, video.duration || 0));
      const canvas = drawFrame(
        video,
        options.maxEdge,
        options.flatten,
        options.format === "jpeg",
      );
      const blob = await encodeCanvas(canvas, options.format, options.quality);
      return { blob, ext: FORMAT_META[options.format].ext, mime: blob.type, width: canvas.width, height: canvas.height };
    }
    if (options.format === "webm") {
      const blob = await videoToWebm(video);
      return { blob, ext: "webm", mime: blob.type || "video/webm", width: video.videoWidth, height: video.videoHeight };
    }
    throw new Error(`Can't convert this video to ${FORMAT_META[options.format].label}.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
