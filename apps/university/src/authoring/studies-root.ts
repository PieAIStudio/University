/**
 * `/Users/name/…` and `/home/name/…` collapsed to `~/…`.
 *
 * Matched on the shape of the path rather than against a home directory the
 * browser cannot see. Anything that does not look like a home path is returned
 * untouched, so a studies root somewhere else stays fully spelled out.
 */
export function shortenHomePath(path: string): string {
  const match = /^\/(?:Users|home)\/[^/]+(?=\/|$)/u.exec(path);
  return match ? `~${path.slice(match[0].length)}` : path;
}
