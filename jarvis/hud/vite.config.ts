import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  server: {
    port: 8787,
    strictPort: true,
  },
  preview: {
    port: 8787,
    strictPort: true,
  },
});
