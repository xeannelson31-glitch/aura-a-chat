import { useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { Image as ImageIcon, Paperclip, Send, Square, Wand2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSend: (input: string, opts: { images?: string[]; forceImage?: boolean }) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const MAX_IMG_BYTES = 4 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function ChatInput({ onSend, onStop, isStreaming }: Props) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = (forceImage = false) => {
    if (isStreaming) return;
    if (!text.trim() && images.length === 0) return;
    onSend(text, { images, forceImage });
    setText("");
    setImages([]);
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(false);
    }
  };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: not an image`);
        continue;
      }
      if (f.size > MAX_IMG_BYTES) {
        toast.error(`${f.name}: max 4MB`);
        continue;
      }
      try {
        const url = await fileToDataUrl(f);
        setImages((prev) => [...prev, url]);
      } catch {
        toast.error(`Failed to read ${f.name}`);
      }
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card/80 p-3 backdrop-blur-md"
         style={{ boxShadow: "var(--shadow-soft)" }}>
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} className="h-16 w-16 rounded-lg border border-border object-cover" alt="" />
              <button
                onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition hover:scale-110"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target;
          t.style.height = "auto";
          t.style.height = Math.min(t.scrollHeight, 200) + "px";
        }}
        onKeyDown={onKey}
        placeholder="Ask anything, attach an image, or say 'generate an image of…'"
        rows={1}
        className="w-full resize-none bg-transparent px-2 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFiles}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title="Attach image"
            aria-label="Attach image"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={isStreaming || !text.trim()}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            title="Generate image from prompt"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Generate image
          </button>
        </div>

        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-sm font-medium text-secondary-foreground transition hover:bg-muted"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => submit(false)}
            disabled={!text.trim() && images.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--gradient-aurora)", boxShadow: "var(--shadow-glow)" }}
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        )}
      </div>

      <p className="mt-1.5 px-2 text-[11px] text-muted-foreground/70">
        <ImageIcon className="mr-1 inline h-3 w-3" />
        Vision: attach images for analysis · Press <kbd className="rounded bg-secondary px-1">Enter</kbd> to send
      </p>
    </div>
  );
}
