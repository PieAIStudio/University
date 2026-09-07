import type { ConnectActivity } from "./types.js";

export interface Connection {
  readonly from: string;
  readonly to: string;
}
export const connectionKey = (edge: Connection): string => `${edge.from}→${edge.to}`;

/** Order of construction does not matter; relationships do. */
export function checkConnections(activity: ConnectActivity, connections: readonly Connection[]) {
  const expected = new Set(activity.edges.map(connectionKey));
  const actual = new Set(connections.map(connectionKey));
  const missing = activity.edges.filter((edge) => !actual.has(connectionKey(edge)));
  const extra = connections.filter((edge) => !expected.has(connectionKey(edge)));
  return {
    passed: missing.length === 0 && extra.length === 0 && actual.size === connections.length,
    missing,
    extra,
    duplicates: connections.length - actual.size,
    matched: activity.edges.length - missing.length,
  };
}

/** A probe cannot travel across a connection the learner has not made. */
export function traceConnectionProbe(path: readonly string[], connections: readonly Connection[]) {
  const actual = new Set(connections.map(connectionKey));
  const visited = path.slice(0, 1);
  for (let index = 1; index < path.length; index += 1) {
    if (!actual.has(connectionKey({ from: path[index - 1]!, to: path[index]! }))) {
      return { visited, blocked: { from: path[index - 1]!, to: path[index]! } };
    }
    visited.push(path[index]!);
  }
  return { visited, blocked: null };
}
