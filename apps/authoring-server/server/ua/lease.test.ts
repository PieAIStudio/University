import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  UA_LEASE_TTL_MS,
  UaBusyError,
  acquireUaLease,
  readUaLease,
  releaseUaLease,
} from "./lease.js";

function root(): string {
  return mkdtempSync(join(tmpdir(), "university-local-lease-"));
}

const NOW = new Date("2026-08-06T10:00:00.000Z");

describe("ua analysis lease", () => {
  it("the first host to claim an analysis gets it", () => {
    const directory = root();
    const lease = acquireUaLease(directory, { owner: "host-a", now: NOW });

    expect(lease.owner).toBe("host-a");
    expect(readUaLease(directory)?.owner).toBe("host-a");
  });

  /**
   * The failure this exists for: two hosts resuming the same preparing analysis
   * both rebuild the workspace and both write the same data directory, and the
   * result looks like one clean run.
   */
  it("a second host is refused rather than allowed to run alongside", () => {
    const directory = root();
    acquireUaLease(directory, { owner: "host-a", now: NOW });

    expect(() => acquireUaLease(directory, { owner: "host-b", now: NOW })).toThrow(UaBusyError);
  });

  it("the holder resuming its own analysis extends the lease instead of blocking", () => {
    const directory = root();
    acquireUaLease(directory, { owner: "host-a", now: NOW });
    const later = new Date(NOW.getTime() + 60_000);
    const renewed = acquireUaLease(directory, { owner: "host-a", now: later });

    expect(new Date(renewed.expiresAt).getTime()).toBe(later.getTime() + UA_LEASE_TTL_MS);
  });

  it("an expired lease stops protecting a host that never came back", () => {
    const directory = root();
    acquireUaLease(directory, { owner: "host-a", now: NOW });
    const afterTtl = new Date(NOW.getTime() + UA_LEASE_TTL_MS + 1);

    expect(acquireUaLease(directory, { owner: "host-b", now: afterTtl }).owner).toBe("host-b");
  });

  it("takeover is the only way past a live lease, and it is explicit", () => {
    const directory = root();
    acquireUaLease(directory, { owner: "host-a", now: NOW });

    expect(acquireUaLease(directory, { owner: "host-b", takeover: true, now: NOW }).owner).toBe(
      "host-b",
    );
  });

  it("releasing lets the next host straight in", () => {
    const directory = root();
    acquireUaLease(directory, { owner: "host-a", now: NOW });
    releaseUaLease(directory);

    expect(readUaLease(directory)).toBeNull();
    expect(acquireUaLease(directory, { owner: "host-b", now: NOW }).owner).toBe("host-b");
  });

  /**
   * A lease file nobody can parse proves nothing about who owns the analysis,
   * so treating it as a valid claim would block the work permanently on a
   * corrupted byte.
   */
  it("an unreadable lease blocks nobody", () => {
    const directory = root();
    acquireUaLease(directory, { owner: "host-a", now: NOW });
    writeFileSync(join(directory, "lease.json"), "{ not json");

    expect(readUaLease(directory)).toBeNull();
    expect(acquireUaLease(directory, { owner: "host-b", now: NOW }).owner).toBe("host-b");
  });
});
