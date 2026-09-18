import { afterEach, describe, expect, it, vi } from "vitest";
import {
  atmosphericGeometryKey,
  buildAtmosphericIslands,
  planetRepresentativeLimit,
  planAtmosphericRegions,
} from "./atmospheric-regions.js";
import { createDomainSurfaceTexture } from "./globe-geometry.js";
import {
  DomainPreparationClient,
  DOMAIN_PREPARATION_CACHE_BYTES,
} from "./domain-preparation-client.js";
import {
  mountPreparedDomain,
  prepareDomain,
  preparedDomainBuffers,
  type PreparedDomain,
} from "./domain-preparation.js";
import type { PlanetStudy } from "./planet-copy.js";

const studies: readonly PlanetStudy[] = [
  {
    id: "actual-source",
    title: "test",
    courseCount: 1,
    lessonCount: 6,
    lessonsDone: 0,
    courses: [{ id: "source-course", title: "course", lessonCount: 6, depth: 0 }],
    courseTitles: ["course"],
  },
];

const tinyPacket = (bytes = 4): PreparedDomain => ({
  pixels: new Uint8Array(bytes),
  width: 1,
  height: bytes / 4,
  islands: null,
  preparationMs: { texture: 1, islands: 1 },
});

class WorkerDouble {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  readonly requests: { id: number; domainId: string; studies: readonly PlanetStudy[] }[] = [];
  readonly terminate = vi.fn();
  postMessage(request: (typeof this.requests)[number]) {
    this.requests.push(request);
  }
  reply(packet = tinyPacket(), index = this.requests.length - 1) {
    this.onmessage?.({ data: { id: this.requests[index]!.id, packet } } as MessageEvent);
  }
  asWorker() {
    return this as unknown as Worker;
  }
}

const clients: DomainPreparationClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
  vi.useRealTimers();
});
function clientFor(worker: WorkerDouble) {
  const client = new DomainPreparationClient(() => worker.asWorker());
  clients.push(client);
  return client;
}

describe("domain worker uses the canonical generators", () => {
  it("keeps a landscape phone on the shared mobile budget", () => {
    expect(planetRepresentativeLimit(872, "mobile")).toBe(3);
    expect(planetRepresentativeLimit(1440, "desktop")).toBe(5);
    expect(planetRepresentativeLimit(375, "desktop")).toBe(3);
  });
  it("uses the same region positions and canonical course prefix for narrow detail", () => {
    const expanded = [
      {
        ...studies[0]!,
        courses: Array.from({ length: 5 }, (_, i) => ({
          ...studies[0]!.courses[0]!,
          id: `course-${i}`,
        })),
      },
    ];
    const desktop = planAtmosphericRegions(expanded, planetRepresentativeLimit(1440));
    const narrow = planAtmosphericRegions(expanded, planetRepresentativeLimit(375));
    expect(narrow[0]!.position).toEqual(desktop[0]!.position);
    expect(narrow[0]!.courseIds).toEqual(desktop[0]!.courseIds.slice(0, 3));
    expect(atmosphericGeometryKey(expanded, 3)).not.toBe(atmosphericGeometryKey(expanded, 5));
    const packet = prepareDomain("narrow", expanded, 3);
    expect(packet.islands!.indices.length / 3).toBeLessThanOrEqual(3 * 1600);
    expect(packet.islands!.indices.length / 3).toBeGreaterThan(3 * 640);
  });
  it("preserves texture pixels, real course IDs, geometry and colour encoding", () => {
    const packet = prepareDomain("domain", studies);
    const texture = createDomainSurfaceTexture("domain");
    const islands = buildAtmosphericIslands(studies, planAtmosphericRegions(studies));
    try {
      expect(packet.pixels).toEqual(texture.image.data);
      expect(packet.islands?.positions).toEqual(islands.getAttribute("position").array);
      expect(packet.islands?.normals).toEqual(islands.getAttribute("normal").array);
      expect(packet.islands?.colors).toEqual(islands.getAttribute("color").array);
      expect(packet.islands?.indices).toEqual(islands.getIndex()!.array);
      expect(packet.islands!.indices.length / 3).toBeLessThanOrEqual(1600);
      expect(packet.islands!.indices.length / 3).toBeGreaterThan(640);
      expect(preparedDomainBuffers(packet)).toHaveLength(5);
      const first = mountPreparedDomain(packet);
      const second = mountPreparedDomain(packet);
      const disposed = vi.fn();
      second.islands.addEventListener("dispose", disposed);
      expect(first.islands.uuid).not.toBe(second.islands.uuid);
      expect(first.texture.uuid).not.toBe(second.texture.uuid);
      expect(first.texture.colorSpace).toBe(texture.colorSpace);
      expect(first.texture.wrapS).toBe(texture.wrapS);
      expect(first.texture.minFilter).toBe(texture.minFilter);
      first.dispose();
      expect(disposed).not.toHaveBeenCalled();
      expect(second.islands.getAttribute("position").count).toBeGreaterThan(0);
      second.dispose();
    } finally {
      islands.dispose();
      texture.dispose();
    }
  });

  it("keeps an empty domain empty instead of inventing a representative island", () => {
    const packet = prepareDomain("empty", []);
    expect(packet.islands).toBeNull();
    expect(preparedDomainBuffers(packet)).toHaveLength(1);
    expect(packet.pixels.byteLength).toBe(1024 * 512 * 4);
  });
});

