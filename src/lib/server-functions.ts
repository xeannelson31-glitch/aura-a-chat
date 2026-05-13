import { createServerFn } from "@tanstack/react-start";

// Define the input type
export interface ChatInput {
  messages: any[];
  model: string;
  mode?: "chat" | "image";
}

// Server function for chat operations
export const chatFn = createServerFn({ method: "POST" })
  .inputValidator((data: ChatInput) => data)
  .handler(async ({ data }) => {
    const { messages, model, mode } = data;
    
    const AURA_API_KEY = process.env.AURA_API_KEY;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ZAI_API_KEY = process.env.ZAI_API_KEY;

    const IMAGE_MODEL = "google/gemini-2.5-flash-image";
    
    const TEXT_MODELS = new Set([
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "openai/gpt-5",
      "openai/gpt-5-mini",
      "openai/gpt-5.2",
      "groq/llama-3.3-70b-versatile",
      "groq/mixtral-8x7b-32768",
      "zai/glm-5.1",
      "zai/glm-4.7-flash",
    ]);

    const selectedModel = model && TEXT_MODELS.has(model) ? model : "google/gemini-3-flash-preview";
    const provider = selectedModel.split('/')[0];
    const providerModel = selectedModel.split('/').slice(1).join('/');

    // Logic: Use provider key directly if available, otherwise fallback to Aura Gateway
    let apiKey = "";
    let apiUrl = "https://ai.gateway.aura.dev/v1/chat/completions";

    if (provider === "google" && GOOGLE_API_KEY) {
      apiKey = GOOGLE_API_KEY;
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
    } else if (provider === "groq" && GROQ_API_KEY) {
      apiKey = GROQ_API_KEY;
      apiUrl = "https://api.groq.com/openai/v1/chat/completions";
    } else if (provider === "openai" && OPENAI_API_KEY) {
      apiKey = OPENAI_API_KEY;
      apiUrl = "https://api.openai.com/v1/chat/completions";
    } else if (provider === "zai" && ZAI_API_KEY) {
      apiKey = ZAI_API_KEY;
      apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    } else if (AURA_API_KEY) {
      apiKey = AURA_API_KEY;
      // apiUrl stays default Aura Gateway
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: `API key for ${provider} not configured` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle Image Generation
    if (mode === "image") {
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      const prompt =
        typeof lastUser?.content === "string"
          ? lastUser.content
          : (lastUser?.content || []).find((p: any) => p.type === "text")?.text ?? "";

      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider === "google" ? IMAGE_MODEL : providerModel, // Fallback if direct provider used
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

    // Handle Chat
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: apiUrl.includes("aura") ? selectedModel : providerModel,
        messages: [
          {
            role: "system",
            content: "You are Aura, a helpful, accurate, multimodal AI assistant. Be concise yet thorough. Use Markdown formatting when it improves clarity.",
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `AI error (${response.status}): ${errorText}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return response;
  });
