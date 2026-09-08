import { prepareDomain, preparedDomainBuffers } from "./domain-preparation.js";
import type { PlanetStudy } from "./planet-copy.js";
import type { PlanetRepresentativeLimit } from "./atmospheric-regions.js";

type Request = {
  readonly id: number;
  readonly domainId: string;
  readonly studies: readonly PlanetStudy[];
  readonly limit: PlanetRepresentativeLimit;
};
// A narrow worker contract avoids importing the Window and Worker lib globals together.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};
worker.onmessage = ({ data }) => {
  try {
    const packet = prepareDomain(data.domainId, data.studies, data.limit);
    worker.postMessage({ id: data.id, packet }, preparedDomainBuffers(packet));
  } catch (error) {
    worker.postMessage(
      {
        id: data.id,
        error: error instanceof Error ? error.message : "Domain preparation failed",
      },
      [],
    );
  }
};
