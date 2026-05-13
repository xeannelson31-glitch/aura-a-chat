import { ChevronDown } from "lucide-react";

export const TEXT_MODELS = [
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", hint: "Fast · Balanced · Default" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", hint: "Strong reasoning · Multimodal" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", hint: "Fast multimodal" },
  { id: "openai/gpt-5", name: "GPT-5", hint: "Top accuracy · Slower" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", hint: "Balanced GPT" },
  { id: "openai/gpt-5.2", name: "GPT-5.2", hint: "Enhanced reasoning" },
] as const;

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
        {TEXT_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:right-3" />
    </div>
  );
}
