import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      // Lotex backend (hono-app.ts) — `/api/*` so'rovlarni shu yerga proxy qilamiz.
      // Base url server tomonda o'qiladi, frontendga sizib chiqmaydi va CORS kerak bo'lmaydi.
      proxy: {
        "/api": {
          target: env.LOTEX_BASE_URL ?? "http://localhost:4040",
          changeOrigin: true,
          // /api/ws/* — WebSocket upgrade'larni ham backendga proxy qilamiz.
          ws: true,
        },
      },
    },
  };
});
