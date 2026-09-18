import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { generateTestChart } from "@/lib/test-chart";

function wavBeep(): File {
  const rate = 22050;
  const seconds = 1;
  const samples = rate * seconds;
  const dataSize = samples * 2;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const env = t < 0.05 ? t / 0.05 : t > 0.9 ? (1 - t) / 0.1 : 1;
    const sample = Math.sin(2 * Math.PI * 440 * t) * env * 0.35;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return new File([bytes], "pixext-tone.wav", { type: "audio/wav" });
}

async function samplePdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 396]);
  page.drawText("PixExt sample PDF", {
    x: 48,
    y: 320,
    size: 24,
    font,
    color: rgb(0.08, 0.08, 0.07),
  });
  page.drawText("Use this to try PDF → PNG, JPEG, TXT, or HTML.", {
    x: 48,
    y: 280,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.28),
  });
  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], "pixext-sample.pdf", { type: "application/pdf" });
}

export async function generateSamples(): Promise<File[]> {
  const image = await generateTestChart();
  const csv = new File(
    ["name,format,kind\nphoto.png,webp,image\nnotes.md,pdf,document\nsong.wav,mp3,audio\n"],
    "pixext-sample.csv",
    { type: "text/csv" },
  );
  const json = new File(
    [JSON.stringify({ app: "PixExt", conversions: ["png→webp", "csv→xlsx", "wav→mp3", "pdf→png"] }, null, 2)],
    "pixext-sample.json",
    { type: "application/json" },
  );
  const md = new File(
    ["# PixExt\n\nConvert **images, PDFs, documents, sheets, audio, and video** on your device.\n"],
    "pixext-sample.md",
    { type: "text/markdown" },
  );
  const pdf = await samplePdf();
  const wav = wavBeep();
  return [image, pdf, csv, json, md, wav];
}
