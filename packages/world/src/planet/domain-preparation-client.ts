import { atmosphericGeometryKey, type PlanetRepresentativeLimit } from "./atmospheric-regions.js";
import { preparedDomainBuffers, type PreparedDomain } from "./domain-preparation.js";
import type { PlanetStudy } from "./planet-copy.js";

export const DOMAIN_PREPARATION_CACHE_BYTES = 32 * 1024 * 1024;
type Pending = {
  readonly key: string;
  readonly promise: Promise<PreparedDomain>;
  readonly resolve: (packet: PreparedDomain) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
};

/** One worker, in-flight coalescing, bounded CPU-only LRU, no progress invalidation. */
export class DomainPreparationClient {
  private worker: Worker | null = null;
  private sequence = 0;
  private pending = new Map<number, Pending>();
  private cache = new Map<string, { packet: PreparedDomain; bytes: number }>();
  private bytes = 0;
  private idle: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private readonly createWorker: () => Worker = () =>
      new Worker(new URL("./domain-preparation.worker.ts", import.meta.url), { type: "module" }),
  ) {}

  describe() {
    return {
      pending: this.pending.size,
      entries: this.cache.size,
      bytes: this.bytes,
      workerAlive: this.worker !== null,
    };
  }

  request(
    domainId: string,
    studies: readonly PlanetStudy[],
    limit: PlanetRepresentativeLimit = 5,
  ): Promise<PreparedDomain> {
    const key = `${domainId}\n${atmosphericGeometryKey(studies, limit)}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return Promise.resolve(cached.packet);
    }
    const existing = [...this.pending.values()].find((entry) => entry.key === key);
    if (existing) return existing.promise;
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    try {
      if (!this.worker) {
        const worker = this.createWorker();
        this.worker = worker;
        worker.onmessage = ({
          data,
        }: MessageEvent<{ id: number; packet?: PreparedDomain; error?: string }>) => {
          if (this.worker === worker) this.receive(data);
        };
        // A queued event can outlive terminate(). It must not cancel jobs
        // belonging to a replacement worker after the learner retries.
        worker.onerror = () => {
          if (this.worker === worker) this.stop(new Error("领域资源准备失败，请重试。"));
        };
        worker.onmessageerror = () => {
          if (this.worker === worker) this.stop(new Error("领域资源传输失败，请重试。"));
        };
      }
      const id = ++this.sequence;
      let resolve!: Pending["resolve"];
      let reject!: Pending["reject"];
      const promise = new Promise<PreparedDomain>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) this.stop(new Error("领域资源准备超时，请重试。"));
      }, 30_000);
      this.pending.set(id, { key, promise, resolve, reject, timeout });
      try {
        this.worker.postMessage({ id, domainId, studies, limit });
      } catch {
        this.stop(new Error("领域资源准备无法启动，请重试。"));
      }
      return promise;
    } catch {
      return Promise.reject(new Error("此浏览器无法启动后台地图准备。课程列表仍可使用。"));
    }
  }

  private receive(data: { id: number; packet?: PreparedDomain; error?: string }) {
    const pending = this.pending.get(data.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(data.id);
    if (!data.packet || data.error)
      pending.reject(new Error(data.error ?? "Invalid domain resource packet"));
    else {
      const bytes = preparedDomainBuffers(data.packet).reduce(
        (sum, buffer) => sum + buffer.byteLength,
        0,
      );
      if (bytes <= DOMAIN_PREPARATION_CACHE_BYTES) {
        this.cache.set(pending.key, { packet: data.packet, bytes });
        this.bytes += bytes;
        while (this.bytes > DOMAIN_PREPARATION_CACHE_BYTES || this.cache.size > 8) {
          const oldest = this.cache.keys().next().value!;
          this.bytes -= this.cache.get(oldest)!.bytes;
          this.cache.delete(oldest);
        }
      }
      pending.resolve(data.packet);
    }
    // CPU packets may be reused; the worker and its generation heap may not linger.
    if (this.pending.size === 0) this.idle = setTimeout(() => this.stop(), 1_000);
  }

  private stop(error = new Error("Domain preparation stopped")) {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(error);
    }
    this.pending.clear();
  }

  dispose() {
    this.stop();
    this.cache.clear();
    this.bytes = 0;
  }
}

export const domainPreparation = new DomainPreparationClient();
