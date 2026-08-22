// Turn user-picked files into chat parts the AI can actually reason about.
//  - images        -> image_url part (vision)
//  - audio         -> input_audio part (transcription / Q&A)
//  - pdf           -> file part (native document understanding)
//  - docx/pptx/xlsx-> text extracted in-browser from the OOXML zip
//  - text/code     -> inlined as a fenced code block

import JSZip from "jszip";
import type { ChatPart } from "@/hooks/useChat";

export type AttachmentKind = "image" | "audio" | "pdf" | "document" | "text";

export interface Attachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  /** object/data URL for image thumbnails */
  previewUrl?: string;
  part: ChatPart;
}

export const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000;

const TEXT_EXT = new Set([
  "txt","md","markdown","json","jsonc","csv","tsv","yaml","yml","toml","ini","env","log","xml","html","htm","css","scss","less",
  "js","jsx","ts","tsx","mjs","cjs","py","rb","go","rs","java","kt","swift","c","h","cpp","hpp","cs","php","sh","bash","zsh",
  "sql","graphql","gql","vue","svelte","dockerfile","gitignore","prisma",
]);

const AUDIO_FORMATS: Record<string, string> = {
  mp3: "mp3", wav: "wav", webm: "webm", m4a: "m4a", mp4: "m4a", ogg: "ogg", oga: "ogg", aac: "aac", flac: "flac",
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function clamp(text: string, name: string) {
  if (text.length <= MAX_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_CHARS)}\n\n…[${name} truncated at ${MAX_TEXT_CHARS} characters]`;
}

/** Strip XML tags, keeping paragraph/row/cell boundaries readable. */
function xmlToText(xml: string) {
  return xml
    .replace(/<\/w:p>|<\/a:p>|<\/w:tr>|<\/row>/g, "\n")
    .replace(/<\/w:tc>|<\/a:tc>|<\/c>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function ooxmlToText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const e = ext(file.name);

  let names: string[] = [];
  if (e === "docx") {
    names = ["word/document.xml"];
  } else if (e === "pptx") {
    names = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  } else {
    // xlsx: shared strings + every sheet
    names = ["xl/sharedStrings.xml", ...Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))];
  }

  const chunks: string[] = [];
  for (const n of names) {
    const f = zip.file(n);
    if (!f) continue;
    chunks.push(xmlToText(await f.async("string")));
  }
  const out = chunks.filter(Boolean).join("\n\n");
  if (!out) throw new Error("no readable text");
  return out;
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const e = ext(file.name);
  const base = { id: uid(), name: file.name, size: file.size };

  if (file.type.startsWith("image/")) {
    const url = await readAsDataUrl(file);
    return { ...base, kind: "image", previewUrl: url, part: { type: "image_url", image_url: { url } } };
  }

  if (file.type.startsWith("audio/") || AUDIO_FORMATS[e]) {
    const dataUrl = await readAsDataUrl(file);
    return {
      ...base,
      kind: "audio",
      part: {
        type: "input_audio",
        input_audio: { data: dataUrl.split(",")[1] ?? "", format: AUDIO_FORMATS[e] ?? "webm" },
      },
    };
  }

  if (e === "pdf" || file.type === "application/pdf") {
    const dataUrl = await readAsDataUrl(file);
    return {
      ...base,
      kind: "pdf",
      part: { type: "file", file: { filename: file.name, file_data: dataUrl } },
    };
  }

  if (e === "docx" || e === "pptx" || e === "xlsx") {
    const text = await ooxmlToText(file);
    return {
      ...base,
      kind: "document",
      part: {
        type: "text",
        text: clamp(`Attached document \`${file.name}\` (extracted text):\n\n${text}`, file.name),
      },
    };
  }

  if (file.type.startsWith("text/") || TEXT_EXT.has(e) || file.size < 512 * 1024) {
    const text = await file.text();
    const lang = TEXT_EXT.has(e) ? e : "";
    return {
      ...base,
      kind: "text",
      part: {
        type: "text",
        text: clamp(`Attached file \`${file.name}\`:\n\n\`\`\`${lang}\n${text}\n\`\`\``, file.name),
      },
    };
  }

  throw new Error("Unsupported file type");
}
