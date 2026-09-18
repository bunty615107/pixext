import * as XLSX from "xlsx";
import { textToPdf } from "./pdf";
import { type ConvertOptions, type ConvertResult, FORMAT_META } from "./types";

function readWorkbook(file: File, bytes: ArrayBuffer, ext: string): XLSX.WorkBook {
  if (ext === "csv" || ext === "tsv") {
    const text = new TextDecoder().decode(bytes);
    return XLSX.read(text, { type: "string", FS: ext === "tsv" ? "\t" : "," });
  }
  if (ext === "json") {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return wb;
  }
  return XLSX.read(bytes, { type: "array" });
}

function sheetToAoA(wb: XLSX.WorkBook): unknown[][] {
  const name = wb.SheetNames[0];
  if (!name) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name]!, { header: 1, raw: false }) as unknown[][];
}

export async function convertSheet(file: File, ext: string, options: ConvertOptions): Promise<ConvertResult> {
  const bytes = await file.arrayBuffer();
  const wb = readWorkbook(file, bytes, ext);
  const format = options.format;
  const sheetName = wb.SheetNames[0] ?? "Sheet1";
  const sheet = wb.Sheets[sheetName] ?? {};

  if (format === "xlsx") {
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return pack(new Blob([out], { type: FORMAT_META.xlsx.mime }), "xlsx");
  }
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return pack(new Blob([csv], { type: "text/csv" }), "csv");
  }
  if (format === "tsv") {
    const tsv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
    return pack(new Blob([tsv], { type: "text/tab-separated-values" }), "tsv");
  }
  if (format === "json") {
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return pack(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }), "json");
  }
  if (format === "html") {
    const html = XLSX.utils.sheet_to_html(sheet);
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${file.name}</title></head><body>${html}</body></html>`;
    return pack(new Blob([doc], { type: "text/html" }), "html");
  }
  if (format === "pdf") {
    const rows = sheetToAoA(wb)
      .slice(0, 80)
      .map((row) => row.map((cell) => String(cell ?? "")).join(" | "))
      .join("\n");
    return pack(await textToPdf(file.name, rows || "Empty sheet"), "pdf");
  }
  throw new Error(`Can't convert this table to ${FORMAT_META[format].label}.`);
}

function pack(blob: Blob, ext: string): ConvertResult {
  return { blob, ext, mime: blob.type, width: 0, height: 0 };
}
