import { translate } from "@pieai/university-ui/i18n.js";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { guestAvatarRecipe } from "@pieai/university-world/avatar.js";
import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { dressScene } from "@pieai/swimmer-avatar-kit/materials";
import { Avatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import { useMemo } from "react";

/** The avatar-lab's creature, as a preview. Full editor stays at `/avatar-lab`. */
export function ProfileAvatar({
  avatarRecipe,
  signedIn = false,
}: {
  readonly avatarRecipe?: AvatarRecipe | null;
  readonly signedIn?: boolean;
}) {
  const guest = useMemo(() => guestAvatarRecipe(), []);
  const recipe = signedIn && avatarRecipe ? avatarRecipe : guest;
  return (
    <div className="profile-avatar">
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
        <Avatar recipe={recipe} gaze quality="compact" />
        <OrbitControls
          enablePan={false}
          enableDamping
          target={[0, 0.9, 0]}
          minDistance={1.8}
          maxDistance={6}
        />
      </Canvas>
      {/* Not `ghost`: that variant is transparent, and this sits on a canvas. */}
      <a className="profile-avatar__lab" href="/avatar-lab">
        {translate("app.app.profileAvatar.copy.打开头像工坊")}
      </a>
    </div>
  );
}
