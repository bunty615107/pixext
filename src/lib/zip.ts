import { zipSync, unzipSync } from "fflate";

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const data: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const file of files) {
    let name = file.name.replace(/^\/+/, "") || "file";
    if (used.has(name)) {
      const base = name.replace(/\.[^.]+$/, "");
      const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
      let i = 2;
      while (used.has(`${base}-${i}${ext}`)) i += 1;
      name = `${base}-${i}${ext}`;
    }
    used.add(name);
    data[name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  const out = zipSync(data, { level: 6 });
  const copy = new Uint8Array(out.byteLength);
  copy.set(out);
  return new Blob([copy], { type: "application/zip" });
}

export function unzipBytes(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes);
}
