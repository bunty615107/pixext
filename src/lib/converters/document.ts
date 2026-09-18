import { Document, Packer, Paragraph, TextRun } from "docx";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { marked } from "marked";
import TurndownService from "turndown";
import { textToPdf } from "./pdf";
import { type ConvertOptions, type ConvertResult, FORMAT_META } from "./types";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

function decodeText(bytes: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textToRtf(text: string): string {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  const body = escaped
    .split("\n")
    .map((line) => `${line}\\par`)
    .join("\n");
  return `{\\rtf1\\ansi\\deff0\\n${body}\n}`;
}

function xmlText(xml: string): string {
  return xml
    .replace(/<a:t[^>]*>/g, "")
    .replace(/<text:p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function officeText(file: File): Promise<string> {
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const chunks: string[] = [];
  for (const [name, data] of Object.entries(zip)) {
    if (!name.endsWith(".xml")) continue;
    if (
      name.includes("slide") ||
      name.endsWith("content.xml") ||
      name.includes("document.xml") ||
      name.includes("sharedStrings")
    ) {
      chunks.push(xmlText(new TextDecoder().decode(data)));
    }
  }
  return chunks.filter(Boolean).join("\n\n") || "No readable text found in this office file.";
}

async function toHtml(file: File, ext: string): Promise<string> {
  const buf = await file.arrayBuffer();
  if (ext === "html" || ext === "htm") return decodeText(buf);
  if (ext === "md" || ext === "markdown") {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title></head><body>${await marked.parse(decodeText(buf))}</body></html>`;
  }
  if (ext === "docx" || ext === "doc") {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ arrayBuffer: buf });
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title></head><body>${result.value}</body></html>`;
  }
  if (ext === "rtf") {
    const text = rtfToText(decodeText(buf));
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
  }
  if (ext === "odt" || ext === "pptx" || ext === "ppt" || ext === "epub") {
    const text = await officeText(file);
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
  }
  const text = decodeText(buf);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
}

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

async function textToDocx(text: string): Promise<Blob> {
  const paragraphs = text.split(/\n/).map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line || " ", font: "Calibri", size: 22 })],
      }),
  );
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return blob;
}

function makeEpub(title: string, html: string): Blob {
  const safe = title.replace(/[^\w\- ]+/g, "").trim() || "Document";
  const container = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  const opf = `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bid" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeHtml(safe)}</dc:title><dc:language>en</dc:language><dc:identifier id="bid">pixext-${Date.now()}</dc:identifier></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="ch1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="ch1"/></spine></package>`;
  const ncx = `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><docTitle><text>${escapeHtml(safe)}</text></docTitle><navMap><navPoint id="n1" playOrder="1"><navLabel><text>${escapeHtml(safe)}</text></navLabel><content src="chapter.xhtml"/></navPoint></navMap></ncx>`;
  const chapter = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeHtml(safe)}</title></head><body>${html.replace(/<!doctype html>[\s\S]*<body>/i, "").replace(/<\/body>[\s\S]*/i, "")}</body></html>`;
  const zipped = zipSync(
    {
      mimetype: [strToU8("application/epub+zip"), { level: 0 }],
      "META-INF/container.xml": strToU8(container),
      "OEBPS/content.opf": strToU8(opf),
      "OEBPS/toc.ncx": strToU8(ncx),
      "OEBPS/chapter.xhtml": strToU8(chapter),
    },
    { level: 6 },
  );
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy], { type: "application/epub+zip" });
}

export async function convertDocument(file: File, ext: string, options: ConvertOptions): Promise<ConvertResult> {
  const html = await toHtml(file, ext);
  const text = stripHtml(html);
  const format = options.format;

  if (format === "html") return result(new Blob([html], { type: "text/html" }), "html");
  if (format === "txt") return result(new Blob([text], { type: "text/plain" }), "txt");
  if (format === "md") return result(new Blob([htmlToMarkdown(html)], { type: "text/markdown" }), "md");
  if (format === "rtf") return result(new Blob([textToRtf(text)], { type: "application/rtf" }), "rtf");
  if (format === "docx") return result(await textToDocx(text), "docx");
  if (format === "pdf") return result(await textToPdf(file.name, text), "pdf");
  if (format === "epub") return result(makeEpub(file.name, html), "epub");

  throw new Error(`Can't convert this document to ${FORMAT_META[format].label}.`);
}

function result(blob: Blob, ext: string): ConvertResult {
  return { blob, ext, mime: blob.type || FORMAT_META[ext as keyof typeof FORMAT_META]?.mime || "application/octet-stream", width: 0, height: 0 };
}
