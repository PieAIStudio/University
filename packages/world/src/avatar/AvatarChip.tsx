/**
 * The avatar in the app's chrome: its own small canvas, sized for a top bar.
 *
 * A second WebGL context next to the world map is a real cost, so this one is
 * deliberately cheap: DPR is capped at 1.5 rather than the device's 3, the
 * canvas is small, and it stops rendering entirely when it scrolls out of view
 * or the tab is hidden. The alternative — drawing the avatar inside the world
 * canvas as a HUD viewport — is cheaper still and was rejected because it ties
 * the avatar to a screen that has a 3D map on it, and the avatar has to appear
 * on the reader and the profile page too.
 */
import { Canvas } from "@react-three/fiber";
import { translate } from "@pieai/university-ui/i18n.js";
import { dressScene } from "@pieai/swimmer-avatar-kit/materials";
import type { AvatarBounds, AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PerspectiveCamera } from "three";

import { AvatarBust } from "./AvatarBust.js";
import { frameBust } from "./frame-bust.js";
import { hasWebGLContext } from "../webgl-capability.js";
import { usePageVisibility } from "../page-visibility.js";

export function AvatarChip({
  recipe,
  signedIn = false,
  size = 44,
  label,
  onClick,
}: {
  readonly recipe?: AvatarRecipe;
  readonly signedIn?: boolean;
  readonly size?: number;
  readonly label?: string;
  readonly onClick?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const [live, setLive] = useState(true);
  const pageVisible = usePageVisibility();
  const webglAvailable = hasWebGLContext();

  /*
    An animation nobody can see still costs a frame every 16ms. IntersectionObserver
    is the cheap half; `document.hidden` is the half that matters on a laptop,
    because a background tab keeps its rAF alive in some browsers and this would
    otherwise spin the GPU while the learner is reading their email.
  */
  useEffect(() => {
    const node = host.current;
    if (!node || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      ([entry]) => setLive(Boolean(entry?.isIntersecting)),
      { threshold: 0.01 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const applyBust = useCallback((camera: PerspectiveCamera, bounds: AvatarBounds) => {
    const { centreY, distance } = frameBust(bounds, camera.fov);
    camera.position.set(0, centreY, distance);
    camera.lookAt(0, centreY, 0);
    camera.updateProjectionMatrix();
  }, []);

  // The existing canvas resizes with its rail; folding never mounts a second avatar.
  const dimension = `var(--avatar-chip-size, ${size}px)`;
  const body = webglAvailable ? (
    <div className="avatar-chip__stage" ref={host} style={{ width: dimension, height: dimension }}>
      <Canvas
        frameloop={live && pageVisible ? "always" : "never"}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 1.16, 2.35], fov: 26, near: 0.02, far: 40 }}
        onCreated={({ gl, scene, camera }) => {
          cameraRef.current = camera as PerspectiveCamera;
          dressScene(scene, gl);
        }}
      >
        <AvatarBust
          recipe={recipe}
          signedIn={signedIn}
          onBuilt={(avatar) => {
            const camera = cameraRef.current;
            if (camera) applyBust(camera, avatar.bounds);
          }}
        />
      </Canvas>
    </div>
  ) : (
    <span
      className="avatar-chip__stage avatar-chip--placeholder"
      style={{ width: dimension, height: dimension }}
      aria-hidden="true"
    />
  );

  if (!onClick) return <div className="avatar-chip">{body}</div>;
  return (
    <button
      type="button"
      className="avatar-chip avatar-chip--button"
      onClick={onClick}
      aria-label={
        label ??
        translate(signedIn ? "product.account.profileLabel" : "product.account.avatarSignInLabel")
      }
    >
      {body}
    </button>
  );
}
