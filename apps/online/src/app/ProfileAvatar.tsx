import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Avatar, dressScene, randomRecipe } from "@pieai/university-avatar";
import { useMemo } from "react";

/** The avatar-lab's creature, as a preview. Full editor stays at `#/avatar-lab`. */
export function ProfileAvatar() {
  const recipe = useMemo(() => randomRecipe(), []);
  return (
    <div className="profile-avatar">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0.55, 1.2, 3.5], fov: 30, near: 0.05, far: 60 }}
        onCreated={({ gl, scene, camera }) => {
          dressScene(scene, gl);
          camera.lookAt(0, 0.9, 0);
        }}
      >
        <Avatar recipe={recipe} gaze />
        <OrbitControls
          enablePan={false}
          enableDamping
          target={[0, 0.9, 0]}
          minDistance={1.8}
          maxDistance={6}
        />
      </Canvas>
      <a className="profile-avatar__lab ghost" href="#/avatar-lab">
        打开头像工坊
      </a>
    </div>
  );
}
