import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/setupTests.ts"],
    server: {
      deps: {
        // Force ESM packages through Vite's transform pipeline
        // so they don't hit Node's require() path
        inline: ["msw", "@mswjs/interceptors"],
      },
    },
  },
});
