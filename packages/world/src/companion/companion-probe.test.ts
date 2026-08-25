import { describe, expect, it } from "vitest";

import { screenFromProjected } from "./companion-screen.js";

describe("screenFromProjected", () => {
  it("maps NDC centre to the middle of the viewport", () => {
    expect(screenFromProjected({ x: 0, y: 0, z: 0 }, 1440, 810)).toEqual({ x: 720, y: 405 });
  });

  it("drops points behind the camera or off the far plane", () => {
    expect(screenFromProjected({ x: 0, y: 0, z: 1 }, 1440, 810)).toBeNull();
    expect(screenFromProjected({ x: 1.2, y: 0, z: 0 }, 1440, 810)).toBeNull();
  });
});
