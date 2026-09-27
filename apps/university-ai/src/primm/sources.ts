import { PreviewFailure } from "./errors.js";

// Approved-source search. This is deliberately not an open-web search tool.
export const APPROVED_NASA_URLS = new Set([
  "https://www.nasa.gov/image-article/apollo-8-astronaut-bill-anders-captures-earthrise/",
  "https://www.nasa.gov/news-release/celebrate-international-observe-the-moon-night-with-nasa/",
  "https://www.nasa.gov/news-release/celebrate-international-observe-the-moon-night-at-nasas-goddard-space-flight-center/",
]);

/** Inert extraction only: no DOM execution, resource loads, links or embedded instructions. */
export function articleText(html: string): string {
  const clean = html
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<(script|style|nav|footer|header|noscript|svg|iframe)\b[^>]*>[^]*?<\/\1\s*>/gi, " ");
  const article =
    /<article\b[^>]*>([^]*?)<\/article>/i.exec(clean)?.[1] ??
    /<main\b[^>]*>([^]*?)<\/main>/i.exec(clean)?.[1];
  if (!article) throw new PreviewFailure("unavailable", 503);
  const result = article
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&(nbsp|amp|lt|gt|quot|apos);/g,
      (_, key: string) => ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[key]!,
    )
    .replace(/&#(\d{1,7});/g, (_, code: string) =>
      Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!result) throw new PreviewFailure("unavailable", 503);
  return result.slice(0, 12_000);
}
export async function fetchApprovedSource(
  url: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<{ text: string; fetchedAt: string }> {
  let current = url;
  const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  for (let redirects = 0; redirects <= 2; redirects++) {
    if (!APPROVED_NASA_URLS.has(current)) throw new PreviewFailure("rejected");
    const response = await fetchImpl(current, {
      redirect: "manual",
      signal: boundedSignal,
      headers: { Accept: "text/html" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const target = new URL(response.headers.get("location") ?? "", current).href;
      if (!APPROVED_NASA_URLS.has(target)) throw new PreviewFailure("rejected");
      current = target;
      continue;
    }
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html") ||
      !response.body
    )
      throw new PreviewFailure("unavailable", 503);
    if (Number(response.headers.get("content-length")) > 1024 * 1024) {
      await response.body.cancel();
      throw new PreviewFailure("rejected");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 1024 * 1024) throw new PreviewFailure("rejected");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }
    return {
      text: articleText(Buffer.concat(chunks).toString("utf8")),
      fetchedAt: new Date().toISOString(),
    };
  }
  throw new PreviewFailure("rejected");
}
