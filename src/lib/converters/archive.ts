import { unzipSync } from "fflate";
import { zipFiles } from "@/lib/zip";
import { convertImage } from "./image";
import { convertDocument } from "./document";
import { convertSheet } from "./sheet";
import { convertData } from "./data";
import { convertPdf } from "./pdf";
import { detectFile } from "./detect";
import { type ConvertOptions, type ConvertResult, canConvert } from "./types";
import { convertUniversal } from "./universal";

export async function convertArchive(file: File, options: ConvertOptions): Promise<ConvertResult> {
  const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const entries = Object.entries(unzipped).filter(
    ([name, data]) => data.length && !name.endsWith("/") && !name.startsWith("__MACOSX") && !name.includes(".DS_Store"),
  );
  if (!entries.length) throw new Error("This archive is empty.");

  if (options.format === "zip" || options.format === "base64" || options.format === "hex") {
    if (options.format === "zip") {
      const blob = await zipFiles(
        entries.map(([name, data]) => {
          const copy = new Uint8Array(data.byteLength);
          copy.set(data);
          return { name, blob: new Blob([copy]) };
        }),
      );
      return { blob, ext: "zip", mime: "application/zip", width: 0, height: 0, note: `${entries.length} files` };
    }
    return convertUniversal(file, options.format);
  }

  const converted: { name: string; blob: Blob }[] = [];
  for (const [name, data] of entries) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const inner = new File([copy], name.split("/").pop() || name);
    const detected = detectFile(inner);
    if (!canConvert(detected.kind, options.format)) continue;
    try {
      let result: ConvertResult;
      if (detected.kind === "image") result = await convertImage(inner, options);
      else if (detected.kind === "pdf") result = await convertPdf(inner, options);
      else if (detected.kind === "document") result = await convertDocument(inner, detected.ext, options);
      else if (detected.kind === "sheet") result = await convertSheet(inner, detected.ext, options);
      else if (detected.kind === "data") result = await convertData(inner, detected.ext, options);
      else continue;
      const base = (name.split("/").pop() || "file").replace(/\.[^.]+$/, "");
      converted.push({ name: `${base}.${result.ext}`, blob: result.blob });
    } catch {
      /* skip inner files that fail */
    }
  }
  if (!converted.length) throw new Error("No files inside this ZIP could convert to that format.");
  if (converted.length === 1) {
    const only = converted[0]!;
    return { blob: only.blob, ext: only.name.split(".").pop() || "bin", mime: only.blob.type, width: 0, height: 0 };
  }
  const blob = await zipFiles(converted);
  return { blob, ext: "zip", mime: "application/zip", width: 0, height: 0, note: `${converted.length} files` };
}
