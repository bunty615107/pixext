import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  FilePlus,
  Files,
  LoaderCircle,
  Layers,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  FORMAT_GROUPS,
  FORMAT_IDS,
  FORMAT_META,
  KIND_TARGETS,
  RESIZE_PRESETS,
  mergeJobsToPdf,
} from "@/lib/convert";
import { generateSamples } from "@/lib/samples";
import { zipFiles } from "@/lib/zip";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useConverter, type Job } from "@/store/converter";

export function ConvertView() {
  const jobs = useConverter((s) => s.jobs);
  const format = useConverter((s) => s.format);
  const quality = useConverter((s) => s.quality);
  const maxEdge = useConverter((s) => s.maxEdge);
  const flatten = useConverter((s) => s.flatten);
  const support = useConverter((s) => s.support);
  const converting = useConverter((s) => s.converting);
  const addFiles = useConverter((s) => s.addFiles);
  const removeJob = useConverter((s) => s.removeJob);
  const clearJobs = useConverter((s) => s.clearJobs);
  const setFormat = useConverter((s) => s.setFormat);
  const setQuality = useConverter((s) => s.setQuality);
  const setMaxEdge = useConverter((s) => s.setMaxEdge);
  const setFlatten = useConverter((s) => s.setFlatten);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [merging, setMerging] = useState(false);

  const meta = FORMAT_META[format];
  const done = jobs.filter((j) => j.status === "done" && j.output);
  const lossy = meta.lossy;
  const showResize = ["png", "jpeg", "webp", "gif", "bmp", "ico", "avif", "svg", "pdf", "webm"].includes(format);
  const showFlatten = format === "jpeg" || format === "bmp" || format === "pdf";
  const canMerge = jobs.filter((j) => j.kind === "image" || j.kind === "pdf").length >= 2;

  const visibleFormats = useMemo(() => {
    if (!jobs.length) return FORMAT_IDS;
    const allowed = new Set(jobs.flatMap((j) => KIND_TARGETS[j.kind]));
    return FORMAT_IDS.filter((id) => allowed.has(id));
  }, [jobs]);

  const totals = useMemo(() => {
    const original = done.reduce((n, j) => n + j.originalSize, 0);
    const converted = done.reduce((n, j) => n + (j.output?.size ?? 0), 0);
    return { original, converted };
  }, [done]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length) {
        event.preventDefault();
        void addFiles(files);
        toast("Pasted file added");
        return;
      }
      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (text) {
        event.preventDefault();
        void addFiles([new File([text], "pasted.txt", { type: "text/plain" })]);
        toast("Pasted text added");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const onPick = (list: FileList | null) => {
    if (!list?.length) return;
    void addFiles([...list]);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const files = [...event.dataTransfer.files];
    if (files.length) void addFiles(files);
  };

  const downloadAll = async () => {
    if (!done.length) return;
    if (done.length === 1 && done[0]?.output) {
      downloadBlob(done[0].output.blob, done[0].output.name);
      return;
    }
    const zip = await zipFiles(
      done.flatMap((j) => (j.output ? [{ name: j.output.name, blob: j.output.blob }] : [])),
    );
    downloadBlob(zip, `pixext-${format}.zip`);
  };

  const mergePdf = async () => {
    const sources = jobs.filter((j) => (j.kind === "image" || j.kind === "pdf") && (j.output || j.file));
    if (sources.length < 2) return;
    setMerging(true);
    try {
      const blob = await mergeJobsToPdf(
        sources.map((j) => ({
          blob: j.kind === "pdf" ? j.file : (j.output?.blob ?? j.file),
          mime: j.kind === "pdf" ? "application/pdf" : j.file.type || "image/png",
          name: j.name,
        })),
        { format: "pdf", quality, maxEdge, flatten },
      );
      downloadBlob(blob, "pixext-merged.pdf");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not merge PDF");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-widest text-muted uppercase">Universal converter</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-balance text-fg">
          Convert any file
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-pretty text-muted">
          Images, PDFs, documents, sheets, audio, video, and archives — all on this device.
        </p>
      </header>

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {jobs.length === 0 ? (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-2xl bg-surface p-2 shadow-[var(--shadow-border)] transition-[background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
            dragOver && "bg-elevated",
          )}
        >
          <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
            <EmptyArt />
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-fg">Drop files here</p>
              <p className="text-sm text-pretty text-muted">
                PNG, PDF, DOCX, CSV, MP3, MP4, ZIP — or paste from the clipboard
              </p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Button className="w-full" onClick={() => fileRef.current?.click()}>
                <FilePlus />
                Choose files
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
                  <Camera />
                  Camera
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const files = await generateSamples();
                    await addFiles(files);
                  }}
                >
                  <Files />
                  Samples
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-medium text-fg">Output format</h2>
          <span className="truncate text-xs text-muted">{meta.note}</span>
        </div>
        <div className="flex flex-col gap-3">
          {FORMAT_GROUPS.map((group) => {
            const ids = visibleFormats.filter((id) => FORMAT_META[id].group === group);
            if (!ids.length) return null;
            return (
              <div key={group}>
                <p className="mb-2 px-1 text-xs font-medium tracking-widest text-subtle uppercase">{group}</p>
                <div className="chip-row flex gap-2 overflow-x-auto pb-1">
                  {ids.map((id) => {
                    const enabled = support[id] !== false;
                    const selected = format === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!enabled}
                        onClick={() => setFormat(id)}
                        className={cn(
                          "h-11 shrink-0 rounded-lg px-4 text-sm font-medium transition-[background-color,color,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] active:scale-[0.96]",
                          selected ? "bg-primary text-primary-fg" : "bg-elevated text-fg",
                          !enabled && "opacity-35",
                        )}
                      >
                        {FORMAT_META[id].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {lossy ? (
          <div className="mt-4 px-1">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-fg" htmlFor="quality">
                Quality
              </label>
              <span className="text-sm tabular-nums text-muted">{Math.round(quality * 100)}</span>
            </div>
            <Slider
              id="quality"
              min={40}
              max={100}
              step={1}
              value={[Math.round(quality * 100)]}
              onValueChange={([v]) => setQuality((v ?? 86) / 100)}
            />
          </div>
        ) : null}

        {showResize ? (
          <div className="mt-4 px-1">
            <p className="mb-2 text-sm text-fg">Resize</p>
            <div className="flex flex-wrap gap-2">
              {RESIZE_PRESETS.map((preset) => {
                const selected = maxEdge === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setMaxEdge(preset.value)}
                    className={cn(
                      "h-10 rounded-md px-3 text-sm font-medium transition-[background-color,color,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] active:scale-[0.96]",
                      selected ? "bg-accent/20 text-accent" : "bg-elevated text-muted",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {showFlatten ? (
          <div className="mt-4 flex items-center justify-between px-1">
            <div>
              <p className="text-sm text-fg">Background</p>
              <p className="text-xs text-muted">Used when flattening transparency</p>
            </div>
            <div className="flex gap-2">
              {(["white", "black"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFlatten(mode)}
                  className={cn(
                    "h-10 rounded-md px-3 text-sm font-medium capitalize transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                    flatten === mode ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {jobs.length > 0 ? (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn("rounded-2xl bg-surface p-2 shadow-[var(--shadow-border)]", dragOver && "bg-elevated")}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 pt-1">
              <p className="text-sm text-muted">
                {jobs.length} {jobs.length === 1 ? "file" : "files"}
                {converting ? " · converting" : done.length ? ` · ${done.length} ready` : ""}
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  <FilePlus />
                  Add
                </Button>
                <Button variant="ghost" size="sm" onClick={clearJobs}>
                  Clear
                </Button>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onRemove={() => removeJob(job.id)} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {done.length > 0 ? (
        <div className="sticky bottom-24 z-10 rounded-2xl bg-elevated p-3 shadow-[var(--shadow-border)]">
          <div className="mb-3 px-1">
            <p className="text-sm font-medium text-fg">
              {done.length} ready as {meta.label}
            </p>
            <p className="text-xs tabular-nums text-muted">
              {formatBytes(totals.original)} → {formatBytes(totals.converted)}
              {totals.original > 0 ? <SizeDelta original={totals.original} converted={totals.converted} /> : null}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button className="w-full" size="lg" onClick={() => void downloadAll()}>
              <Download />
              {done.length === 1 ? "Download" : "Download all"}
            </Button>
            {canMerge ? (
              <Button variant="secondary" className="w-full" disabled={merging} onClick={() => void mergePdf()}>
                <Layers />
                {merging ? "Merging" : "Merge to one PDF"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SizeDelta({ original, converted }: { original: number; converted: number }) {
  if (!original) return null;
  const pct = Math.round((1 - converted / original) * 100);
  if (pct === 0) return null;
  const saved = pct > 0;
  return (
    <span className={cn("ml-2", saved ? "text-success" : "text-danger")}>
      {saved ? "−" : "+"}
      {Math.abs(pct)}%
    </span>
  );
}

function JobCard({ job, onRemove }: { job: Job; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const out = job.output;
  const visual = job.kind === "image" || job.kind === "video";

  return (
    <li className="rounded-xl bg-elevated p-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="size-16 shrink-0 overflow-hidden rounded-md bg-surface"
        >
          {job.kind === "image" && job.previewUrl ? (
            <img
              src={job.previewUrl}
              alt=""
              className="size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
            />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-0.5 text-muted">
              <Files className="size-5" />
              <span className="text-xs uppercase">{job.originalExt}</span>
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{job.name}</p>
          <p className="text-xs tabular-nums text-muted">
            {job.originalExt.toUpperCase()} · {formatBytes(job.originalSize)}
            {job.width ? ` · ${job.width}×${job.height}` : ""}
          </p>
          {job.status === "converting" ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-accent">
              <LoaderCircle className="size-3.5 animate-spin" />
              Converting
            </p>
          ) : job.status === "error" ? (
            <p className="mt-1 text-xs text-danger">{job.error}</p>
          ) : out ? (
            <p className="mt-1 text-xs tabular-nums text-muted">
              {out.ext.toUpperCase()} · {formatBytes(out.size)}
              {out.note ? ` · ${out.note}` : ""}
              <SizeDelta original={job.originalSize} converted={out.size} />
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {out ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${out.name}`}
              onClick={() => downloadBlob(out.blob, out.name)}
            >
              <Download />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={onRemove}>
            <X />
          </Button>
        </div>
      </div>
      {open && visual && job.previewUrl ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <figure className="overflow-hidden rounded-md bg-surface">
            {job.kind === "video" ? (
              <video src={job.previewUrl} className="aspect-square w-full object-contain" muted playsInline />
            ) : (
              <img
                src={job.previewUrl}
                alt="Original"
                className="aspect-square w-full object-contain outline outline-1 -outline-offset-1 outline-fg/10"
              />
            )}
            <figcaption className="px-2 py-1.5 text-xs text-muted">Original</figcaption>
          </figure>
          <figure className="overflow-hidden rounded-md bg-surface">
            {out && out.mime.startsWith("image/") ? (
              <img
                src={out.url}
                alt="Converted"
                className="aspect-square w-full object-contain outline outline-1 -outline-offset-1 outline-fg/10"
              />
            ) : out && out.mime.startsWith("video/") ? (
              <video src={out.url} className="aspect-square w-full object-contain" controls playsInline />
            ) : (
              <div className="flex aspect-square items-center justify-center text-muted">
                {job.status === "converting" ? <LoaderCircle className="size-5 animate-spin" /> : out?.ext.toUpperCase()}
              </div>
            )}
            <figcaption className="px-2 py-1.5 text-xs text-muted">Converted</figcaption>
          </figure>
        </div>
      ) : null}
      {open && job.kind === "audio" ? (
        <div className="mt-2 px-1">
          <audio className="w-full" src={out?.url || job.previewUrl} controls />
        </div>
      ) : null}
    </li>
  );
}

function EmptyArt() {
  return (
    <div className="relative h-24 w-24" aria-hidden="true">
      <div className="absolute top-3 left-1 h-20 w-20 -rotate-6 rounded-xl bg-bg shadow-[var(--shadow-border)]" />
      <div className="absolute top-1 right-0 h-20 w-20 rotate-6 rounded-xl bg-elevated shadow-[var(--shadow-border)]" />
      <div className="absolute inset-6 rounded-md bg-accent/40" />
    </div>
  );
}
