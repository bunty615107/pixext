import { useEffect } from "react";
import { Files, History, Settings2 } from "lucide-react";
import { Toaster } from "sonner";
import { ConvertView } from "@/components/convert-view";
import { HistoryView } from "@/components/history-view";
import { SettingsView } from "@/components/settings-view";
import { detectFormatSupport, FORMAT_IDS } from "@/lib/convert";
import { cn } from "@/lib/utils";
import { useConverter, type TabId } from "@/store/converter";

const TABS: { id: TabId; label: string; icon: typeof Files }[] = [
  { id: "convert", label: "Convert", icon: Files },
  { id: "recents", label: "Recents", icon: History },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function AppShell() {
  const tab = useConverter((s) => s.tab);
  const setTab = useConverter((s) => s.setTab);
  const setSupport = useConverter((s) => s.setSupport);
  const loadHistory = useConverter((s) => s.loadHistory);
  const setFormat = useConverter((s) => s.setFormat);

  useEffect(() => {
    useConverter.persist.rehydrate();
    void loadHistory();
    void detectFormatSupport().then((support) => {
      setSupport(support);
      const current = useConverter.getState().format;
      if (support[current] === false || !FORMAT_IDS.includes(current)) {
        setFormat("png");
      }
    });
  }, [loadHistory, setSupport, setFormat]);

  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 app-wash" />
      <main className="relative mx-auto min-h-dvh w-full max-w-xl px-4 pt-6 pb-28 sm:pt-10">
        {tab === "convert" ? <ConvertView /> : null}
        {tab === "recents" ? <HistoryView /> : null}
        {tab === "settings" ? <SettingsView /> : null}
      </main>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
      >
        <div className="mx-auto flex h-16 max-w-xl items-center justify-around px-2">
          {TABS.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex h-12 min-w-20 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs font-medium transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className: "bg-elevated text-fg border-border shadow-[var(--shadow-border)]",
        }}
      />
    </div>
  );
}
