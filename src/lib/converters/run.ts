import { zipFiles } from "@/lib/zip";
import { convertArchive } from "./archive";
import { convertAudio } from "./audio";
import { convertData } from "./data";
import { convertDocument } from "./document";
import { convertImage, imagesToMergedPdf } from "./image";
import { convertPdf, mergePdfBlobs } from "./pdf";
import { convertSheet } from "./sheet";
import { convertUniversal } from "./universal";
import { convertVideo } from "./video";
import { detectFile } from "./detect";
import {
  type ConvertOptions,
  type ConvertResult,
  type FormatId,
  FORMAT_META,
  canConvert,
} from "./types";

export async function convertFile(file: File, options: ConvertOptions): Promise<ConvertResult> {
  const detected = detectFile(file);
  if (options.format === "base64" || options.format === "hex") {
    return convertUniversal(file, options.format);
  }
  if (options.format === "zip" && detected.kind !== "archive" && detected.kind !== "pdf") {
    return convertUniversal(file, "zip");
  }
  if (!canConvert(detected.kind, options.format)) {
    throw new Error(`Can't convert ${detected.ext.toUpperCase()} to ${FORMAT_META[options.format].label}.`);
  }

  switch (detected.kind) {
    case "image":
      return convertImage(file, options);
    case "pdf":
      return convertPdf(file, options);
    case "document":
      return convertDocument(file, detected.ext, options);
    case "sheet":
      return convertSheet(file, detected.ext, options);
    case "data":
      return convertData(file, detected.ext, options);
    case "audio":
      return convertAudio(file, options);
    case "video":
      return convertVideo(file, options);
    case "archive":
      return convertArchive(file, options);
    default:
      return convertUniversal(file, options.format === "zip" ? "zip" : options.format === "hex" ? "hex" : "base64");
  }
}

export async function detectFormatSupport(): Promise<Partial<Record<FormatId, boolean>>> {
  const checkCanvas = (type: string) =>
    new Promise<boolean>((resolve) => {
      const c = document.createElement("canvas");
      c.width = 2;
      c.height = 2;
      try {
        c.toBlob((b) => resolve(b != null && b.type === type), type, 0.8);
      } catch {
        resolve(false);
      }
    });
  const [webp, avif] = await Promise.all([checkCanvas("image/webp"), checkCanvas("image/avif")]);
  const ogg =
    typeof MediaRecorder !== "undefined" &&
    (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") || MediaRecorder.isTypeSupported("audio/ogg"));
  const webm =
    typeof MediaRecorder !== "undefined" &&
    (MediaRecorder.isTypeSupported("video/webm") || MediaRecorder.isTypeSupported("video/webm;codecs=vp9"));
  return {
    png: true,
    jpeg: true,
    webp,
    gif: true,
    bmp: true,
    ico: true,
    avif,
    svg: true,
    pdf: true,
    txt: true,
    md: true,
    html: true,
    docx: true,
    rtf: true,
    epub: true,
    csv: true,
    tsv: true,
    xlsx: true,
    json: true,
    yaml: true,
    xml: true,
    wav: true,
    mp3: true,
    ogg,
    webm,
    zip: true,
    base64: true,
    hex: true,
  };
}

export async function makeThumbnail(blob: Blob, edge = 96): Promise<string> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = edge / Math.max(bitmap.width, bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return "";
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

export async function mergeJobsToPdf(
  files: { blob: Blob; mime: string; name: string }[],
  options: ConvertOptions,
): Promise<Blob> {
  const pdfBlobs: Blob[] = [];
  const images: File[] = [];
  for (const item of files) {
    if (item.mime.includes("pdf") || item.name.endsWith(".pdf")) {
      pdfBlobs.push(item.blob);
    } else if (item.mime.startsWith("image/")) {
      images.push(new File([item.blob], item.name, { type: item.mime }));
    }
  }
  if (images.length) pdfBlobs.unshift(await imagesToMergedPdf(images, options));
  if (!pdfBlobs.length) throw new Error("Nothing to merge into a PDF.");
  if (pdfBlobs.length === 1) return pdfBlobs[0]!;
  return mergePdfBlobs(pdfBlobs);
}

export async function zipResults(files: { name: string; blob: Blob }[]): Promise<Blob> {
  return zipFiles(files);
}
