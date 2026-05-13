// @ts-nocheck
/// <reference lib="deno.ns" />

// Multimodal AI chat: text streaming + image generation via Aura AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEXT_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.2",
]);

const IMAGE_MODEL = "google/gemini-2.5-flash-image";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AURA_API_KEY = Deno.env.get("AURA_API_KEY");
    if (!AURA_API_KEY) throw new Error("AURA_API_KEY not configured");

    const { messages, model, mode } = await req.json();

    // Image generation mode (non-streaming, returns base64 image)
    if (mode === "image") {
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      const prompt =
        typeof lastUser?.content === "string"
          ? lastUser.content
          : (lastUser?.content || []).find((p: any) => p.type === "text")?.text ?? "";

      const resp = await fetch("https://ai.gateway.aura.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AURA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) {
        const status = resp.status;
        const text = await resp.text();
        console.error("Image gen error:", status, text);
        return new Response(
          JSON.stringify({
            error:
              status === 429
                ? "Rate limit exceeded. Please try again shortly."
                : status === 402
                  ? "AI credits exhausted. Please add funds to your Aura workspace."
                  : "Image generation failed.",
          }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await resp.json();
      const imageUrl =
        data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      const text = data.choices?.[0]?.message?.content ?? "";
      return new Response(JSON.stringify({ imageUrl, text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: streaming chat
    const selectedModel =
      model && TEXT_MODELS.has(model) ? model : "google/gemini-3-flash-preview";

    const response = await fetch("https://ai.gateway.aura.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AURA_API_KEY}`,
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI credits exhausted. Please add funds to your Aura workspace.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("Gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
