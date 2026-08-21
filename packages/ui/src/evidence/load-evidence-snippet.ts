import { readJson } from "../api/client.js";
import type { EvidenceSnippetView, EvidenceToken } from "../view/lesson-view.js";
import { highlightEvidenceCode } from "../view/lesson-view.js";

type LoadedEvidenceSnippet =
  | {
      readonly ok: true;
      readonly snippet: EvidenceSnippetView;
      readonly tokens: readonly (readonly EvidenceToken[])[];
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

const cache = new Map<string, Promise<LoadedEvidenceSnippet>>();

function evidenceSnippetCacheKey(basePath: string, index: number): string {
  return `${basePath}\0${index}`;
}

/**
 * Fetches a windowed evidence snippet and highlights it. Results are cached by
 * base path + evidence index so a lesson that cites the same anchor twice does
 * not hit the network twice.
 */
export function loadEvidenceSnippet(
  basePath: string,
  index: number,
): Promise<LoadedEvidenceSnippet> {
  const key = evidenceSnippetCacheKey(basePath, index);
  let pending = cache.get(key);
  if (!pending) {
    pending = (async (): Promise<LoadedEvidenceSnippet> => {
      try {
        const snippet = await readJson<EvidenceSnippetView>(
          await fetch(`${basePath}/evidence/${index}`),
        );
        const tokens = await highlightEvidenceCode(snippet.code, snippet.language);
        return { ok: true, snippet, tokens };
      } catch (reason) {
        return {
          ok: false,
          message: reason instanceof Error ? reason.message : "无法读取固定源码",
        };
      }
    })();
    cache.set(key, pending);
  }
  return pending;
}

/** Clears the module cache. Used by tests between cases. */
export function clearEvidenceSnippetCache(): void {
  cache.clear();
}
