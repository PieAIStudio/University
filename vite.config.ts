import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    // UniversityLocal owns 9999. A different fixed port keeps both campuses
    // open at once, and strictPort makes a collision fail loudly instead of
    // silently moving the product to an address nobody bookmarked.
    port: 9998,
    strictPort: true,
  },
});
