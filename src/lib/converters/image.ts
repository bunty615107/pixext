import { PDFDocument } from "pdf-lib";
import { encodeCanvas, rasterizeBlob, targetSize } from "./canvas";
import { type ConvertOptions, type ConvertResult, FORMAT_META } from "./types";

const IMAGE_OUT = new Set(["png", "jpeg", "webp", "gif", "bmp", "ico", "avif", "svg"]);

export async function convertImage(file: File, options: ConvertOptions): Promise<ConvertResult> {
  const url = URL.createObjectURL(file);
  let width = 0;
  let height = 0;
  try {
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch {
      const img = new Image();
      img.src = url;
      await img.decode();
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  if (!width || !height) throw new Error("Could not read this image.");

  const size = targetSize(width, height, options.maxEdge);
  const opaque = options.format === "jpeg" || options.format === "bmp" || options.format === "pdf";
  const canvas = await rasterizeBlob(file, size.width, size.height, options.flatten, opaque);

  if (options.format === "pdf") {
    const png = await encodeCanvas(canvas, "png", 1);
    const pdf = await PDFDocument.create();
    const embedded = await pdf.embedPng(await png.arrayBuffer());
    const page = pdf.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    const bytes = await pdf.save();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return {
      blob: new Blob([copy], { type: "application/pdf" }),
      ext: "pdf",
      mime: "application/pdf",
      width: size.width,
      height: size.height,
    };
  }

  if (!IMAGE_OUT.has(options.format)) {
    throw new Error(`Can't convert this image to ${FORMAT_META[options.format].label}.`);
  }

  const blob = await encodeCanvas(canvas, options.format, options.quality);
  const meta = FORMAT_META[options.format];
  const outW = options.format === "ico" ? Math.min(256, Math.max(size.width, size.height)) : size.width;
  const outH = options.format === "ico" ? outW : size.height;
  return { blob, ext: meta.ext, mime: blob.type || meta.mime, width: outW, height: outH };
}

export async function imagesToMergedPdf(files: File[], options: ConvertOptions): Promise<Blob> {
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const result = await convertImage(file, { ...options, format: "png" });
    const embedded = await pdf.embedPng(await result.blob.arrayBuffer());
    const page = pdf.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}
