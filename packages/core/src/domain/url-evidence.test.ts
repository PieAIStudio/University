import { describe, expect, it } from "vitest";

import { EvidenceReferenceSchema, isRepositoryEvidence, isUrlEvidence } from "./schemas.js";
import { AUTHORITY_TAGS } from "./url-evidence.js";
import hosts from "./url-evidence-hosts.json" with { type: "json" };

const mdn = {
  kind: "fact" as const,
  note: "HTML 用来给网页上的每一块内容贴上「这是什么」的标签。",
  sourceUrl: "https://developer.mozilla.org/zh-CN/docs/Web/HTML",
  sourceTitle: "MDN · HTML",
  sourceAuthority: "mdn" as const,
};

function messages(value: unknown): string {
  const result = EvidenceReferenceSchema.safeParse(value);
  if (result.success) return "";
  return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}

describe("URL evidence", () => {
  it("accepts an https MDN citation", () => {
    const parsed = EvidenceReferenceSchema.parse(mdn);
    expect("sourceUrl" in parsed).toBe(true);
    if ("sourceUrl" in parsed) {
      expect(parsed.sourceUrl).toBe(mdn.sourceUrl);
      expect(parsed.sourceTitle).toBe(mdn.sourceTitle);
    }
  });

  it("rejects http even when the host is on the authority list", () => {
    expect(
      messages({ ...mdn, sourceUrl: "http://developer.mozilla.org/en-US/docs/Web/HTML" }),
    ).toMatch(/https/);
  });

  it("rejects a host outside the authority list", () => {
    expect(messages({ ...mdn, sourceUrl: "https://example.com/html" })).toMatch(
      /authority-host|not on the/,
    );
  });

  it("rejects a URL that points at the adopted source site", () => {
    expect(messages({ ...mdn, sourceUrl: "https://vibe-hub.org/courses/product-website" })).toMatch(
      /adopted source|vibe-hub/,
    );
  });

  it("does not let a repository citation drop its snapshot fields", () => {
    const result = EvidenceReferenceSchema.safeParse({
      kind: "fact",
      sourcePath: "src/auth.ts",
      note: "missing the pin that makes this checkable",
    });
    expect(result.success).toBe(false);
    // Zod's union error flattens the first branch's path; the JSON still
    // names the missing pin so a later schema change cannot silently accept
    // a path with no snapshot.
    expect(JSON.stringify(result)).toMatch(/snapshotId|sourceCommit/);
  });
});

describe("authority tag list", () => {
  it("matches the JSON host-list file, so z.enum and the adoption gate cannot drift", () => {
    expect(hosts.authorityTags).toEqual([...AUTHORITY_TAGS]);
  });
});

describe("evidence type guards", () => {
  it("keeps repository and URL citations distinguishable after parse", () => {
    const repository = EvidenceReferenceSchema.parse({
      kind: "fact",
      snapshotId: "git-aaaaaaaaaaaa",
      sourceCommit: "a".repeat(40),
      sourcePath: "src/auth.ts",
      lineStart: 10,
      lineEnd: 20,
      nodeIds: [],
    });
    const url = EvidenceReferenceSchema.parse(mdn);
    expect(isRepositoryEvidence(repository)).toBe(true);
    expect(isUrlEvidence(repository)).toBe(false);
    expect(isUrlEvidence(url)).toBe(true);
    expect(isRepositoryEvidence(url)).toBe(false);
  });
});
