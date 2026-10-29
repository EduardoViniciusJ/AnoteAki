import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  // assetsInlineLimit: 0 — a small asset would become a `data:` URI inside the JS;
  // with the strict CSP, every asset must be a file served from 'self'.
  build: { target: "es2022", assetsInlineLimit: 0 },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], restoreMocks: true },
});
