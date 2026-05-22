// Provider mapping, fallback chains, and a tiny health store.
// Used by useChat (fallback + recording outcomes) and ProviderStatus (UI).

import { TEXT_MODELS } from "@/components/chat/ModelPicker";

export type ProviderId = "Lovable AI" | "Groq" | "OpenAI" | "Gemini" | "Z.ai";

export const PROVIDERS: readonly ProviderId[] = [
  "Lovable AI",
  "Groq",
  "OpenAI",
  "Gemini",
  "Z.ai",
] as const;

/** Map a model id (e.g. "groq/llama-3.3-70b-versatile") to its provider group. */
export function providerOf(modelId: string): ProviderId {
  const m = TEXT_MODELS.find((x) => x.id === modelId);
  return (m?.group as ProviderId) ?? "Lovable AI";
}

export function modelLabel(modelId: string): string {
  return TEXT_MODELS.find((m) => m.id === modelId)?.name ?? modelId;
}

/**
 * Fallback chain for a given starting model:
 *   1. other models in the SAME provider (cheapest re-roll)
 *   2. then walk other providers in PROVIDERS order, picking their first model
 * The original model is never repeated.
 */
export function fallbackChain(modelId: string): string[] {
  const start = providerOf(modelId);
  const seen = new Set<string>([modelId]);
  const chain: string[] = [];

  for (const m of TEXT_MODELS) {
    if (m.group === start && !seen.has(m.id)) {
      chain.push(m.id);
      seen.add(m.id);
    }
  }
  for (const p of PROVIDERS) {
    if (p === start) continue;
    const first = TEXT_MODELS.find((m) => m.group === p && !seen.has(m.id));
    if (first) {
      chain.push(first.id);
      seen.add(first.id);
    }
  }
  return chain;
}

// ---------- Health store ----------
export type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";

export interface ProviderHealth {
  status: ProviderStatus;
  lastError?: string;
  lastChangedAt: number;
}

type HealthMap = Record<ProviderId, ProviderHealth>;

const initial = (): HealthMap =>
  PROVIDERS.reduce((acc, p) => {
    acc[p] = { status: "unknown", lastChangedAt: Date.now() };
    return acc;
  }, {} as HealthMap);

let state: HealthMap = initial();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const providerHealth = {
  get(): HealthMap {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  markSuccess(modelId: string) {
    const p = providerOf(modelId);
    if (state[p].status !== "healthy") {
      state = { ...state, [p]: { status: "healthy", lastChangedAt: Date.now() } };
      emit();
    }
  },
  markFailure(modelId: string, status: number | undefined, message: string) {
    const p = providerOf(modelId);
    // 429 = degraded (rate-limited but service alive). Everything else 5xx/network = down.
    const next: ProviderStatus = status === 429 ? "degraded" : "down";
    state = {
      ...state,
      [p]: { status: next, lastError: message, lastChangedAt: Date.now() },
    };
    emit();
  },
};
