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
 *
 * ## What may join `authorityHosts`, and why it is a list rather than a filter
 *
 * A host qualifies when an inspected source can support the specific claim:
 * first-party documentation, research, public records/data, rights-holder
 * material, or original reporting about a real event. Admission is not an
 * endorsement of every page on the host. New authority categories require
 * claim-specific provenance in the schema: publisher, inspection date,
 * supported claim and limits. A news report is not a technical specification,
 * and a vendor's case study is not an independent outcome measurement.
 *
 * The list grows. It was originally sized for teaching the web platform, and
 * when the curriculum moved to AI tooling nothing on it could be cited — which
 * is a reason to add hosts, not a reason to stop checking. Add the host, keep
 * the gate.
 *
 * ## Why not a deny-list instead
 *
 * Because the lessons are written by models. The failure this catches is not a
 * low-quality site slipping in; it is a **fabricated URL** — a plausible-looking
 * page on a real-sounding host that does not exist, or does exist and never
 * said the thing cited. A deny-list cannot catch that by construction: an
 * invented host is, definitionally, not on any list of known-bad ones. An
 * allow-list rejects it on the first try.
 *
 * `forbiddenHosts` is a different instrument and is not a quality filter. It
 * names the specific course sites this project adopts material *from*, so that
 * citing them back would be laundering rather than sourcing.
 */
import hosts from "./url-evidence-hosts.json" with { type: "json" };

const AUTHORITY_HOSTS: readonly string[] = hosts.authorityHosts;
const FORBIDDEN_EVIDENCE_HOSTS: readonly string[] = hosts.forbiddenHosts;
/**
 * Tags are a TypeScript tuple so `z.enum` can use them. The JSON file is the
 * host-list SSOT; a test below refuses the two copies drifting.
 */
export const AUTHORITY_TAGS = [
  "mdn",
  "rfc",
  "w3c",
  "whatwg",
  "official-docs",
  "spec",
  "first-party",
  "research",
  "public-record",
  "news-report",
  "open-data",
  "rights-holder",
] as const;

/** Legacy citations remain valid; newly admitted source categories explain their limits. */
export const REALITY_AUTHORITY_TAGS: readonly string[] = [
  "first-party",
  "research",
  "public-record",
  "news-report",
  "open-data",
  "rights-holder",
];

/** `docs.python.org` matches `python.org`; `notmdn.org` does not match `mdn.org`. */
function hostMatches(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith(`.${allowed}`);
}

interface ParsedUrl {
  readonly protocol: string;
  readonly hostname: string;
  readonly username: string;
  readonly password: string;
  readonly port: string;
  readonly pathname: string;
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
  if (parsed.username || parsed.password) {
    return "URL evidence must not contain credentials";
  }
  if (parsed.port && parsed.port !== "443") {
    return "URL evidence must use the standard HTTPS port";
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "github.com" &&
    /\/blob\//.test(parsed.pathname) &&
    !/\/blob\/[a-f0-9]{40}\//i.test(parsed.pathname)
  ) {
    return "GitHub source files must be pinned to a full commit";
  }
  if (FORBIDDEN_EVIDENCE_HOSTS.some((entry) => hostMatches(host, entry))) {
    return `URL evidence must not cite the adopted source site (${host})`;
  }
  if (!AUTHORITY_HOSTS.some((entry) => hostMatches(host, entry))) {
    return `${host} is not on the authority-host list`;
  }
  return null;
}
