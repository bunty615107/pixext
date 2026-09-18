import { ShieldCheck } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { FORMAT_GROUPS, FORMAT_IDS, FORMAT_META } from "@/lib/convert";
import { cn } from "@/lib/utils";
import { useConverter } from "@/store/converter";

export function SettingsView() {
  const format = useConverter((s) => s.format);
  const quality = useConverter((s) => s.quality);
  const flatten = useConverter((s) => s.flatten);
  const support = useConverter((s) => s.support);
  const setFormat = useConverter((s) => s.setFormat);
  const setQuality = useConverter((s) => s.setQuality);
  const setFlatten = useConverter((s) => s.setFlatten);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-widest text-muted uppercase">Preferences</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Settings</h1>
      </header>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-medium text-fg">Preferred format</h2>
        <p className="mt-1 text-xs text-muted">Used when the source file can convert to it</p>
        <div className="mt-3 flex flex-col gap-3">
          {FORMAT_GROUPS.map((group) => (
            <div key={group}>
              <p className="mb-2 text-xs font-medium tracking-widest text-subtle uppercase">{group}</p>
              <div className="flex flex-wrap gap-2">
                {FORMAT_IDS.filter((id) => FORMAT_META[id].group === group).map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled={support[id] === false}
                    onClick={() => setFormat(id)}
                    className={cn(
                      "h-10 rounded-md px-3 text-sm font-medium transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                      format === id ? "bg-primary text-primary-fg" : "bg-elevated text-fg",
                      support[id] === false && "opacity-35",
                    )}
                  >
                    {FORMAT_META[id].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-fg">Lossy quality</h2>
          <span className="text-sm tabular-nums text-muted">{Math.round(quality * 100)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">JPEG, WebP, AVIF, GIF, MP3, WebM</p>
        <Slider
          className="mt-4"
          min={40}
          max={100}
          step={1}
          value={[Math.round(quality * 100)]}
          onValueChange={([v]) => setQuality((v ?? 86) / 100)}
        />
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="text-sm font-medium text-fg">Flatten transparency</h2>
        <p className="mt-1 text-xs text-muted">JPEG, BMP, and PDF cannot keep alpha</p>
        <div className="mt-3 flex gap-2">
          {(["white", "black"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFlatten(mode)}
              className={cn(
                "h-10 flex-1 rounded-md text-sm font-medium capitalize",
                flatten === mode ? "bg-primary text-primary-fg" : "bg-elevated text-fg",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 items-center justify-center rounded-md bg-accent/15 text-accent">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-medium text-fg">On-device conversion</h2>
            <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">
              PixExt never uploads your files. Images, documents, audio, and video convert in this
              browser. Recents stay on this device.
            </p>
          </div>
        </div>
      </section>

      <p className="px-1 text-xs text-subtle">
        Add PixExt to your home screen from the browser menu for a full-screen Android-style app.
      </p>
    </div>
  );
}
