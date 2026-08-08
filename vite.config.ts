import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 9999,
    // Silently moving to 5174 would leave the campus at an address the user did
    // not bookmark, so a taken port fails loudly instead. `scripts/dev.mjs`
    // checks both ports up front and explains what to do.
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4317",
    },
  },
});
