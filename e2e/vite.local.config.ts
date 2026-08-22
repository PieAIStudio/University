import { fileURLToPath } from "node:url";

import appConfig from "../apps/local/vite.config.ts";

/**
 * The authoring shell pins 9999 → 4317. This suite must not take those, so
 * the e2e launcher feeds Vite a different listen port and a matching API
 * proxy. The app config is otherwise unchanged.
 *
 * Do not `import { defineConfig } from "vite"` here: this file lives outside
 * the app package, and the workspace root does not depend on Vite.
 */
const base = appConfig;

export default {
  ...base,
  root: fileURLToPath(new URL("../apps/local", import.meta.url)),
  server: {
    ...base.server,
    host: "127.0.0.1",
    port: Number(process.env.E2E_LOCAL_WEB_PORT ?? 18094),
    strictPort: true,
    proxy: {
      "/api": process.env.E2E_LOCAL_API_ORIGIN ?? "http://127.0.0.1:18095",
    },
  },
};
