import { describe, expect, it } from "vitest";

import { AO_FRAGMENT } from "./ao";
import { WORLD_GRADE_FRAGMENT } from "./grade";

describe("AO pass", () => {
  it("never tone-maps or sRGB-encodes — that is the grade blit", () => {
    expect(AO_FRAGMENT).not.toMatch(/ACESFilmicToneMapping/);
    expect(AO_FRAGMENT).not.toMatch(/sRGBTransferOETF/);
    expect(AO_FRAGMENT).not.toMatch(/sRGB/);
  });

  it("the grade fragment still owns the one encode", () => {
    expect(WORLD_GRADE_FRAGMENT).toMatch(/ACESFilmicToneMapping/);
    expect(WORLD_GRADE_FRAGMENT).toMatch(/sRGBTransferOETF/);
  });

  it("skips the far plane so the sky does not film over", () => {
    expect(AO_FRAGMENT).toMatch(/depth > 0\.999/);
  });

  it("keeps contact darkening as a crease instead of a black block", () => {
    expect(AO_FRAGMENT).toMatch(/clamp\([\s\S]*0\.2\)/);
  });

  it("shares the grade blit language so WebGL2 does not have to speak GLSL 3", () => {
    expect(AO_FRAGMENT).toMatch(/texture2D/);
    expect(AO_FRAGMENT).toMatch(/gl_FragColor/);
    expect(AO_FRAGMENT).not.toMatch(/GL_OES_standard_derivatives/);
    expect(AO_FRAGMENT).not.toMatch(/\bdFdx\b/);
  });
});
