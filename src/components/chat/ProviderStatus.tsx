import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import {
  PROVIDERS,
  providerHealth,
  type ProviderId,
  type ProviderStatus as Status,
} from "@/lib/providers";

const DOT: Record<Status, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-muted-foreground/40",
};

const LABEL: Record<Status, string> = {
  healthy: "Healthy",
  degraded: "Rate-limited",
  down: "Down",
  unknown: "Not used yet",
};

function useHealth() {
  const [, force] = useState(0);
  useEffect(() => providerHealth.subscribe(() => force((n) => n + 1)), []);
  return providerHealth.get();
}

function overall(health: ReturnType<typeof providerHealth.get>): Status {
  const vals = PROVIDERS.map((p) => health[p].status);
  if (vals.some((v) => v === "down")) return "down";
  if (vals.some((v) => v === "degraded")) return "degraded";
  if (vals.some((v) => v === "healthy")) return "healthy";
  return "unknown";
}

export function ProviderStatus() {
  const health = useHealth();
  const [open, setOpen] = useState(false);
  const top = overall(health);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 text-xs font-medium text-foreground backdrop-blur-md transition hover:border-primary/50"
        aria-label="Provider status"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Provider health"
      >
        <span className={`h-2 w-2 rounded-full ${DOT[top]}`} aria-hidden="true" />
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Provider health
            </div>
            {PROVIDERS.map((p: ProviderId) => {
              const h = health[p];
              return (
                <div
                  key={p}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${DOT[h.status]}`} aria-hidden="true" />
                    <span className="font-medium">{p}</span>
                  </span>
                  <span className="text-muted-foreground">{LABEL[h.status]}</span>
                </div>
              );
            })}
            <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              Auto-fallback retries the next provider on errors.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
