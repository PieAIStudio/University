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
  const realWorld = {
    kind: "fact" as const,
    sourceUrl: "https://www.bemyeyes.com/blog/introducing-be-my-ai/",
    sourceTitle: "Introducing: Be My AI",
    sourceAuthority: "first-party" as const,
    provenance: {
      type: "case-study" as const,
      publisher: "Be My Eyes",
      publishedOn: "2023-08-07",
      accessedOn: "2026-09-14",
      locator: "How to Use Be My AI",
      supports: "The provider describes image questions and a route to a human volunteer.",
      limitations: "A provider announcement, not an independent accuracy measurement.",
    },
  };

  it("keeps a real-world source and its claim boundary without inventing a repository", () => {
    const parsed = EvidenceReferenceSchema.parse(realWorld);
    expect(parsed).toEqual(realWorld);
    expect(isRepositoryEvidence(parsed)).toBe(false);
  });

  it("requires a claim-specific provenance record for the new source authorities", () => {
    const { provenance: _provenance, ...missing } = realWorld;
    expect(EvidenceReferenceSchema.safeParse(missing).success).toBe(false);
    expect(
      EvidenceReferenceSchema.safeParse({
        ...realWorld,
        provenance: { ...realWorld.provenance, supports: " " },
      }).success,
    ).toBe(false);
  });

  it("does not accept an impossible publication date or a made-up source category", () => {
    for (const change of [{ publishedOn: "2025-02-30" }, { type: "verified-by-ai" }]) {
      expect(
        EvidenceReferenceSchema.safeParse({
          ...realWorld,
          provenance: { ...realWorld.provenance, ...change },
        }).success,
      ).toBe(false);
    }
  });

  it("allows an honestly undated source while requiring when it was inspected", () => {
    const { publishedOn: _publishedOn, ...undated } = realWorld.provenance;
    expect(EvidenceReferenceSchema.safeParse({ ...realWorld, provenance: undated }).success).toBe(
      true,
    );
    const { accessedOn: _accessedOn, ...notInspected } = undated;
    expect(
      EvidenceReferenceSchema.safeParse({ ...realWorld, provenance: notInspected }).success,
    ).toBe(false);
  });

  it.each([
    "https://person:secret@developer.mozilla.org/en-US/docs/Web/HTML",
    "https://developer.mozilla.org:8443/en-US/docs/Web/HTML",
  ])("rejects credentials or an unexpected network service in a source URL: %s", (sourceUrl) => {
    expect(EvidenceReferenceSchema.safeParse({ ...mdn, sourceUrl }).success).toBe(false);
  });

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

  it.each([
    "www.tensorflow.org",
    "www.nist.gov",
    "huggingface.co",
    "antigravity.google",
    "developers.openai.com",
    "platform.openai.com",
    "docs.anthropic.com",
    "docs.github.com",
    "npmjs.com",
    "learn.chatgpt.com",
  ])("retains the independently admitted course authority %s", (host) => {
    // Schema-only fixture: admission does not prove that a page supports a claim.
    expect(
      messages({
        ...mdn,
        sourceUrl: `https://${host}/`,
        sourceTitle: "Authority admission fixture",
        sourceAuthority: "official-docs",
      }),
    ).toBe("");
  });

  it("does not admit a lookalike suffix when combining authority lists", () => {
    expect(messages({ ...mdn, sourceUrl: "https://www.nist.gov.example.com/" })).toMatch(
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
