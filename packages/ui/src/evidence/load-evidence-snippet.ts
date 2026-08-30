import { translate } from "../i18n/index.js";
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

/**
 * Two suppliers, one reader. The authoring shell passes a URL prefix and the
 * local API serves `${basePath}/evidence/${index}`. The delivery shell has no
 * such API: import bakes content-addressed JSON, so it passes a resolver that
 * loads the file for that index. The component does not care which.
 */
type EvidenceSnippetResolver = (index: number) => Promise<EvidenceSnippetView>;
export type EvidenceSource = string | EvidenceSnippetResolver;

const cache = new Map<string, Promise<LoadedEvidenceSnippet>>();
const resolverIds = new WeakMap<EvidenceSnippetResolver, string>();
let nextResolverId = 0;

function evidenceSnippetCacheKey(source: EvidenceSource, index: number): string {
  if (typeof source === "string") return `${source}\0${index}`;
  let id = resolverIds.get(source);
  if (id === undefined) {
    id = `resolver:${nextResolverId}`;
    nextResolverId += 1;
    resolverIds.set(source, id);
  }
  return `${id}\0${index}`;
}

async function readSnippet(source: EvidenceSource, index: number): Promise<EvidenceSnippetView> {
  if (typeof source === "function") return source(index);
  return readJson<EvidenceSnippetView>(await fetch(`${source}/evidence/${index}`));
}

/**
 * Loads a windowed evidence snippet and highlights it. Results are cached by
 * supplier + evidence index so a lesson that cites the same anchor twice does
 * not hit the network twice.
 */
export function loadEvidenceSnippet(
  source: EvidenceSource,
  index: number,
): Promise<LoadedEvidenceSnippet> {
  const key = evidenceSnippetCacheKey(source, index);
  let pending = cache.get(key);
  if (!pending) {
    pending = (async (): Promise<LoadedEvidenceSnippet> => {
      try {
        const snippet = await readSnippet(source, index);
        const tokens = await highlightEvidenceCode(snippet.code, snippet.language);
        return { ok: true, snippet, tokens };
      } catch (reason) {
        return {
          ok: false,
          message:
            reason instanceof Error
              ? reason.message
              : translate("ui.evidence.loadevidencesnippet.copy.无法读取固定源码"),
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
