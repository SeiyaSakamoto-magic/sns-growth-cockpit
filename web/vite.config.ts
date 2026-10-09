import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" で相対パス配信 → ローカルでも Cloudflare Pages のサブパスでも動く
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5275 },
});
