/**
 * Development-only Node loader for the University's source-first TypeScript
 * modules. The world package keeps `.js` import specifiers so Vite and the
 * browser build agree; Node's built-in type stripping needs this tiny resolver
 * to map those specifiers back to `.ts` files during an offline export.
 */
import { access } from "node:fs/promises";
import { dirname, extname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith(".") || specifier.startsWith("/")) && specifier.endsWith(".js")) {
    const parent = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
    const candidate = specifier.startsWith("/") ? specifier : resolvePath(parent, specifier);
    if (extname(candidate) === ".js") {
      for (const extension of [".ts", ".tsx", ".js"]) {
        const path = `${candidate.slice(0, -3)}${extension}`;
        try {
          await access(path);
          return { url: pathToFileURL(path).href, shortCircuit: true };
        } catch {
          // Try the next source extension.
        }
      }
    }
  }
  return nextResolve(specifier, context);
}
