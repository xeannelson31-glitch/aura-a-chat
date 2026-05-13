import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Trash2,
  Image as ImageIcon,
  Code2,
  BookOpen,
  Lightbulb,
  Download,
  ChevronDown,
  AlertTriangle,
  Menu,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ModelPicker, TEXT_MODELS } from "@/components/chat/ModelPicker";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { exportAsJSON, exportAsMarkdownBundle } from "@/lib/exportChat";
import logoUrl from "@/assets/aura-logo.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aura AI Chat — Multimodal Assistant" },
      {
        name: "description",
        content:
          "Aura AI Chat is a fast, accurate multimodal assistant: chat, vision, and image generation in one beautiful interface.",
      },
      { property: "og:title", content: "Aura AI Chat — Multimodal Assistant" },
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
  { icon: Code2, text: "Build a complete Next.js + Tailwind landing page with hero, features, and contact form — full project structure" },
  { icon: ImageIcon, text: "Generate an image of a cozy reading nook at sunset" },
  { icon: BookOpen, text: "Summarize the plot of Dune in 5 bullets" },
];

const MODEL_KEY = "aura-selected-model-v1";
const SIDEBAR_KEY = "aura-sidebar-collapsed-v1";

function ChatPage() {
  const {
    conversations,
    active,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    renameConversation,
    clearActiveMessages,
    updateActiveMessages,
  } = useConversations();

  const messages = active?.messages ?? [];

  const setMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      updateActiveMessages(updater);
    },
    [updateActiveMessages],
  );

  const { isStreaming, send, stop, regenerate } = useChat({ messages, setMessages });

  const [model, setModel] = useState<string>(loadModel);
  const [exportOpen, setExportOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(loadSidebarCollapsed);

  const scrollRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Persist model selection
  useEffect(() => {
    try {
      localStorage.setItem(MODEL_KEY, model);
    } catch {
      /* ignore */
    }
  }, [model]);

  // Persist sidebar state
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    }
    if (exportOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [exportOpen]);

  const handleSend = (text: string, opts: { images?: string[]; forceImage?: boolean }) =>
    send(text, { ...opts, model });

  const handleRegenerate = (id: string) => regenerate(id, model);

  const handleConfirmClear = () => {
    clearActiveMessages();
    setShowClearConfirm(false);
  };

  const empty = messages.length === 0;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="flex h-dvh w-full">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={createConversation}
        onDelete={deleteConversation}
        onRename={renameConversation}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-card"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                <img src={logoUrl} alt="Aura AI" className="h-full w-full object-contain p-0.5" />
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-semibold tracking-tight">Aura AI Chat</h1>
                <p className="text-[11px] text-muted-foreground">
                  Multimodal · Vision · Image gen
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ModelPicker value={model} onChange={setModel} />

              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  disabled={empty}
                  className="flex h-9 items-center gap-1 rounded-full border border-border bg-card/80 px-3 text-xs font-medium text-foreground backdrop-blur-md transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Export transcript"
                >
                  <Download className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3" />
                </button>
                {exportOpen && !empty && (
                  <div
                    className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                    style={{ boxShadow: "var(--shadow-soft)" }}
                  >
                    <button
                      onClick={async () => {
                        await exportAsMarkdownBundle(messages, active?.title);
                        setExportOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span>Markdown + images</span>
                      <span className="text-[11px] text-muted-foreground">.zip</span>
                    </button>
                    <button
                      onClick={() => {
                        exportAsJSON(messages, active?.title);
                        setExportOpen(false);
                      }}
                      className="flex w-full items-center justify-between border-t border-border px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span>JSON (offline)</span>
                      <span className="text-[11px] text-muted-foreground">.json</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={empty}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30"
                title="Clear chat"
                aria-label="Clear chat"
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
                  className="mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-card"
                  style={{ boxShadow: "var(--shadow-glow)" }}
                >
                  <img src={logoUrl} alt="Aura AI" className="h-full w-full object-contain p-1" />
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
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onRegenerate={handleRegenerate}
                    canRegenerate={!isStreaming && m.id === lastAssistantId}
                  />
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
      </div>

      {/* Clear-chat confirmation dialog */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">Clear this chat?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This permanently deletes the messages in{" "}
                  <span className="font-medium text-foreground">
                    “{active?.title ?? "this chat"}”
                  </span>{" "}
                  from your browser. This can't be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="rounded-lg bg-destructive px-3.5 py-2 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
              >
                Clear chat
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster richColors position="top-center" theme="dark" />
    </div>
  );
}
