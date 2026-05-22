import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const plugins = [];
if (process.env.NETLIFY) {
  try {
    // Dynamic import to avoid crash in non-Netlify environments without Netlify plugin installed
    const netlify = (await import("@netlify/vite-plugin-tanstack-start")).default;
    plugins.push(netlify());
  } catch (e) {
    console.error("Failed to load @netlify/vite-plugin-tanstack-start:", e);
  }
} else if (process.env.VERCEL) {
  try {
    // Dynamic import to avoid crash in non-Vercel environments without nitro installed
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro());
  } catch (e) {
    console.error("Failed to load nitro/vite:", e);
  }
}

export default defineConfig({
  cloudflare: (process.env.VERCEL || process.env.NETLIFY) ? false : undefined,
  plugins
});


