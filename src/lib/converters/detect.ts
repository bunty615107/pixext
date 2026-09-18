import { type FileKind, type FormatId, KIND_DEFAULT, KIND_TARGETS } from "./types";

export type Detected = {
  kind: FileKind;
  ext: string;
  mime: string;
};

const EXT_KIND: Record<string, FileKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  jfif: "image",
  webp: "image",
  gif: "image",
  bmp: "image",
  dib: "image",
  ico: "image",
  svg: "image",
  avif: "image",
  heic: "image",
  heif: "image",
  tif: "image",
  tiff: "image",
  apng: "image",
  pdf: "pdf",
  txt: "document",
  text: "document",
  md: "document",
  markdown: "document",
  html: "document",
  htm: "document",
  docx: "document",
  doc: "document",
  rtf: "document",
  epub: "document",
  odt: "document",
  pptx: "document",
  ppt: "document",
  log: "document",
  csv: "sheet",
  tsv: "sheet",
  xlsx: "sheet",
  xls: "sheet",
  ods: "sheet",
  json: "data",
  yaml: "data",
  yml: "data",
  xml: "data",
  wav: "audio",
  mp3: "audio",
  ogg: "audio",
  oga: "audio",
  flac: "audio",
  aac: "audio",
  m4a: "audio",
  wma: "audio",
  aiff: "audio",
  aif: "audio",
  weba: "audio",
  mp4: "video",
  m4v: "video",
  webm: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
  ogv: "video",
  "3gp": "video",
  zip: "archive",
  cbz: "archive",
};

const MIME_KIND: Record<string, FileKind> = {
  "image/": "image",
  "audio/": "audio",
  "video/": "video",
  "application/pdf": "pdf",
  "text/plain": "document",
  "text/markdown": "document",
  "text/html": "document",
  "text/csv": "sheet",
  "text/tab-separated-values": "sheet",
  "application/json": "data",
  "text/yaml": "data",
  "application/xml": "data",
  "text/xml": "data",
  "application/zip": "archive",
  "application/epub+zip": "document",
  "application/rtf": "document",
  "text/rtf": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "application/vnd.ms-excel": "sheet",
  "application/msword": "document",
};

export function extOf(name: string, mime = ""): string {
  const fromName = name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && fromName !== name.toLowerCase() && fromName.length <= 8) {
    if (fromName === "jpeg") return "jpg";
    if (fromName === "yml") return "yaml";
    if (fromName === "htm") return "html";
    return fromName;
  }
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/x-icon": "ico",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/html": "html",
    "text/csv": "csv",
    "application/json": "json",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/zip": "zip",
  };
  return map[mime] ?? "bin";
}

export function detectFile(file: File): Detected {
  const ext = extOf(file.name, file.type);
  const kindFromExt = EXT_KIND[ext];
  if (kindFromExt) return { kind: kindFromExt, ext, mime: file.type || "application/octet-stream" };

  const mime = file.type || "";
  if (mime) {
    const exact = MIME_KIND[mime];
    if (exact) return { kind: exact, ext, mime };
    for (const [prefix, kind] of Object.entries(MIME_KIND)) {
      if (prefix.endsWith("/") && mime.startsWith(prefix)) {
        return { kind, ext, mime };
      }
    }
  }
  return { kind: "binary", ext: ext || "bin", mime: mime || "application/octet-stream" };
}

export function recommendedFormat(kind: FileKind, support: Partial<Record<FormatId, boolean>>): FormatId {
  const preferred = KIND_DEFAULT[kind];
  if (support[preferred] !== false && KIND_TARGETS[kind].includes(preferred)) return preferred;
  return KIND_TARGETS[kind].find((id) => support[id] !== false) ?? "zip";
}

export async function probeFile(
  file: File,
): Promise<{ detected: Detected; previewUrl: string; width: number; height: number }> {
  const detected = detectFile(file);
  if (detected.kind === "image") {
    const previewUrl = URL.createObjectURL(file);
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      if (width && height) return { detected, previewUrl, width, height };
    } catch {
      try {
        const img = new Image();
        img.src = previewUrl;
        await img.decode();
        if (img.naturalWidth) {
          return { detected, previewUrl, width: img.naturalWidth, height: img.naturalHeight };
        }
      } catch {
        /* fall through */
      }
    }
    URL.revokeObjectURL(previewUrl);
    throw new Error("This image could not be opened.");
  }

  if (detected.kind === "video") {
    const previewUrl = URL.createObjectURL(file);
    try {
      const size = await videoSize(previewUrl);
      return { detected, previewUrl, width: size.width, height: size.height };
    } catch {
      return { detected, previewUrl, width: 0, height: 0 };
    }
  }

  if (detected.kind === "audio") {
    return { detected, previewUrl: URL.createObjectURL(file), width: 0, height: 0 };
  }

  return { detected, previewUrl: "", width: 0, height: 0 };
}

function videoSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    const timer = window.setTimeout(() => reject(new Error("timeout")), 4000);
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      resolve({ width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("video"));
    };
  });
}
