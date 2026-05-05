import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export type ChatRole = "user" | "assistant";

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  // For UI: a string for assistant text, or an array of parts (user with images)
  content: string | ChatPart[];
  // Generated image attached to an assistant reply
  generatedImage?: string;
  pending?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Strip generated images & convert UI messages to gateway-compatible payload
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

// Heuristic: should we route to image generation?
function looksLikeImageRequest(text: string) {
  const t = text.toLowerCase().trim();
  return /^(\/(image|img|generate)\b|generate (an? )?image|create (an? )?image|draw (me )?(an? )?|make (an? )?(image|picture|illustration)|picture of|illustration of|render (an? )?image)/.test(
    t,
  );
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
  }, [stop]);

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

      // snapshot history BEFORE adding the user message
      const history = messages;
      setMessages((prev) => [...prev, userMsg]);

      const wantImage = forceImage || (images.length === 0 && looksLikeImageRequest(text));

      // ---- Image generation branch ----
      if (wantImage) {
        const placeholderId = uid();
        setMessages((prev) => [
          ...prev,
          { id: placeholderId, role: "assistant", content: "Creating your image…", pending: true },
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
            throw new Error(err.error || `Image gen failed (${resp.status})`);
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
          const msg = e instanceof Error ? e.message : "Something went wrong";
          toast.error(msg);
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        } finally {
          setIsStreaming(false);
        }
        return;
      }

      // ---- Streaming text branch ----
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", pending: true },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

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
          throw new Error(err.error || `Request failed (${resp.status})`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
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
              // partial JSON across chunks
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        // flush
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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.content
                ? { ...m, content: "_Stopped._", pending: false }
                : m,
            ),
          );
        } else {
          const msg = e instanceof Error ? e.message : "Something went wrong";
          toast.error(msg);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages],
  );

  return { messages, isStreaming, send, stop, reset };
}
