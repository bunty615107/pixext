import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { zipFiles } from "@/lib/zip";
import { encodeCanvas, fillCanvas, targetSize } from "./canvas";
import { type ConvertOptions, type ConvertResult, FORMAT_META } from "./types";

type Pdfjs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<Pdfjs> | null = null;

async function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

async function openPdf(file: File) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

export async function convertPdf(file: File, options: ConvertOptions): Promise<ConvertResult> {
  if (options.format === "pdf") {
    return {
      blob: file,
      ext: "pdf",
      mime: "application/pdf",
      width: 0,
      height: 0,
      note: "Copied original PDF",
    };
  }

  const doc = await openPdf(file);

  if (options.format === "txt" || options.format === "html") {
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      parts.push(text);
    }
    const body = parts.join("\n\n");
    if (options.format === "html") {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title></head><body>${parts
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("\n")}</body></html>`;
      return blobResult(html, "html", "text/html");
    }
    return blobResult(body, "txt", "text/plain");
  }

  const imageFormat =
    options.format === "jpeg" || options.format === "webp" || options.format === "gif" || options.format === "png"
      ? options.format
      : options.format === "zip"
        ? "png"
        : null;
  if (!imageFormat) {
    throw new Error(`Can't convert PDF to ${FORMAT_META[options.format].label}.`);
  }

  const blobs: { name: string; blob: Blob }[] = [];
  let lastW = 0;
  let lastH = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const sized = targetSize(Math.round(base.width), Math.round(base.height), options.maxEdge || 1600);
    const scale = sized.width / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    fillCanvas(ctx, canvas.width, canvas.height, options.flatten, true);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob = await encodeCanvas(canvas, imageFormat, options.quality);
    lastW = canvas.width;
    lastH = canvas.height;
    blobs.push({ name: `page-${String(i).padStart(2, "0")}.${FORMAT_META[imageFormat].ext}`, blob });
  }

  if (blobs.length === 1 && options.format !== "zip") {
    const only = blobs[0]!;
    return {
      blob: only.blob,
      ext: FORMAT_META[imageFormat].ext,
      mime: only.blob.type,
      width: lastW,
      height: lastH,
    };
  }

  const zip = await zipFiles(blobs);
  return {
    blob: zip,
    ext: "zip",
    mime: "application/zip",
    width: lastW,
    height: lastH,
    note: `${blobs.length} pages`,
  };
}

export async function textToPdf(title: string, text: string): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const fontSize = 11;
  const titleSize = 16;
  const lineH = 16;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;

  const wrap = (value: string, size: number, face: typeof font) => {
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (face.widthOfTextAtSize(next, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const drawLine = (line: string, size: number, face: typeof font) => {
    if (y < margin + lineH) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, { x: margin, y, size, font: face, color: rgb(0.08, 0.08, 0.08) });
    y -= lineH;
  };

  for (const line of wrap(title.replace(/\.[^.]+$/, "") || "Document", titleSize, bold)) {
    drawLine(line, titleSize, bold);
  }
  y -= 8;
  for (const para of text.split(/\n/)) {
    if (!para.trim()) {
      y -= lineH / 2;
      continue;
    }
    for (const line of wrap(para, fontSize, font)) drawLine(line, fontSize, font);
  }

  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}

export async function mergePdfBlobs(blobs: Blob[]): Promise<Blob> {
  const merged = await PDFDocument.create();
  for (const blob of blobs) {
    const src = await PDFDocument.load(await blob.arrayBuffer());
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  const bytes = await merged.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

function blobResult(text: string, ext: string, mime: string): ConvertResult {
  return { blob: new Blob([text], { type: mime }), ext, mime, width: 0, height: 0 };
}
