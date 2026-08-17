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
    /*
      `studies/` is learner data, not source, and nothing in it is imported by
      the app — the server reads it and serves JSON. Watching it was harmless
      until `snapshot open` began materialising a whole checkout of the studied
      project in there: thousands of files appearing at once made Vite full-
      reload the page, which threw away the state of the very click that had
      asked for the checkout, so the button appeared to do nothing while
      quietly succeeding every time.
    */
    watch: { ignored: ["**/studies/**"] },
    proxy: {
      "/api": "http://127.0.0.1:4317",
    },
  },
});
