import { useState } from "react";
import { Plus, MessageSquare, Trash2, Pencil, Check, X, PanelLeftClose, PanelLeft } from "lucide-react";
import type { Conversation } from "@/hooks/useConversations";

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (c: Conversation) => {
    setEditingId(c.id);
    setDraftTitle(c.title);
  };

  const commitEdit = () => {
    if (editingId) onRename(editingId, draftTitle);
    setEditingId(null);
    setDraftTitle("");
  };

  if (collapsed) {
    return (
      <aside className="flex h-full w-12 flex-col items-center gap-2 border-r border-border/60 bg-card/40 py-3 backdrop-blur-md">
        <button
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onCreate}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition hover:bg-secondary"
          title="New chat"
          aria-label="New chat"
          style={{ background: "var(--gradient-aurora)" }}
        >
          <Plus className="h-4 w-4 text-primary-foreground" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conversations
        </span>
        <button
          onClick={onToggleCollapsed}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-2 py-2">
        <button
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          style={{ background: "var(--gradient-aurora)", boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="scroll-soft flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((c) => {
              const isActive = c.id === activeId;
              const isEditing = editingId === c.id;
              const isConfirming = confirmDeleteId === c.id;
              return (
                <li key={c.id}>
                  <div
                    className={`group flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm transition ${
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setDraftTitle("");
                            }
                          }}
                          className="min-w-0 flex-1 rounded bg-background/60 px-1.5 py-0.5 text-sm text-foreground outline-none ring-1 ring-primary/40"
                        />
                        <button
                          onClick={commitEdit}
                          className="flex h-6 w-6 items-center justify-center rounded text-foreground hover:bg-background/60"
                          title="Save"
                          aria-label="Save name"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setDraftTitle("");
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/60"
                          title="Cancel"
                          aria-label="Cancel rename"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onSelect(c.id)}
                          className="min-w-0 flex-1 truncate text-left"
                          title={c.title}
                        >
                          {c.title || "New chat"}
                        </button>
                        {isConfirming ? (
                          <>
                            <button
                              onClick={() => {
                                onDelete(c.id);
                                setConfirmDeleteId(null);
                              }}
                              className="flex h-6 items-center rounded bg-destructive px-1.5 text-[10px] font-semibold uppercase text-destructive-foreground hover:opacity-90"
                              title="Confirm delete"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/60"
                              title="Cancel"
                              aria-label="Cancel delete"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button
                              onClick={() => startEdit(c)}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/60 hover:text-foreground"
                              title="Rename"
                              aria-label="Rename conversation"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(c.id)}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/60 hover:text-destructive"
                              title="Delete"
                              aria-label="Delete conversation"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
