import JSZip from "jszip";
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

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function download(filename: string, content: string, mime: string) {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

function safeSlug(s: string) {
  return s
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40) || "aura-chat";
}

/**
 * Convert a data URL or remote URL to a Blob. Remote URLs are fetched.
 * Returns null on failure.
 */
async function urlToBlob(url: string): Promise<{ blob: Blob; ext: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
      if (!match) return null;
      const mime = match[1] || "application/octet-stream";
      const isB64 = !!match[2];
      const data = match[3];
      let blob: Blob;
      if (isB64) {
        const bin = atob(data);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        blob = new Blob([decodeURIComponent(data)], { type: mime });
      }
      return { blob, ext: extFromMime(mime) };
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return { blob, ext: extFromMime(blob.type) };
  } catch {
    return null;
  }
}

function extFromMime(mime: string) {
  if (!mime) return "bin";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "bin";
}

/**
 * JSON export — fully offline. Embeds attached & generated images as data URLs
 * (they're already data URLs in most cases since they came from the user upload
 * or our image-gen endpoint).
 */
export function exportAsJSON(messages: ChatMessage[], chatTitle?: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = safeSlug(chatTitle ?? "aura-chat");
  download(
    `${slug}-${stamp}.json`,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: "Aura AI Chat",
        title: chatTitle ?? "Aura AI Chat",
        messages,
      },
      null,
      2,
    ),
    "application/json",
  );
}

/**
 * Markdown export — bundles a transcript.md plus an /images folder
 * inside a single .zip so the export works offline. Attached and generated
 * images are saved as separate files and referenced via relative paths.
 */
export async function exportAsMarkdownBundle(
  messages: ChatMessage[],
  chatTitle?: string,
) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = safeSlug(chatTitle ?? "aura-chat");

  const zip = new JSZip();
  const imagesDir = zip.folder("images")!;
  const lines: string[] = [
    `# ${chatTitle ?? "Aura AI Chat Transcript"}`,
    "",
    `_Exported ${new Date().toLocaleString()}_`,
    "",
    `---`,
    "",
  ];

  let imgCounter = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const who = m.role === "user" ? "🧑 User" : "✨ Assistant";
    lines.push(`## ${who}${m.model ? ` _(${m.model})_` : ""}`);
    lines.push("");
    const text = messageText(m).trim();
    if (text) {
      lines.push(text);
      lines.push("");
    }

    // Attached images on user messages
    for (const url of messageImages(m)) {
      imgCounter++;
      const result = await urlToBlob(url);
      if (result) {
        const name = `images/attachment-${i + 1}-${imgCounter}.${result.ext}`;
        imagesDir.file(name.split("/").pop()!, result.blob);
        lines.push(`![attachment](${name})`);
      } else {
        lines.push(`_[attachment could not be embedded]_`);
      }
      lines.push("");
    }

    // Generated images on assistant messages
    if (m.generatedImage) {
      imgCounter++;
      const result = await urlToBlob(m.generatedImage);
      if (result) {
        const name = `images/generated-${i + 1}-${imgCounter}.${result.ext}`;
        imagesDir.file(name.split("/").pop()!, result.blob);
        lines.push(`![generated](${name})`);
      } else {
        lines.push(`_[generated image could not be embedded]_`);
      }
      lines.push("");
    }

    lines.push(`---`, "");
  }

  zip.file("transcript.md", lines.join("\n"));

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${slug}-${stamp}.zip`, blob);
}
