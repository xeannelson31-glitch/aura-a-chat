import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendlyError";

export type ChatRole = "user" | "assistant";

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string | ChatPart[];
  generatedImage?: string;
  pending?: boolean;
  // Track which model produced this assistant message and whether image was forced
  model?: string;
  forcedImage?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function toGatewayMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    return {
      role: m.role,
      content: m.content.map((p) =>
        p.type === "text"
          ? { type: "text", text: p.text }
          : { type: "image_url", image_url: { url: p.image_url.url } },
      ),
    };
  });
}

function looksLikeImageRequest(text: string) {
  const t = text.toLowerCase().trim();
  return /^(\/(image|img|generate)\b|generate (an? )?image|create (an? )?image|draw (me )?(an? )?|make (an? )?(image|picture|illustration)|picture of|illustration of|render (an? )?image)/.test(
    t,
  );
}

interface UseChatArgs {
  messages: ChatMessage[];
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
}

export function useChat({ messages, setMessages }: UseChatArgs) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Latest messages snapshot for callbacks that need it without re-creating
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // Internal: run a request given an explicit history + user message
  const runRequest = useCallback(
    async (
      history: ChatMessage[],
      userMsg: ChatMessage,
      opts: { model: string; forceImage?: boolean },
    ) => {
      const { model, forceImage } = opts;
      const userText =
        typeof userMsg.content === "string"
          ? userMsg.content
          : userMsg.content
              .filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("\n");
      const userImageCount =
        typeof userMsg.content === "string"
          ? 0
          : userMsg.content.filter((p) => p.type === "image_url").length;

      const wantImage =
        forceImage || (userImageCount === 0 && looksLikeImageRequest(userText));

      // ---- Image generation branch ----
      if (wantImage) {
        const placeholderId = uid();
        setMessages(() => [
          ...history,
          userMsg,
          {
            id: placeholderId,
            role: "assistant",
            content: "Creating your image…",
            pending: true,
            model,
            forcedImage: true,
          },
        ]);
        setIsStreaming(true);

        try {
          const resp = await fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              mode: "image",
              messages: toGatewayMessages([...history, userMsg]),
            }),
          });

          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            const e = new Error(err.error || `Image gen failed (${resp.status})`);
            (e as Error & { status?: number }).status = resp.status;
            throw e;
          }
          const data = (await resp.json()) as { imageUrl: string | null; text?: string };
          if (!data.imageUrl) throw new Error("No image returned.");

          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? {
                    ...m,
                    pending: false,
                    content: data.text?.trim() || "Here's your image:",
                    generatedImage: data.imageUrl!,
                  }
                : m,
            ),
          );
        } catch (e) {
          const status = (e as { status?: number }).status;
          const msg = friendlyError(e, status);
          toast.error("Image generation failed", { description: msg });
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        } finally {
          setIsStreaming(false);
        }
        return;
      }

      // ---- Streaming text branch ----
      const assistantId = uid();
      setMessages(() => [
        ...history,
        userMsg,
        { id: assistantId, role: "assistant", content: "", pending: true, model },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Hoisted so the catch block can access partial output for graceful recovery.
      let assistantText = "";

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: toGatewayMessages([...history, userMsg]),
          }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          const err = await resp.json().catch(() => ({}));
          const e = new Error(err.error || `Request failed (${resp.status})`);
          (e as Error & { status?: number }).status = resp.status;
          throw e;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const { value, done: rd } = await reader.read();
          if (rd) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line || line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (delta) {
                assistantText += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: assistantText, pending: false }
                      : m,
                  ),
                );
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        if (buffer.trim()) {
          for (let raw of buffer.split("\n")) {
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (!raw.startsWith("data: ")) continue;
            const json = raw.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (delta) {
                assistantText += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: assistantText, pending: false }
                      : m,
                  ),
                );
              }
            } catch {
              /* ignore */
            }
          }
        }

        if (!assistantText) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "(no response)", pending: false }
                : m,
            ),
          );
        }
      } catch (e: unknown) {
        if ((e as Error).name === "AbortError") {
          // User stopped the stream — keep any partial text, mark not pending.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content || "_Stopped._",
                    pending: false,
                  }
                : m,
            ),
          );
        } else {
          const status = (e as { status?: number }).status;
          const msg = friendlyError(e, status);
          // Drop the failed/partial assistant message entirely. Retry will
          // re-run the original request fresh (same history, same user message,
          // same model + forceImage) and produce a brand-new response.
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          toast.error("Chat error", {
            description: msg,
            action: {
              label: "Retry",
              onClick: () => {
                void runRequest(history, userMsg, opts);
              },
            },
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [setMessages],
  );

  const send = useCallback(
    async (
      input: string,
      opts: { images?: string[]; model: string; forceImage?: boolean },
    ) => {
      const text = input.trim();
      const { images = [], model, forceImage } = opts;
      if (!text && images.length === 0) return;

      const userParts: ChatPart[] = [];
      if (text) userParts.push({ type: "text", text });
      for (const url of images) userParts.push({ type: "image_url", image_url: { url } });

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: images.length > 0 ? userParts : text,
      };

      await runRequest(messagesRef.current, userMsg, { model, forceImage });
    },
    [runRequest],
  );

  // Regenerate: re-run the last user message, dropping the assistant reply that followed it
  const regenerate = useCallback(
    async (assistantId: string, modelOverride?: string) => {
      if (isStreaming) return;
      const current = messagesRef.current;
      const idx = current.findIndex((m) => m.id === assistantId);
      if (idx <= 0) return;
      const target = current[idx];
      let userIdx = idx - 1;
      while (userIdx >= 0 && current[userIdx].role !== "user") userIdx--;
      if (userIdx < 0) return;

      const history = current.slice(0, userIdx);
      const userMsg = current[userIdx];
      const model = modelOverride || target.model || "google/gemini-3-flash-preview";
      await runRequest(history, userMsg, {
        model,
        forceImage: target.forcedImage,
      });
    },
    [isStreaming, runRequest],
  );

  return { isStreaming, send, stop, regenerate };
}
