import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/hooks/useChat";

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

const STORAGE_KEY = "aura-conversations-v1";
const ACTIVE_KEY = "aura-active-conversation-v1";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function loadAll(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return parsed.map((c) => ({
      ...c,
      messages: (c.messages || []).map((m) => ({ ...m, pending: false })),
    }));
  } catch {
    return [];
  }
}

function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text =
    typeof firstUser.content === "string"
      ? firstUser.content
      : firstUser.content
          .filter((p) => p.type === "text")
          .map((p) => (p as { text: string }).text)
          .join(" ");
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  return trimmed.length > 42 ? trimmed.slice(0, 42) + "…" : trimmed;
}

// SSR-safe stable bootstrap (avoids hydration mismatch).
// Real data is loaded from localStorage in a useEffect after mount.
const BOOTSTRAP_ID = "bootstrap";
const BOOTSTRAP: Conversation = {
  id: BOOTSTRAP_ID,
  title: "New chat",
  createdAt: 0,
  updatedAt: 0,
  messages: [],
};

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([BOOTSTRAP]);
  const [activeId, setActiveId] = useState<string>(BOOTSTRAP_ID);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage AFTER mount so SSR/CSR initial render match.
  useEffect(() => {
    const all = loadAll();
    const stored = loadActiveId();
    if (all.length > 0) {
      setConversations(all);
      setActiveId(stored && all.some((c) => c.id === stored) ? stored : all[0].id);
    } else {
      const now = Date.now();
      const fresh: Conversation = {
        id: uid(),
        title: "New chat",
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      setConversations([fresh]);
      setActiveId(fresh.id);
    }
    setHydrated(true);
  }, []);

  // Make sure activeId always points at a real conversation
  useEffect(() => {
    if (!conversations.find((c) => c.id === activeId) && conversations[0]) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      /* quota — ignore */
    }
  }, [conversations]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const updateActiveMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          const nextMessages = updater(c.messages);
          const titleNeedsUpdate =
            (c.title === "New chat" || !c.title) && nextMessages.length > 0;
          return {
            ...c,
            messages: nextMessages,
            title: titleNeedsUpdate ? deriveTitle(nextMessages) : c.title,
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [activeId],
  );

  const createConversation = useCallback(() => {
    const now = Date.now();
    const newConv: Conversation = {
      id: uid(),
      title: "New chat",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (filtered.length === 0) {
          const now = Date.now();
          const fresh: Conversation = {
            id: uid(),
            title: "New chat",
            createdAt: now,
            updatedAt: now,
            messages: [],
          };
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeId) {
          setActiveId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeId],
  );

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c)),
    );
  }, []);

  const clearActiveMessages = useCallback(() => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, messages: [], title: "New chat", updatedAt: Date.now() }
          : c,
      ),
    );
  }, [activeId]);

  return {
    conversations,
    active,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
    renameConversation,
    clearActiveMessages,
    updateActiveMessages,
  };
}
