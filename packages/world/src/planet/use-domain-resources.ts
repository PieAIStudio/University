import { useEffect, useMemo, useState } from "react";
import { type PlanetRepresentativeLimit } from "./atmospheric-regions.js";
import { domainPreparation, domainPreparationKey } from "./domain-preparation-client.js";
import { mountPreparedDomain, type PreparedDomain } from "./domain-preparation.js";
import type { PlanetStudy } from "./planet-copy.js";
import type { DomainSurfaceStyle } from "./globe-style.js";

export interface DomainResourceStatus {
  readonly domainId: string;
  readonly state: "loading" | "ready" | "error";
}

export function useDomainResources(
  domainId: string,
  studies: readonly PlanetStudy[],
  retry: number,
  onStatus?: (status: DomainResourceStatus) => void,
  limit: PlanetRepresentativeLimit = 5,
  surfaceStyle: DomainSurfaceStyle = "meadow",
) {
  const key = domainPreparationKey(domainId, studies, limit, surfaceStyle);
  const [result, setResult] = useState<{ key: string; packet: PreparedDomain } | null>(null);
  useEffect(() => {
    let current = true;
    onStatus?.({ domainId, state: "loading" });
    void domainPreparation
      .request(domainId, studies, limit, surfaceStyle)
      .then((packet) => {
        if (!current) return;
        setResult({ key, packet });
        onStatus?.({ domainId, state: "ready" });
      })
      .catch(() => {
        if (current) onStatus?.({ domainId, state: "error" });
      });
    return () => {
      current = false;
    };
    // Identity is physical input only: progress and title must never enqueue work.
  }, [key, retry, onStatus]);
  const packet = result?.key === key ? result.packet : null;
  const resources = useMemo(() => (packet ? mountPreparedDomain(packet) : null), [packet]);
  useEffect(() => () => resources?.dispose(), [resources]);
  return { resources, preparationMs: packet?.preparationMs ?? null };
}
