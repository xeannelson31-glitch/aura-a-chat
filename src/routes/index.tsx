import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Trash2, Image as ImageIcon, Code2, BookOpen, Lightbulb } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ModelPicker, TEXT_MODELS } from "@/components/chat/ModelPicker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — Multimodal AI Chat" },
      {
        name: "description",
        content:
          "Lumen is a fast, accurate multimodal AI assistant: chat, vision, and image generation in one beautiful interface.",
      },
      { property: "og:title", content: "Lumen — Multimodal AI Chat" },
      {
        property: "og:description",
        content:
          "Real-time conversation, image understanding, and AI image generation. Choose your model.",
      },
    ],
  }),
  component: ChatPage,
});

const SUGGESTIONS = [
  { icon: Lightbulb, text: "Explain quantum entanglement like I'm 12" },
  { icon: Code2, text: "Write a Python script to deduplicate a CSV by column" },
  { icon: ImageIcon, text: "Generate an image of a cozy reading nook at sunset" },
  { icon: BookOpen, text: "Summarize the plot of Dune in 5 bullets" },
];

function ChatPage() {
  const { messages, isStreaming, send, stop, reset } = useChat();
  const [model, setModel] = useState<string>(TEXT_MODELS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = (text: string, opts: { images?: string[]; forceImage?: boolean }) =>
    send(text, { ...opts, model });

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--gradient-aurora)", boxShadow: "var(--shadow-glow)" }}
            >
              <Sparkles className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight">Lumen</h1>
              <p className="text-[11px] text-muted-foreground">Multimodal AI · Vision · Image gen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModelPicker value={model} onChange={setModel} />
            <button
              onClick={reset}
              disabled={empty}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30"
              title="New chat"
              aria-label="New chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-soft flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {empty ? (
            <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
              <div
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "var(--gradient-aurora)", boxShadow: "var(--shadow-glow)" }}
              >
                <Sparkles className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight">
                What can I help you with?
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask anything, attach an image to analyze, or generate one from a description.
              </p>

              <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSend(s.text, {})}
                      className="group flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3.5 text-left text-sm transition hover:border-primary/40 hover:bg-card"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground/90 group-hover:text-foreground">
                        {s.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5 pb-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <ChatInput onSend={handleSend} onStop={stop} isStreaming={isStreaming} />
        </div>
      </div>

      <Toaster richColors position="top-center" theme="dark" />
    </div>
  );
}
