import { describe, expect, it } from "vitest";

import { canonicalJson } from "./serialization.js";

describe("canonicalJson", () => {
  it("keeps JSON's omission and null rules for nested undefined values", () => {
    expect(canonicalJson({ list: [undefined], omitted: undefined, value: 1 })).toBe(
      '{"list":[null],"value":1}',
    );
  });

  it("rejects a top-level value without a JSON representation", () => {
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
  });
});
