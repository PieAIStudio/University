/**
 * URL-backed evidence: a public authority page, not a git pin.
 *
 * Repository evidence stays a snapshot + path + lines, because that is how a
 * claim about *this* codebase is checked. General courses have no repository,
 * so they need a second type — not optional `sourceUrl` on the git shape.
 * Optional fields would let a citation carry a URL *or* a path and leave
 * callers guessing which one is the pin. A union of two strict objects makes
 * the pin kind a type, not a convention.
 *
 * The host lists live in `url-evidence-hosts.json` so the adoption skill's
 * gate and this persist-time schema cannot drift: one file, added-to rather
 * than forked.
 */
import hosts from "./url-evidence-hosts.json" with { type: "json" };

export const AUTHORITY_HOSTS: readonly string[] = hosts.authorityHosts;
export const FORBIDDEN_EVIDENCE_HOSTS: readonly string[] = hosts.forbiddenHosts;
/**
 * Tags are a TypeScript tuple so `z.enum` can use them. The JSON file is the
 * host-list SSOT; a test below refuses the two copies drifting.
 */
export const AUTHORITY_TAGS = ["mdn", "rfc", "w3c", "whatwg", "official-docs", "spec"] as const;

/** `docs.python.org` matches `python.org`; `notmdn.org` does not match `mdn.org`. */
export function hostMatches(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith(`.${allowed}`);
}

interface ParsedUrl {
  readonly protocol: string;
  readonly hostname: string;
}

/**
 * `URL` lives in the DOM lib, which this package does not load — it has no
 * React and no window. Node and the browser both put the same constructor on
 * `globalThis`, so we call that rather than adding a DOM dependency for one
 * parser.
 */
function parseUrl(raw: string): ParsedUrl | null {
  const Ctor = (globalThis as { URL?: new (url: string) => ParsedUrl }).URL;
  if (!Ctor) return null;
  try {
    return new Ctor(raw);
  } catch {
    return null;
  }
}

/**
 * Why a URL citation is refused, or null if it can be the pin.
 *
 * https is required because the whole point of this type is that a reader can
 * open the same page we cited; an http URL is not that page, it is a
 * downgrade. The forbidden list is the adoption rule: citing the course we
 * rewrote from would make "every claim has an authority" a laundering step.
 */
export function urlEvidenceIssue(raw: string): string | null {
  const parsed = parseUrl(raw);
  if (!parsed) return "URL evidence sourceUrl must be a valid URL";
  if (parsed.protocol !== "https:") {
    return "URL evidence must be https";
  }
  const host = parsed.hostname.toLowerCase();
  if (FORBIDDEN_EVIDENCE_HOSTS.some((entry) => hostMatches(host, entry))) {
    return `URL evidence must not cite the adopted source site (${host})`;
  }
  if (!AUTHORITY_HOSTS.some((entry) => hostMatches(host, entry))) {
    return `${host} is not on the authority-host list`;
  }
  return null;
}