describe("bounded preparation transport and cache", () => {
  it("does not reuse another material family after a domain style change", async () => {
    const worker = new WorkerDouble();
    const client = clientFor(worker);
    const meadow = client.request("same-domain", [], 3, "meadow");
    const iris = client.request("same-domain", [], 3, "iris");
    expect(iris).not.toBe(meadow);
    expect(worker.requests).toHaveLength(2);
    worker.reply(tinyPacket(), 0);
    worker.reply(tinyPacket(), 1);
    const [first, second] = await Promise.all([meadow, iris]);
    expect(await client.request("same-domain", [], 3, "meadow")).toBe(first);
    expect(await client.request("same-domain", [], 3, "iris")).toBe(second);
  });
  it("coalesces cold requests, ignores progress/title, and invalidates changed shape", async () => {
    const worker = new WorkerDouble();
    const client = clientFor(worker);
    const first = client.request("domain", studies);
    const changedProgress = studies.map((study) => ({
      ...study,
      lessonsDone: 4,
      title: "renamed",
    }));
    expect(client.request("domain", changedProgress)).toBe(first);
    expect(worker.requests).toHaveLength(1);
    worker.reply();
    const packet = await first;
    expect(await client.request("domain", changedProgress)).toBe(packet);
    expect(worker.requests).toHaveLength(1);
    const second = client.request("domain", [
      {
        ...studies[0]!,
        courses: [{ ...studies[0]!.courses[0]!, lessonCount: 12 }],
      },
    ]);
    expect(worker.requests).toHaveLength(2);
    worker.reply();
    await second;
  });

  it("releases the worker when idle while retaining bounded CPU packets for return navigation", async () => {
    vi.useFakeTimers();
    const worker = new WorkerDouble();
    const client = clientFor(worker);
    const pending = client.request("one", []);
    worker.reply();
    const packet = await pending;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(client.describe()).toEqual({ entries: 1, bytes: 4, pending: 0, workerAlive: false });
    expect(await client.request("one", [])).toBe(packet);
    expect(worker.requests).toHaveLength(1);
  });

  it("enforces the byte budget rather than caching an unbounded number of large fields", async () => {
    const worker = new WorkerDouble();
    const client = clientFor(worker);
    for (const id of ["a", "b", "c"]) {
      const pending = client.request(id, []);
      worker.reply(tinyPacket(DOMAIN_PREPARATION_CACHE_BYTES / 2 + 4));
      await pending;
      expect(client.describe().bytes).toBeLessThanOrEqual(DOMAIN_PREPARATION_CACHE_BYTES);
    }
    expect(client.describe().entries).toBe(1);
    const evicted = client.request("a", []);
    expect(worker.requests).toHaveLength(4);
    worker.reply();
    await evicted;
  });

  it("fails visibly on worker error, releases pending jobs, and permits a clean retry", async () => {
    const worker = new WorkerDouble();
    const client = clientFor(worker);
    const first = client.request("bad", []);
    const rejected = expect(first).rejects.toThrow(/失败/);
    worker.onerror?.();
    await rejected;
    expect(client.describe().pending).toBe(0);
    expect(client.describe().workerAlive).toBe(false);
    const retry = client.request("bad", []);
    worker.reply();
    await expect(retry).resolves.toEqual(tinyPacket());
  });

  it("times out a lost response without leaving a live worker or pending Promise", async () => {
    vi.useFakeTimers();
    const worker = new WorkerDouble();
    const client = clientFor(worker);
    const rejected = expect(client.request("lost", [])).rejects.toThrow(/超时/);
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    expect(client.describe().pending).toBe(0);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("ignores late error callbacks from a terminated worker after a new retry owns the jobs", async () => {
    const old = new WorkerDouble();
    const current = new WorkerDouble();
    const factory = vi.fn().mockReturnValueOnce(old.asWorker()).mockReturnValue(current.asWorker());
    const client = new DomainPreparationClient(factory);
    clients.push(client);
    const failed = expect(client.request("domain", studies)).rejects.toThrow(/失败/);
    const lateError = old.onerror!;
    const lateMessageError = old.onmessageerror!;
    lateError();
    await failed;
    const retry = client.request("domain", studies).then(
      (packet) => ({ packet }),
      (error: Error) => ({ error }),
    );
    // Even callbacks already queued before terminate() belong to the old owner.
    lateError();
    lateMessageError();
    expect(client.describe()).toMatchObject({ pending: 1, workerAlive: true });
    expect(current.terminate).not.toHaveBeenCalled();
    current.reply();
    await expect(retry).resolves.toEqual({ packet: tinyPacket() });
  });
});
