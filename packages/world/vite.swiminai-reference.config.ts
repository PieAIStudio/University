import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export default defineConfig({
  root: resolve(root, "tools/swiminai-islands"),
  resolve: {
    alias: {
      react: resolve(root, "packages/world/node_modules/react"),
      "react-dom": resolve(root, "packages/world/node_modules/react-dom"),
      three: resolve(root, "packages/world/node_modules/three"),
      "@react-three/fiber": resolve(root, "packages/world/node_modules/@react-three/fiber"),
      "@react-three/drei": resolve(root, "packages/world/node_modules/@react-three/drei"),
      "@pieai/swimmer-render-kit/guard": resolve(
        root,
        "packages/world/node_modules/@pieai/swimmer-render-kit/dist/guard.js",
      ),
      "@pieai/swimmer-render-kit/shader": resolve(
        root,
        "packages/world/node_modules/@pieai/swimmer-render-kit/dist/shader.js",
      ),
      "@pieai/swimmer-render-kit": resolve(
        root,
        "packages/world/node_modules/@pieai/swimmer-render-kit/dist/index.js",
      ),
    },
  },
  server: {
    port: 4321,
    strictPort: false,
  },
  build: {
    outDir: resolve(root, "SCRATCH/swiminai-island-reference"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(root, "tools/swiminai-islands/reference.html"),
    },
  },
});
