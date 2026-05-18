import { ChevronDown } from "lucide-react";

export interface ModelOption {
  id: string;
  name: string;
  hint: string;
  group: string;
}

export const TEXT_MODELS: readonly ModelOption[] = [
  // Lovable AI Gateway (no per-user key required)
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", hint: "Fast · Default", group: "Lovable AI" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", hint: "Strong reasoning", group: "Lovable AI" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", hint: "Fast multimodal", group: "Lovable AI" },
  { id: "openai/gpt-5", name: "GPT-5", hint: "Top accuracy", group: "Lovable AI" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", hint: "Balanced", group: "Lovable AI" },
  { id: "openai/gpt-5.2", name: "GPT-5.2", hint: "Enhanced reasoning", group: "Lovable AI" },

  // Groq (direct, GROQ_API_KEY)
  { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B", hint: "Groq · Fast", group: "Groq" },
  { id: "groq/llama-3.1-8b-instant", name: "Llama 3.1 8B", hint: "Groq · Ultra-fast", group: "Groq" },
  { id: "groq/openai/gpt-oss-20b", name: "GPT-OSS 20B", hint: "Groq · Open", group: "Groq" },

  // OpenAI (direct, OPENAI_API_KEY)
  { id: "openai-direct/gpt-4o", name: "GPT-4o", hint: "OpenAI direct", group: "OpenAI" },
  { id: "openai-direct/gpt-4o-mini", name: "GPT-4o Mini", hint: "OpenAI direct · Fast", group: "OpenAI" },

  // Gemini (direct, GEMINI_API_KEY)
  { id: "gemini-direct/gemini-2.5-flash", name: "Gemini 2.5 Flash (direct)", hint: "Google direct", group: "Gemini" },
  { id: "gemini-direct/gemini-2.5-pro", name: "Gemini 2.5 Pro (direct)", hint: "Google direct", group: "Gemini" },

  // Z.ai (direct, ZAI_API_KEY)
  { id: "zai/glm-4.5", name: "GLM-4.5", hint: "Z.ai · Reasoning", group: "Z.ai" },
  { id: "zai/glm-4-flash", name: "GLM-4 Flash", hint: "Z.ai · Fast", group: "Z.ai" },
] as const;

const GROUPS = ["Lovable AI", "Groq", "OpenAI", "Gemini", "Z.ai"] as const;

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select model"
        className="max-w-[140px] appearance-none truncate rounded-full border border-border bg-card/80 py-2 pl-3 pr-8 text-xs font-medium text-foreground backdrop-blur-md transition hover:border-primary/50 focus:border-primary focus:outline-none sm:max-w-none sm:pl-4 sm:pr-9 sm:text-sm"
      >
        {GROUPS.map((group) => (
          <optgroup key={group} label={group}>
            {TEXT_MODELS.filter((m) => m.group === group).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:right-3" />
    </div>
  );
}
