import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const plugins = [];
if (process.env.VERCEL) {
  try {
    // Dynamic import to avoid crash in non-Vercel environments without nitro installed
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro());
  } catch (e) {
    console.error("Failed to load nitro/vite:", e);
  }
}

export default defineConfig({
  cloudflare: process.env.VERCEL ? false : undefined,
  plugins
});

