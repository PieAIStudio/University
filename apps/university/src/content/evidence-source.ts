/**
 * How the delivery shell supplies baked evidence to the shared reader.
 *
 * The authoring shell passes a URL prefix and the reader fetches
 * `${basePath}/evidence/${index}`. Import writes content-addressed JSON
 * instead, the same split the screenshots already use, so that prefix does
 * not fit. The honest change is the same prop accepting a resolver.
 */
import { translate } from "@pieai/university-ui/i18n.js";
import type { EvidenceSnippetView } from "@pieai/university-ui";

export type EvidenceSnippetResolver = (index: number) => Promise<EvidenceSnippetView>;

export function evidenceSourceOf(
  evidence: readonly { readonly snippetUrl?: string }[],
): EvidenceSnippetResolver | undefined {
  if (!evidence.some((item) => typeof item.snippetUrl === "string" && item.snippetUrl.length > 0)) {
    return undefined;
  }
  return async (index) => {
    const url = evidence[index]?.snippetUrl;
    if (!url) throw new Error(translate("app.content.evidencesource.copy.这条证据没有烘焙源码"));
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(
        translate("app.content.evidencesource.copy.无法读取固定源码-value0", {
          value0: response.status,
        }),
      );
    return (await response.json()) as EvidenceSnippetView;
  };
}
