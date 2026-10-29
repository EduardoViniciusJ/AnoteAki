import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  // assetsInlineLimit: 0 — um asset pequeno viraria `data:` URI embutida no JS;
  // com a CSP restritiva, todo asset vira arquivo servido de 'self'.
  build: { target: "es2022", assetsInlineLimit: 0 },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], restoreMocks: true },
});
