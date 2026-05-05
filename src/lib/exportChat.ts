import type { ChatMessage } from "@/hooks/useChat";

function messageText(m: ChatMessage): string {
  if (typeof m.content === "string") return m.content;
  return m.content
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");
}

function messageImages(m: ChatMessage): string[] {
  if (typeof m.content === "string") return [];
  return m.content
    .filter((p) => p.type === "image_url")
    .map((p) => (p as { image_url: { url: string } }).image_url.url);
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportAsJSON(messages: ChatMessage[]) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  download(
    `aura-chat-${stamp}.json`,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: "Aura AI Chat",
        messages,
      },
      null,
      2,
    ),
    "application/json",
  );
}

export function exportAsMarkdown(messages: ChatMessage[]) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines: string[] = [`# Aura AI Chat Transcript`, ``, `_Exported ${new Date().toLocaleString()}_`, ``, `---`, ``];

  for (const m of messages) {
    const who = m.role === "user" ? "🧑 User" : "✨ Assistant";
    lines.push(`## ${who}${m.model ? ` _(${m.model})_` : ""}`);
    lines.push("");
    const text = messageText(m).trim();
    if (text) {
      lines.push(text);
      lines.push("");
    }
    const imgs = messageImages(m);
    for (const url of imgs) {
      const short = url.startsWith("data:") ? "(attached image)" : url;
      lines.push(`![attachment](${short})`);
      lines.push("");
    }
    if (m.generatedImage) {
      const short = m.generatedImage.startsWith("data:")
        ? "(generated image)"
        : m.generatedImage;
      lines.push(`![generated](${short})`);
      lines.push("");
    }
    lines.push(`---`, ``);
  }

  download(`aura-chat-${stamp}.md`, lines.join("\n"), "text/markdown");
}
