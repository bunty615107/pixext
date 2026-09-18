import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob, formatBytes, formatRelativeTime } from "@/lib/utils";
import { useConverter } from "@/store/converter";

export function HistoryView() {
  const history = useConverter((s) => s.history);
  const removeHistory = useConverter((s) => s.removeHistory);
  const wipeHistory = useConverter((s) => s.wipeHistory);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Library</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Recents</h1>
        </div>
        {history.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => void wipeHistory()}>
            <Trash2 />
            Clear
          </Button>
        ) : null}
      </header>

      {history.length === 0 ? (
        <div className="rounded-2xl bg-surface px-5 py-16 text-center shadow-[var(--shadow-border)]">
          <p className="text-base font-medium text-fg">No conversions yet</p>
          <p className="mt-1 text-sm text-pretty text-muted">
            Files you convert stay on this device and show up here for quick re-download.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]">
              <div className="size-14 shrink-0 overflow-hidden rounded-md bg-elevated">
                {item.thumb ? (
                  <img
                    src={item.thumb}
                    alt=""
                    className="size-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{item.name}</p>
                <p className="text-xs tabular-nums text-muted">
                  {item.fromExt.toUpperCase()} → {item.toExt.toUpperCase()} · {formatBytes(item.convertedSize)}
                </p>
                <p className="text-xs text-subtle">{formatRelativeTime(item.createdAt)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Download ${item.name}`}
                onClick={() => downloadBlob(item.blob, item.name)}
              >
                <Download />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove from recents"
                onClick={() => void removeHistory(item.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
