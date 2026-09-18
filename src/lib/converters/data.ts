import { XMLBuilder, XMLParser } from "fast-xml-parser";
import YAML from "js-yaml";
import { type ConvertOptions, type ConvertResult, FORMAT_META } from "./types";

function parseUnknown(text: string, ext: string): unknown {
  if (ext === "json") return JSON.parse(text);
  if (ext === "yaml" || ext === "yml") return YAML.load(text);
  if (ext === "xml") {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    return parser.parse(text);
  }
  if (ext === "csv") {
    const lines = text.trim().split(/\r?\n/);
    const headers = (lines.shift() ?? "").split(",").map((h) => h.trim());
    return lines.filter(Boolean).map((line) => {
      const cols = line.split(",");
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h || `col${i + 1}`] = (cols[i] ?? "").trim();
      });
      return row;
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function toXml(data: unknown): string {
  const builder = new XMLBuilder({ ignoreAttributes: false, format: true, suppressEmptyNode: true });
  const wrapped = data && typeof data === "object" && !Array.isArray(data) ? data : { item: data };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(wrapped)}`;
}

function toCsv(data: unknown): string {
  const rows = Array.isArray(data) ? data : [data];
  if (!rows.length) return "";
  const objects = rows.map((row) =>
    row && typeof row === "object" ? (row as Record<string, unknown>) : { value: row },
  );
  const headers = [...new Set(objects.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...objects.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

function toHtml(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><pre>${json
    .replace(/&/g, "&")
    .replace(/</g, "<")}</pre></body></html>`;
}

export async function convertData(file: File, ext: string, options: ConvertOptions): Promise<ConvertResult> {
  const text = await file.text();
  const data = parseUnknown(text, ext);
  const format = options.format;
  if (format === "json") return pack(JSON.stringify(data, null, 2), "json", "application/json");
  if (format === "yaml") return pack(YAML.dump(data), "yaml", "text/yaml");
  if (format === "xml") return pack(toXml(data), "xml", "application/xml");
  if (format === "csv") return pack(toCsv(data), "csv", "text/csv");
  if (format === "txt") return pack(typeof data === "string" ? data : JSON.stringify(data, null, 2), "txt", "text/plain");
  if (format === "html") return pack(toHtml(data), "html", "text/html");
  throw new Error(`Can't convert this data file to ${FORMAT_META[format].label}.`);
}

function pack(text: string, ext: string, mime: string): ConvertResult {
  return { blob: new Blob([text], { type: mime }), ext, mime, width: 0, height: 0 };
}
