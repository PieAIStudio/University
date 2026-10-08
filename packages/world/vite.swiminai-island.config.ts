import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export default defineConfig({
  build: {
    outDir: resolve(root, "tools/swiminai-islands/render-dist"),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(root, "packages/world/src/island/swiminai-island-render.tsx"),
      formats: ["es"],
      fileName: () => "swiminai-island-render.js",
    },
    rollupOptions: {
      // The website supplies one aligned React/R3F/Three runtime. Keep every
      // package import external so the copied artifact cannot ship a second
      // renderer or a second React context.
      external: (id) =>
        id === "three" ||
        id === "react" ||
        id.startsWith("react/") ||
        id === "react-dom" ||
        id.startsWith("react-dom/") ||
        id.startsWith("@react-three/") ||
        id.startsWith("@pieai/"),
    },
  },
});
