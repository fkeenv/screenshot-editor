import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ["@jsquash/png", "@jsquash/jpeg", "@jsquash/webp"],
  },
  test: {
    environment: "node",
  },
});
