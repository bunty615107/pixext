export const FORMAT_IDS = [
  "png",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "ico",
  "avif",
  "svg",
  "pdf",
  "txt",
  "md",
  "html",
  "docx",
  "rtf",
  "epub",
  "csv",
  "tsv",
  "xlsx",
  "json",
  "yaml",
  "xml",
  "wav",
  "mp3",
  "ogg",
  "webm",
  "zip",
  "base64",
  "hex",
] as const;

export type FormatId = (typeof FORMAT_IDS)[number];

export type FileKind =
  | "image"
  | "pdf"
  | "document"
  | "sheet"
  | "data"
  | "audio"
  | "video"
  | "archive"
  | "binary";

export type FlattenMode = "white" | "black";

export type ConvertOptions = {
  format: FormatId;
  quality: number;
  maxEdge: number;
  flatten: FlattenMode;
};

export type ConvertResult = {
  blob: Blob;
  ext: string;
  mime: string;
  width: number;
  height: number;
  note?: string;
};

export type FormatMeta = {
  label: string;
  ext: string;
  mime: string;
  lossy: boolean;
  group: "Images" | "Documents" | "Data" | "Audio" | "Video" | "Other";
  note: string;
};

export const FORMAT_META: Record<FormatId, FormatMeta> = {
  png: { label: "PNG", ext: "png", mime: "image/png", lossy: false, group: "Images", note: "Lossless, keeps transparency" },
  jpeg: { label: "JPEG", ext: "jpg", mime: "image/jpeg", lossy: true, group: "Images", note: "Small photos, no transparency" },
  webp: { label: "WebP", ext: "webp", mime: "image/webp", lossy: true, group: "Images", note: "Modern, compact, keeps alpha" },
  gif: { label: "GIF", ext: "gif", mime: "image/gif", lossy: true, group: "Images", note: "Animation-friendly, 256 colors" },
  bmp: { label: "BMP", ext: "bmp", mime: "image/bmp", lossy: false, group: "Images", note: "Uncompressed bitmap" },
  ico: { label: "ICO", ext: "ico", mime: "image/x-icon", lossy: false, group: "Images", note: "App and favicon icon" },
  avif: { label: "AVIF", ext: "avif", mime: "image/avif", lossy: true, group: "Images", note: "High compression, next-gen" },
  svg: { label: "SVG", ext: "svg", mime: "image/svg+xml", lossy: false, group: "Images", note: "Vector wrapper with embedded image" },
  pdf: { label: "PDF", ext: "pdf", mime: "application/pdf", lossy: false, group: "Documents", note: "Portable document" },
  txt: { label: "TXT", ext: "txt", mime: "text/plain", lossy: false, group: "Documents", note: "Plain text" },
  md: { label: "Markdown", ext: "md", mime: "text/markdown", lossy: false, group: "Documents", note: "Markdown text" },
  html: { label: "HTML", ext: "html", mime: "text/html", lossy: false, group: "Documents", note: "Web document" },
  docx: { label: "Word", ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", lossy: false, group: "Documents", note: "Microsoft Word" },
  rtf: { label: "RTF", ext: "rtf", mime: "application/rtf", lossy: false, group: "Documents", note: "Rich text" },
  epub: { label: "EPUB", ext: "epub", mime: "application/epub+zip", lossy: false, group: "Documents", note: "E-book" },
  csv: { label: "CSV", ext: "csv", mime: "text/csv", lossy: false, group: "Data", note: "Comma-separated table" },
  tsv: { label: "TSV", ext: "tsv", mime: "text/tab-separated-values", lossy: false, group: "Data", note: "Tab-separated table" },
  xlsx: { label: "Excel", ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", lossy: false, group: "Data", note: "Excel workbook" },
  json: { label: "JSON", ext: "json", mime: "application/json", lossy: false, group: "Data", note: "Structured data" },
  yaml: { label: "YAML", ext: "yaml", mime: "text/yaml", lossy: false, group: "Data", note: "Human-readable data" },
  xml: { label: "XML", ext: "xml", mime: "application/xml", lossy: false, group: "Data", note: "Markup data" },
  wav: { label: "WAV", ext: "wav", mime: "audio/wav", lossy: false, group: "Audio", note: "Uncompressed audio" },
  mp3: { label: "MP3", ext: "mp3", mime: "audio/mpeg", lossy: true, group: "Audio", note: "Compressed audio" },
  ogg: { label: "OGG", ext: "ogg", mime: "audio/ogg", lossy: true, group: "Audio", note: "Ogg / Opus audio" },
  webm: { label: "WebM", ext: "webm", mime: "video/webm", lossy: true, group: "Video", note: "Web video" },
  zip: { label: "ZIP", ext: "zip", mime: "application/zip", lossy: false, group: "Other", note: "Archive of converted files" },
  base64: { label: "Base64", ext: "txt", mime: "text/plain", lossy: false, group: "Other", note: "Text-encoded bytes" },
  hex: { label: "Hex", ext: "txt", mime: "text/plain", lossy: false, group: "Other", note: "Hexadecimal dump" },
};

export const KIND_TARGETS: Record<FileKind, FormatId[]> = {
  image: ["png", "jpeg", "webp", "gif", "bmp", "ico", "avif", "svg", "pdf", "zip", "base64", "hex"],
  pdf: ["png", "jpeg", "webp", "gif", "txt", "html", "pdf", "zip", "base64", "hex"],
  document: ["txt", "md", "html", "docx", "rtf", "epub", "pdf", "zip", "base64", "hex"],
  sheet: ["csv", "tsv", "xlsx", "json", "html", "pdf", "zip", "base64", "hex"],
  data: ["json", "yaml", "xml", "csv", "txt", "html", "zip", "base64", "hex"],
  audio: ["wav", "mp3", "ogg", "zip", "base64", "hex"],
  video: ["webm", "gif", "png", "jpeg", "webp", "wav", "mp3", "zip", "base64", "hex"],
  archive: ["zip", "png", "jpeg", "webp", "pdf", "txt", "json", "csv", "base64", "hex"],
  binary: ["zip", "base64", "hex"],
};

export const KIND_DEFAULT: Record<FileKind, FormatId> = {
  image: "webp",
  pdf: "png",
  document: "pdf",
  sheet: "xlsx",
  data: "json",
  audio: "mp3",
  video: "gif",
  archive: "zip",
  binary: "base64",
};

export const FORMAT_GROUPS: FormatMeta["group"][] = [
  "Images",
  "Documents",
  "Data",
  "Audio",
  "Video",
  "Other",
];

export function canConvert(kind: FileKind, format: FormatId): boolean {
  return KIND_TARGETS[kind].includes(format);
}

export const RESIZE_PRESETS: { label: string; value: number }[] = [
  { label: "Original", value: 0 },
  { label: "4K", value: 3840 },
  { label: "1080p", value: 1920 },
  { label: "720p", value: 1280 },
  { label: "512px", value: 512 },
  { label: "256px", value: 256 },
];
