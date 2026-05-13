import { createServerFn } from "@tanstack/react-start";

// Define the input type
export interface ChatInput {
  messages: any[];
  model: string;
  mode?: "chat" | "image";
}

// Server function for chat operations
// Using .inputValidator() which is the correct method name in this version
export const chatFn = createServerFn({ method: "POST" })
  .inputValidator((data: ChatInput) => data)
  .handler(async ({ data }) => {
    const { messages, model, mode } = data;
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const IMAGE_MODEL = "google/gemini-2.5-flash-image";
    const TEXT_MODELS = new Set([
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5.2",
    ]);

    if (mode === "image") {
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      const prompt =
        typeof lastUser?.content === "string"
          ? lastUser.content
          : (lastUser?.content || []).find((p: any) => p.type === "text")?.text ?? "";

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Image generation failed: ${resp.status}` }), {
          status: resp.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      const resData = await resp.json();
      return new Response(
        JSON.stringify({
          imageUrl: resData.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null,
          text: resData.choices?.[0]?.message?.content ?? "",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const selectedModel =
      model && TEXT_MODELS.has(model) ? model : "google/gemini-3-flash-preview";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: "system",
            content:
              "You are Aura, a helpful, accurate, multimodal AI assistant. Be concise yet thorough. Use Markdown formatting (headings, lists, code fences with language tags) when it improves clarity. When the user shares an image, analyze it carefully and ground your answer in what you actually see. If the user asks you to generate or create an image, briefly acknowledge and tell them you'll create it — the system handles image generation separately.\n\nWhen the user asks for code or to build something:\n- Identify the full stack involved (framework, language, build tool, package manager, runtime, database, styling, etc.) and state it briefly up front.\n- Provide COMPLETE, runnable code — never truncate, never use ellipses or '...rest of the code' placeholders. Include every file the user needs.\n- Lay out the project structure as a file tree first, then output each file in its own fenced code block, with the file path on the line immediately before the block (e.g. `// src/App.tsx`).\n- Include all relevant languages and config: package.json/requirements.txt, tsconfig, vite/webpack/next config, .env.example, Dockerfile if relevant, README with run instructions.\n- For frontend work: include HTML/CSS/JS/TS as needed. For backend: include routes, handlers, schemas, migrations. For full-stack: cover both, plus how they wire together.\n- End with exact commands to install and run the project (`npm install && npm run dev`, etc.).\n- If the request is ambiguous, make a sensible default choice and call it out — don't ask follow-ups before delivering working code.",
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return response;
  });
