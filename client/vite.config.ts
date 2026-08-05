import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  optimizeDeps: {
    // workspace-linked package ships CommonJS output — force it through esbuild's
    // CJS-interop pre-bundling instead of being served as raw CJS to the browser's ESM loader.
    include: ["@watch-recommender/shared"],
  },
});
