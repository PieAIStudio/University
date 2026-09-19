import { translate } from "@pieai/university-ui/i18n.js";
import { Canvas } from "@react-three/fiber";
import { AvatarPreviewControls, guestAvatarRecipe } from "@pieai/university-world/avatar.js";
import { hasWebGLContext } from "@pieai/university-world/webgl-capability.js";
import type { AvatarRecipe, AvatarBounds } from "@pieai/swimmer-avatar-kit";
import { dressScene } from "@pieai/swimmer-avatar-kit/materials";
import { Avatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import { useMemo, useState } from "react";
import { WorldAppearance } from "@pieai/university-world/appearance.js";

/** The avatar-lab's creature, as a preview. Full editor stays at `/avatar-lab`. */
export function ProfileAvatar({
  avatarRecipe,
  signedIn = false,
}: {
  readonly avatarRecipe?: AvatarRecipe | null;
  readonly signedIn?: boolean;
}) {
  const guest = useMemo(() => guestAvatarRecipe(), []);
  const [bounds, setBounds] = useState<AvatarBounds | null>(null);
  const recipe = signedIn && avatarRecipe ? avatarRecipe : guest;
  const webglAvailable = hasWebGLContext();
  return (
    <div className="profile-avatar">
      {webglAvailable ? (
        <Canvas
          /*
          `dressScene` lays down a shadow-catching floor and a key light, and
          without this the floor has nothing to catch. The avatar-lab canvas
          has always had it; this preview was written later and did not.
        */
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0.55, 1.2, 3.5], fov: 30, near: 0.05, far: 60 }}
          onCreated={({ gl, scene, camera }) => {
            dressScene(scene, gl);
            camera.lookAt(0, 0.9, 0);
          }}
        >
          <WorldAppearance role="avatar" />
          <Avatar
            recipe={recipe}
            gaze
            quality="compact"
            onBuilt={(avatar) => setBounds(avatar.bounds)}
          />
          <AvatarPreviewControls bounds={bounds} />
        </Canvas>
      ) : (
        <div className="profile-avatar__fallback" aria-hidden="true" />
      )}
      {/* Not `ghost`: that variant is transparent, and this sits on a canvas. */}
      <a className="profile-avatar__lab" href="/avatar-lab">
        {translate("app.app.profileAvatar.copy.打开头像工坊")}
      </a>
    </div>
  );
}
