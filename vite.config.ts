import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@jsquash/png", "@jsquash/jpeg", "@jsquash/webp"],
  },
  test: {
    environment: "node",
  },
});
