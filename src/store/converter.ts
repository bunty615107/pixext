import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type ConvertOptions,
  type FileKind,
  type FlattenMode,
  type FormatId,
  canConvert,
  convertFile,
  detectFile,
  makeThumbnail,
  probeFile,
  recommendedFormat,
} from "@/lib/convert";
import { deleteHistory, listHistory, saveHistory, type HistoryRecord, clearHistory } from "@/lib/history";
import { outputFileName, uid } from "@/lib/utils";

export type TabId = "convert" | "recents" | "settings";
export type JobStatus = "queued" | "converting" | "done" | "error";

export type Job = {
  id: string;
  file: File;
  name: string;
  kind: FileKind;
  previewUrl: string;
  originalExt: string;
  originalSize: number;
  width: number;
  height: number;
  status: JobStatus;
  optionKey: string;
  error?: string;
  output?: {
    blob: Blob;
    url: string;
    size: number;
    ext: string;
    mime: string;
    width: number;
    height: number;
    name: string;
    note?: string;
  };
};

type Settings = {
  format: FormatId;
  quality: number;
  maxEdge: number;
  flatten: FlattenMode;
};

type ConverterState = Settings & {
  tab: TabId;
  jobs: Job[];
  history: HistoryRecord[];
  support: Partial<Record<FormatId, boolean>>;
  converting: boolean;
  queuedPass: boolean;
  setTab: (tab: TabId) => void;
  setFormat: (format: FormatId) => void;
  setQuality: (quality: number) => void;
  setMaxEdge: (maxEdge: number) => void;
  setFlatten: (flatten: FlattenMode) => void;
  setSupport: (support: Partial<Record<FormatId, boolean>>) => void;
  addFiles: (files: File[]) => Promise<void>;
  removeJob: (id: string) => void;
  clearJobs: () => void;
  convertPending: () => Promise<void>;
  loadHistory: () => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  wipeHistory: () => Promise<void>;
};

function optionKey(s: Settings): string {
  return `${s.format}:${s.quality}:${s.maxEdge}:${s.flatten}`;
}

function revokeJob(job: Job) {
  if (job.previewUrl) URL.revokeObjectURL(job.previewUrl);
  if (job.output) URL.revokeObjectURL(job.output.url);
}

export const useConverter = create<ConverterState>()(
  persist(
    (set, get) => ({
      tab: "convert",
      format: "webp",
      quality: 0.86,
      maxEdge: 0,
      flatten: "white",
      jobs: [],
      history: [],
      support: {},
      converting: false,
      queuedPass: false,
      setTab: (tab) => set({ tab }),
      setFormat: (format) => {
        set({ format });
        void get().convertPending();
      },
      setQuality: (quality) => {
        set({ quality });
        void get().convertPending();
      },
      setMaxEdge: (maxEdge) => {
        set({ maxEdge });
        void get().convertPending();
      },
      setFlatten: (flatten) => {
        set({ flatten });
        void get().convertPending();
      },
      setSupport: (support) => set({ support }),
      addFiles: async (files) => {
        const incoming = files.filter((f) => f.size > 0);
        if (!incoming.length) return;
        const next: Job[] = [];
        for (const file of incoming) {
          const detected = detectFile(file);
          try {
            const probed = await probeFile(file);
            next.push({
              id: uid(),
              file,
              name: file.name || "file",
              kind: probed.detected.kind,
              previewUrl: probed.previewUrl,
              originalExt: probed.detected.ext,
              originalSize: file.size,
              width: probed.width,
              height: probed.height,
              status: "queued",
              optionKey: "",
            });
          } catch (err) {
            next.push({
              id: uid(),
              file,
              name: file.name || "file",
              kind: detected.kind,
              previewUrl: "",
              originalExt: detected.ext,
              originalSize: file.size,
              width: 0,
              height: 0,
              status: "error",
              optionKey: "error",
              error: err instanceof Error ? err.message : "Could not read this file.",
            });
          }
        }

        const state = get();
        const kinds = [...state.jobs, ...next].map((j) => j.kind);
        let format = state.format;
        if (kinds.length && kinds.every((kind) => !canConvert(kind, format))) {
          format = recommendedFormat(next[0]?.kind ?? "binary", state.support);
        }
        set({ jobs: [...state.jobs, ...next], tab: "convert", format });
        void get().convertPending();
      },
      removeJob: (id) => {
        const job = get().jobs.find((j) => j.id === id);
        if (job) revokeJob(job);
        set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) }));
      },
      clearJobs: () => {
        for (const job of get().jobs) revokeJob(job);
        set({ jobs: [] });
      },
      convertPending: async () => {
        if (get().converting) {
          set({ queuedPass: true });
          return;
        }
        set({ converting: true, queuedPass: false });
        try {
          while (true) {
            const state = get();
            const key = optionKey(state);
            const job = state.jobs.find((j) => {
              if (j.status === "converting") return false;
              if (j.optionKey === "error") return false;
              if (j.optionKey === key && (j.status === "done" || j.status === "error")) return false;
              return true;
            });
            if (!job) break;

            set((s) => ({
              jobs: s.jobs.map((j) =>
                j.id === job.id ? { ...j, status: "converting", error: undefined } : j,
              ),
            }));

            const options: ConvertOptions = {
              format: state.format,
              quality: state.quality,
              maxEdge: state.maxEdge,
              flatten: state.flatten,
            };

            try {
              const result = await convertFile(job.file, options);
              const url = URL.createObjectURL(result.blob);
              const name = outputFileName(job.name, result.ext);
              if (job.output) URL.revokeObjectURL(job.output.url);
              set((s) => ({
                jobs: s.jobs.map((j) =>
                  j.id === job.id
                    ? {
                        ...j,
                        status: "done",
                        optionKey: key,
                        output: {
                          blob: result.blob,
                          url,
                          size: result.blob.size,
                          ext: result.ext,
                          mime: result.mime,
                          width: result.width,
                          height: result.height,
                          name,
                          note: result.note,
                        },
                      }
                    : j,
                ),
              }));

              const thumb = await makeThumbnail(result.blob).catch(() => "");
              const record: HistoryRecord = {
                id: uid(),
                name,
                fromExt: job.originalExt,
                toExt: result.ext,
                originalSize: job.originalSize,
                convertedSize: result.blob.size,
                width: result.width,
                height: result.height,
                createdAt: Date.now(),
                thumb,
                blob: result.blob,
              };
              await saveHistory(record);
              set((s) => ({ history: [record, ...s.history.filter((h) => h.id !== record.id)].slice(0, 40) }));
            } catch (err) {
              set((s) => ({
                jobs: s.jobs.map((j) =>
                  j.id === job.id
                    ? {
                        ...j,
                        status: "error",
                        optionKey: key,
                        error: err instanceof Error ? err.message : "Conversion failed.",
                      }
                    : j,
                ),
              }));
            }
          }
        } finally {
          set({ converting: false });
          if (get().queuedPass) {
            set({ queuedPass: false });
            void get().convertPending();
          }
        }
      },
      loadHistory: async () => {
        const rows = await listHistory();
        set({ history: rows });
      },
      removeHistory: async (id) => {
        await deleteHistory(id);
        set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
      },
      wipeHistory: async () => {
        await clearHistory();
        set({ history: [] });
      },
    }),
    {
      name: "pixext-settings",
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        format: state.format,
        quality: state.quality,
        maxEdge: state.maxEdge,
        flatten: state.flatten,
      }),
    },
  ),
);
