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
        className="appearance-none rounded-full border border-border bg-card/80 py-2 pl-4 pr-9 text-sm font-medium text-foreground backdrop-blur-md transition hover:border-primary/50 focus:border-primary focus:outline-none"
      >
        {TEXT_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
