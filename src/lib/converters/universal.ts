import { type ConvertResult } from "./types";

export async function convertUniversal(file: File, format: "base64" | "hex" | "zip"): Promise<ConvertResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (format === "base64") {
    const text = `data:${file.type || "application/octet-stream"};base64,${bufferToBase64(bytes)}`;
    return { blob: new Blob([text], { type: "text/plain" }), ext: "txt", mime: "text/plain", width: 0, height: 0 };
  }
  if (format === "hex") {
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    return { blob: new Blob([hex], { type: "text/plain" }), ext: "txt", mime: "text/plain", width: 0, height: 0 };
  }
  const { zipFiles } = await import("@/lib/zip");
  const blob = await zipFiles([{ name: file.name || "file.bin", blob: file }]);
  return { blob, ext: "zip", mime: "application/zip", width: 0, height: 0 };
}

function bufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
