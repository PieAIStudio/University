// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Scene, Group, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import { AVATAR_OCCLUSION_TARGET } from "./avatar/avatar-occlusion.js";
import {
  ScenePending,
  ScenePresence,
  SceneReadinessContext,
  sceneAvatarsBuilt,
} from "./scene-readiness.js";

const probe = vi.hoisted(() => ({
  active: false,
  loaded: 0,
  total: 0,
  frame: null as null | ((state: { scene: Scene }) => void),
}));
vi.mock("@react-three/drei", () => ({
  useProgress: Object.assign(
    () => {
      throw new Error("Read the actual loader in the frame, not a React subscription");
    },
    {
      getState: () => probe,
    },
  ),
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: (state: { scene: Scene }) => void, priority: number) => {
    expect(priority).toBe(2);
    probe.frame = callback;
  },
}));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(probe, { active: false, loaded: 0, total: 0, frame: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("complete scene admission after the actual output pass", () => {
  it("does not confuse an empty avatar placement with the kit's built mesh", () => {
    const scene = new Scene(),
      avatar = new Group();
    avatar.name = AVATAR_OCCLUSION_TARGET;
    scene.add(avatar);
    expect(sceneAvatarsBuilt(scene)).toBe(false);
    const geometry = new BoxGeometry(),
      material = new MeshBasicMaterial();
    avatar.add(new Mesh(geometry, material));
    expect(sceneAvatarsBuilt(scene)).toBe(true);
    geometry.dispose();
    material.dispose();
  });
  it("waits for data, nested loading branches and assets, then reports on the completed frame only", async () => {
    const pending = new Set<symbol>(),
      ready = vi.fn(),
      busy = vi.fn(),
      progress = vi.fn();
    const scene = new Scene();
    const render = async (dataReady: boolean, suspended = false, sceneKey = "course:a") => {
      await act(async () =>
        root.render(
          <SceneReadinessContext.Provider value={pending}>
            <ScenePresence
              sceneKey={sceneKey}
              dataReady={dataReady}
              onReady={ready}
              onBusy={busy}
              onProgress={progress}
            />
            {suspended ? <ScenePending /> : null}
          </SceneReadinessContext.Provider>,
        ),
      );
    };
    const frame = async () => {
      await act(async () => probe.frame!({ scene }));
    };
    await render(false);
    await frame();
    expect(progress).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
    await render(true, true);
    await frame();
    expect(ready).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledTimes(1);
    probe.active = true;
    probe.loaded = 1;
    probe.total = 2;
    await render(true);
    await frame();
    expect(ready).not.toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith({ loaded: 1, total: 2 });
    probe.active = false;
    probe.loaded = 2;
    await render(true);
    expect(ready).not.toHaveBeenCalled();
    await frame();
    expect(ready).toHaveBeenCalledTimes(1);
    await frame();
    expect(ready).toHaveBeenCalledTimes(1);
    await render(true, true);
    await frame();
    expect(busy).toHaveBeenCalledTimes(2);
    await render(true);
    await frame();
    expect(ready).toHaveBeenCalledTimes(2);
    await render(true, false, "course:b");
    expect(busy).toHaveBeenCalledTimes(4);
    expect(ready).toHaveBeenCalledTimes(2);
    await frame();
    expect(ready).toHaveBeenCalledTimes(3);
  });
  it("unregisters a cancelled nested branch rather than leaving the screen permanently busy", async () => {
    const pending = new Set<symbol>();
    await act(async () =>
      root.render(
        <SceneReadinessContext.Provider value={pending}>
          <ScenePending />
        </SceneReadinessContext.Provider>,
      ),
    );
    expect(pending.size).toBe(1);
    await act(async () => root.render(null));
    expect(pending.size).toBe(0);
  });
});
