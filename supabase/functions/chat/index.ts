// Multimodal AI chat: text streaming + image generation.
// Supports multiple providers via prefixed model IDs:
//   "google/..."         → Lovable AI Gateway (default)
//   "openai/..."         → Lovable AI Gateway
//   "groq/<model>"       → Groq API direct (GROQ_API_KEY)
//   "openai-direct/<m>"  → OpenAI API direct (OPENAI_API_KEY)
//   "gemini-direct/<m>"  → Google Gemini OpenAI-compat (GEMINI_API_KEY)
//   "zai/<m>"            → Z.ai OpenAI-compat (ZAI_API_KEY)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_TEXT_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.2",
]);

const IMAGE_MODEL = "google/gemini-2.5-flash-image";

const SYSTEM_PROMPT =
  "You are Aura, a helpful, accurate, multimodal AI assistant. Be concise yet thorough. Use Markdown formatting (headings, lists, code fences with language tags) when it improves clarity. When the user shares an image, analyze it carefully and ground your answer in what you actually see. If the user asks you to generate or create an image, briefly acknowledge and tell them you'll create it — the system handles image generation separately.\n\nWhen the user asks for code or to build something:\n- Identify the full stack involved (framework, language, build tool, package manager, runtime, database, styling, etc.) and state it briefly up front.\n- Provide COMPLETE, runnable code — never truncate, never use ellipses or '...rest of the code' placeholders. Include every file the user needs.\n- Lay out the project structure as a file tree first, then output each file in its own fenced code block, with the file path on the line immediately before the block (e.g. `// src/App.tsx`).\n- Include all relevant languages and config: package.json/requirements.txt, tsconfig, vite/webpack/next config, .env.example, Dockerfile if relevant, README with run instructions.\n- For frontend work: include HTML/CSS/JS/TS as needed. For backend: include routes, handlers, schemas, migrations. For full-stack: cover both, plus how they wire together.\n- End with exact commands to install and run the project (`npm install && npm run dev`, etc.).\n- If the request is ambiguous, make a sensible default choice and call it out — don't ask follow-ups before delivering working code.";

interface ProviderRoute {
  url: string;
  apiKey: string | undefined;
  apiKeyName: string;
  model: string;
}

function resolveProvider(modelId: string): ProviderRoute {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (modelId.startsWith("groq/")) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: Deno.env.get("GROQ_API_KEY"),
      apiKeyName: "GROQ_API_KEY",
      model: modelId.slice("groq/".length),
    };
  }
  if (modelId.startsWith("openai-direct/")) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: Deno.env.get("OPENAI_API_KEY"),
      apiKeyName: "OPENAI_API_KEY",
      model: modelId.slice("openai-direct/".length),
    };
  }
  if (modelId.startsWith("gemini-direct/")) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: Deno.env.get("GEMINI_API_KEY"),
      apiKeyName: "GEMINI_API_KEY",
      model: modelId.slice("gemini-direct/".length),
    };
  }
  if (modelId.startsWith("zai/")) {
    return {
      url: "https://api.z.ai/api/paas/v4/chat/completions",
      apiKey: Deno.env.get("ZAI_API_KEY"),
      apiKeyName: "ZAI_API_KEY",
      model: modelId.slice("zai/".length),
    };
  }
  // Default to Lovable AI Gateway
  const safe = LOVABLE_TEXT_MODELS.has(modelId)
    ? modelId
    : "google/gemini-3-flash-preview";
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: lovableKey,
    apiKeyName: "LOVABLE_API_KEY",
    model: safe,
  };
}

function errorBody(status: number, fallback: string) {
  if (status === 429) return "Rate limit exceeded. Please try again shortly.";
  if (status === 402)
    return "AI credits exhausted. Please add funds to your workspace.";
  if (status === 401 || status === 403)
    return "Provider rejected the API key. Please check the configured key.";
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, mode } = await req.json();

    // ---- Image generation mode (Lovable Gateway only) ----
    if (mode === "image") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
        const status = resp.status;
        const text = await resp.text();
        console.error("Image gen error:", status, text);
        return new Response(
          JSON.stringify({ error: errorBody(status, "Image generation failed.") }),
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

    // ---- Streaming chat (provider-routed) ----
    const route = resolveProvider(model || "google/gemini-3-flash-preview");
    if (!route.apiKey) {
      return new Response(
        JSON.stringify({
          error: `${route.apiKeyName} is not configured for this provider.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch(route.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${route.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: route.model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text().catch(() => "");
      console.error("Provider error:", route.url, response.status, t);
      return new Response(
        JSON.stringify({ error: errorBody(response.status, "AI provider error.") }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
