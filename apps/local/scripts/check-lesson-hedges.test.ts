/**
 * A gate nobody tests is a gate that quietly stops closing.
 *
 * These do not test regexes. They test the four judgements the polish step
 * hands to this script, using the exact defects a real polish pass produced —
 * because the reason this file exists is that a model kept every heading, every
 * code fence and every evidence anchor while changing what the lesson claimed.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(import.meta.dirname, "check-lesson-hedges.mjs");
const dir = mkdtempSync(join(tmpdir(), "hedges-"));

/** Returns the exit code, because that is the only thing the gate is read for. */
function gate(before: string, after: string): number {
  const a = join(dir, `${Math.random()}.before.md`);
  const b = join(dir, `${Math.random()}.after.md`);
  writeFileSync(a, before);
  writeFileSync(b, after);
  try {
    execFileSync("node", [SCRIPT, "--before", a, "--after", b], { stdio: "pipe" });
    return 0;
  } catch (reason) {
    return (reason as { status?: number }).status ?? -1;
  }
}

const SOURCE = "通常能照着清单重新装。往往不必手动改。多数情况下这样就够了。";

describe("the polish gate", () => {
  it("passes a polish that only changed wording", () => {
    expect(gate(SOURCE, "通常照着清单重装就行。往往不用手动改。多数时候这样够了。")).toBe(0);
  });

  it("fails when a hedge is dropped", () => {
    // Every hedge in the source is deliberate; the model does not get to decide
    // the world is more certain than the author found it.
    expect(gate(SOURCE, "能照着清单重新装。往往不必手动改。多数情况下这样就够了。")).toBe(1);
  });

  it("fails on the exact absolute a real polish invented", () => {
    expect(gate(SOURCE, "随时都能照着清单重新装。往往不必手动改。多数情况下这样就够了。")).toBe(1);
  });

  it("fails on 「只要…才」, which is the mispairing that broke a boolean sentence", () => {
    expect(gate(SOURCE, `${SOURCE}只要平台不是 web，哈希路由才会打开。`)).toBe(1);
  });

  it("fails prose that grew past the allowance", () => {
    expect(gate(SOURCE, SOURCE + "这里是模型自己想多讲的一段话。".repeat(4))).toBe(1);
  });

  it("does not count a new code block as growth", () => {
    // A lesson that legitimately gained a fence must not read as padding, or
    // the gate starts crying wolf and someone turns it off.
    const withCode = `${SOURCE}\n\n\`\`\`ts\n${"const x = 1;\n".repeat(40)}\`\`\`\n`;
    expect(gate(SOURCE, withCode)).toBe(0);
  });

  it("fails closed when it cannot read a file", () => {
    // A gate that exits 0 on a crash is not a gate — the polish step reads only
    // the exit code, so a crash that looked like success would ship the very
    // rewrite this script exists to stop.
    let code = 0;
    try {
      execFileSync("node", [SCRIPT, "--before", "/nope/missing.md", "--after", "/nope/gone.md"], {
        stdio: "pipe",
      });
    } catch (reason) {
      code = (reason as { status?: number }).status ?? -1;
    }
    expect(code).toBe(1);
  });
});
