import { type FlattenMode } from "./types";

export const MAX_CANVAS = 8192;

export function targetSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  let w = width;
  let h = height;
  const longest = Math.max(w, h);
  if (maxEdge > 0 && longest > maxEdge) {
    const scale = maxEdge / longest;
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  if (Math.max(w, h) > MAX_CANVAS) {
    const scale = MAX_CANVAS / Math.max(w, h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  return { width: w, height: h };
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error(`Could not encode ${mime}. This browser may not support it.`));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

export function fillCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, flatten: FlattenMode, opaque: boolean) {
  if (opaque) {
    ctx.fillStyle = flatten === "black" ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
}

export async function rasterizeBlob(
  blob: Blob,
  width: number,
  height: number,
  flatten: FlattenMode,
  opaque: boolean,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: !opaque });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  fillCanvas(ctx, width, height, flatten, opaque);
  try {
    const bitmap = await createImageBitmap(blob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      ctx.drawImage(img, 0, 0, width, height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return canvas;
}

export function canvasToBmp(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  const image = ctx.getImageData(0, 0, w, h);
  const pixelBytes = w * h * 4;
  const header = 54;
  const fileSize = header + pixelBytes;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, header, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, -h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 32, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  const src = image.data;
  let o = header;
  for (let i = 0; i < src.length; i += 4) {
    bytes[o++] = src[i + 2]!;
    bytes[o++] = src[i + 1]!;
    bytes[o++] = src[i]!;
    bytes[o++] = src[i + 3]!;
  }
  return new Blob([buffer], { type: "image/bmp" });
}

export async function canvasToIco(source: HTMLCanvasElement): Promise<Blob> {
  const edge = Math.min(256, Math.max(source.width, source.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.clearRect(0, 0, edge, edge);
  const scale = Math.min(edge / source.width, edge / source.height);
  const dw = Math.max(1, Math.round(source.width * scale));
  const dh = Math.max(1, Math.round(source.height * scale));
  ctx.drawImage(source, Math.round((edge - dw) / 2), Math.round((edge - dh) / 2), dw, dh);
  const png = await canvasToBlob(canvas, "image/png");
  const pngBytes = new Uint8Array(await png.arrayBuffer());
  const header = 6 + 16;
  const buffer = new ArrayBuffer(header + pngBytes.length);
  const view = new DataView(buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  view.setUint8(6, edge >= 256 ? 0 : edge);
  view.setUint8(7, edge >= 256 ? 0 : edge);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, header, true);
  new Uint8Array(buffer, header).set(pngBytes);
  return new Blob([buffer], { type: "image/x-icon" });
}

export async function canvasToGif(canvas: HTMLCanvasElement, delay = 100): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const palette = quantize(image.data, 256);
  const index = applyPalette(image.data, palette);
  const gif = GIFEncoder();
  gif.writeFrame(index, canvas.width, canvas.height, { palette, delay, repeat: 0 });
  gif.finish();
  const bytes = gif.bytes();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "image/gif" });
}

export function canvasToSvg(canvas: HTMLCanvasElement): Blob {
  const data = canvas.toDataURL("image/png");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${data}" width="${canvas.width}" height="${canvas.height}"/></svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob> {
  if (format === "bmp") return canvasToBmp(canvas);
  if (format === "ico") return canvasToIco(canvas);
  if (format === "gif") return canvasToGif(canvas);
  if (format === "svg") return canvasToSvg(canvas);
  const mime =
    format === "jpeg"
      ? "image/jpeg"
      : format === "webp"
        ? "image/webp"
        : format === "avif"
          ? "image/avif"
          : "image/png";
  const lossy = format === "jpeg" || format === "webp" || format === "avif";
  return canvasToBlob(canvas, mime, lossy ? quality : undefined);
}
