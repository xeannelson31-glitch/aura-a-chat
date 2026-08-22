import { useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { FileAudio, FileText, Loader2, Paperclip, Send, Sheet, Square, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fileToAttachment,
  MAX_FILE_BYTES,
  type Attachment,
  type AttachmentKind,
} from "@/lib/attachments";
import type { ChatPart } from "@/hooks/useChat";

interface Props {
  onSend: (
    input: string,
    opts: {
      images?: string[];
      parts?: ChatPart[];
      attachmentNames?: string[];
      forceImage?: boolean;
    },
  ) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const kindIcon = (kind: AttachmentKind) => {
  if (kind === "audio") return FileAudio;
  if (kind === "document") return Sheet;
  return FileText;
};

const prettySize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export function ChatInput({ onSend, onStop, isStreaming }: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = (forceImage = false) => {
    if (isStreaming || reading) return;
    if (!text.trim() && attachments.length === 0) return;

    const images = attachments.filter((a) => a.kind === "image").map((a) => a.previewUrl!);
    const parts = attachments.filter((a) => a.kind !== "image").map((a) => a.part);
    const attachmentNames = attachments.filter((a) => a.kind !== "image").map((a) => a.name);

    onSend(text, { images, parts, attachmentNames, forceImage });
    setText("");
    setAttachments([]);
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
    if (!files.length) return;
    setReading(true);
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: max 12MB`);
        continue;
      }
      try {
        const att = await fileToAttachment(f);
        setAttachments((prev) => [...prev, att]);
      } catch (err) {
        toast.error(`Couldn't read ${f.name}`, {
          description: err instanceof Error ? err.message : "Unsupported file type",
        });
      }
    }
    setReading(false);
  };

  const remove = (id: string) => setAttachments((p) => p.filter((a) => a.id !== id));

  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind !== "image");

  return (
    <div
      className="rounded-3xl border border-border bg-card/80 p-3 backdrop-blur-md"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {images.map((a) => (
            <div key={a.id} className="relative">
              <img
                src={a.previewUrl}
                className="h-16 w-16 rounded-lg border border-border object-cover"
                alt={a.name}
              />
              <button
                onClick={() => remove(a.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition hover:scale-110"
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {files.map((a) => {
            const Icon = kindIcon(a.kind);
            return (
              <div
                key={a.id}
                className="flex max-w-full items-center gap-2 rounded-xl border border-border bg-secondary/60 py-1.5 pl-2.5 pr-1.5 text-xs"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 truncate text-foreground/90">{a.name}</span>
                <span className="shrink-0 text-muted-foreground">{prettySize(a.size)}</span>
                <button
                  onClick={() => remove(a.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {reading && (
        <p className="mb-1 flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Reading files…
        </p>
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
        placeholder="Ask anything, attach an image or document, or say 'generate an image of…'"
        rows={1}
        className="w-full resize-none bg-transparent px-2 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,audio/*,.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.xml,.yml,.yaml,.log,text/*"
            multiple
            className="hidden"
            onChange={onFiles}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title="Attach image, document, or audio"
            aria-label="Attach image, document, or audio"
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
            disabled={reading || (!text.trim() && attachments.length === 0)}
            className="flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--gradient-aurora)", boxShadow: "var(--shadow-glow)" }}
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        )}
      </div>

      <p className="mt-1.5 px-2 text-[11px] text-muted-foreground/70">
        <FileText className="mr-1 inline h-3 w-3" />
        Images, PDFs, Word/Excel/PowerPoint, text &amp; code, audio · Press{" "}
        <kbd className="rounded bg-secondary px-1">Enter</kbd> to send
      </p>
    </div>
  );
}
