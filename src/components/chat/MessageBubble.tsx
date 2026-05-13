import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RotateCcw, User } from "lucide-react";
import type { ChatMessage } from "@/hooks/useChat";
import logoUrl from "@/assets/aura-logo.webp";

interface Props {
  message: ChatMessage;
  onRegenerate?: (id: string) => void;
  canRegenerate?: boolean;
}

export function MessageBubble({ message, onRegenerate, canRegenerate }: Props) {
  const isUser = message.role === "user";
  const showRegen =
    !isUser && !message.pending && canRegenerate && onRegenerate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card"
             style={{ boxShadow: "var(--shadow-glow)" }}>
          <img src={logoUrl} alt="Aura" className="h-full w-full object-contain p-0.5" />
        </div>
      )}

      <div className={`flex min-w-0 max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {/* User images */}
        {isUser && Array.isArray(message.content) && (
          <div className="flex flex-wrap justify-end gap-2">
            {message.content
              .filter((p) => p.type === "image_url")
              .map((p, i) =>
                p.type === "image_url" ? (
                  <img
                    key={i}
                    src={p.image_url.url}
                    alt="attachment"
                    className="max-h-56 max-w-full rounded-xl border border-border object-cover"
                  />
                ) : null,
              )}
          </div>
        )}

        {/* Bubble */}
        {(() => {
          const text =
            typeof message.content === "string"
              ? message.content
              : message.content
                  .filter((p) => p.type === "text")
                  .map((p) => (p as { text: string }).text)
                  .join("\n");

          if (!text && !message.pending) return null;

          return (
            <div
              className={
                isUser
                  ? "max-w-full break-words rounded-2xl rounded-tr-md px-4 py-2.5 text-sm font-medium text-primary-foreground"
                  : "max-w-full overflow-hidden break-words rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-card-foreground"
              }
              style={
                isUser
                  ? { background: "var(--gradient-bubble-user)", boxShadow: "var(--shadow-soft)" }
                  : { boxShadow: "var(--shadow-soft)" }
              }
            >
              {message.pending && !text ? (
                <div className="flex items-center gap-1.5 py-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              ) : isUser ? (
                <span className="whitespace-pre-wrap">{text}</span>
              ) : (
                <div className="prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })()}

        {/* Generated image */}
        {message.generatedImage && (
          <motion.img
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            src={message.generatedImage}
            alt="Generated"
            className="max-h-[420px] rounded-2xl border border-border object-cover"
            style={{ boxShadow: "var(--shadow-glow)" }}
          />
        )}

        {showRegen && (
          <button
            onClick={() => onRegenerate!(message.id)}
            className="mt-0.5 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title="Regenerate response"
          >
            <RotateCcw className="h-3 w-3" />
            Regenerate
          </button>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
}
