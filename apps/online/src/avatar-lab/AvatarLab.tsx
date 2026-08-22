import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  GameButton,
  GameField,
  GameInput,
  GameMaterialSwatches,
  GamePanel,
  GameToggle,
} from "@pieai/swimmer-ui-kit";
import {
  fillRecipe,
  PALETTES,
  randomRecipe,
  rerollPart,
  SPECIES,
  type AvatarRecipe,
} from "@pieai/swimmer-avatar-kit";
import { dressScene } from "@pieai/swimmer-avatar-kit/materials";
import { Avatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import { useCallback, useMemo, useState } from "react";

import { WORLD, type View } from "../url-state";
import { REROLLABLE_PARTS } from "./rerollable-parts";

export function AvatarLab({ onOpen }: { onOpen: (view: View) => void }) {
  const [recipe, setRecipe] = useState<AvatarRecipe>(() => randomRecipe());
  const [seedText, setSeedText] = useState(() => String(recipe.seed));
  const [gaze, setGaze] = useState(true);
  const [stats, setStats] = useState<{ meshes: number; verts: number; buildMs: number } | null>(
    null,
  );

  const swatches = useMemo(
    () =>
      PALETTES.map((palette) => ({
        id: palette.id,
        label: palette.label,
        color: palette.colors[0] ?? "#ccc",
        secondaryColor: palette.colors[1],
      })),
    [],
  );

  const applySeed = useCallback(() => {
    const next = randomRecipe(seedText.trim());
    setRecipe(next);
    setSeedText(String(next.seed));
  }, [seedText]);

  const rollNew = useCallback(() => {
    const next = randomRecipe();
    setRecipe(next);
    setSeedText(String(next.seed));
  }, []);

  const setSpecies = useCallback((speciesId: string) => {
    setRecipe((current) =>
      fillRecipe({
        ...current,
        species: speciesId,
        body: null,
        stance: null,
        parts: {},
      }),
    );
  }, []);

  const setPalette = useCallback((paletteId: string) => {
    const swatch = PALETTES.find((entry) => entry.id === paletteId);
    setRecipe((current) =>
      fillRecipe({
        ...current,
        palette: paletteId,
        colorIx: Math.min(current.colorIx ?? 0, (swatch?.colors.length ?? 1) - 1),
      }),
    );
  }, []);

  return (
    <div className="avatar-lab">
      <section className="avatar-lab__stage" aria-label="头像舞台">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
          camera={{ position: [0.55, 1.2, 3.5], fov: 30, near: 0.05, far: 60 }}
          shadows
          onCreated={({ gl, scene, camera }) => {
            dressScene(scene, gl);
            camera.lookAt(0, 0.9, 0);
          }}
        >
          <Avatar recipe={recipe} gaze={gaze} onBuilt={(avatar) => setStats(avatar.stats)} />
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            target={[0, 0.9, 0]}
            minDistance={1.8}
            maxDistance={6}
            minPolarAngle={0.35}
            maxPolarAngle={1.45}
          />
        </Canvas>
        <p className="avatar-lab__readout">
          {stats
            ? `${stats.meshes} 件 · ${stats.verts.toLocaleString()} 顶点 · ${stats.buildMs}ms · 种子 ${recipe.seed}`
            : `种子 ${recipe.seed}`}
        </p>
      </section>

      <aside className="avatar-lab__dock">
        <GamePanel title="头像工坊">
          <p className="avatar-lab__lede">换物种、换色盘，或重掷一张脸。拖动画布绕着看。</p>
          <div className="avatar-lab__actions">
            <GameButton type="button" variant="ghost" onClick={() => onOpen(WORLD)}>
              回到地图
            </GameButton>
            <GameButton type="button" variant="primary" onClick={rollNew}>
              随机一张
            </GameButton>
          </div>
          <GameToggle
            checked={gaze}
            label={gaze ? "注视开" : "注视关"}
            onClick={() => setGaze((on) => !on)}
          />
        </GamePanel>

        <GamePanel title="种子">
          <div className="avatar-lab__stack">
            <GameField label="配方" hint="数字原样用；其它文字会哈希成种子。">
              <GameInput
                value={seedText}
                onChange={(event) => setSeedText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySeed();
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </GameField>
            <GameButton type="button" variant="secondary" onClick={applySeed}>
              应用种子
            </GameButton>
          </div>
        </GamePanel>

        <GamePanel title="物种">
          <div className="avatar-lab__chips" role="group" aria-label="物种">
            {SPECIES.map((species) => (
              <GameButton
                key={species.id}
                type="button"
                variant={recipe.species === species.id ? "primary" : "ghost"}
                onClick={() => setSpecies(species.id)}
              >
                {species.label}
              </GameButton>
            ))}
          </div>
        </GamePanel>

        <GamePanel title="色盘">
          <GameMaterialSwatches
            label="色盘"
            activeMaterialId={recipe.palette ?? undefined}
            materials={swatches}
            onMaterialChange={setPalette}
          />
        </GamePanel>

        <GamePanel title="重掷部位">
          <div className="avatar-lab__chips" role="group" aria-label="重掷部位">
            {REROLLABLE_PARTS.map((part) => (
              <GameButton
                key={part.id}
                type="button"
                variant="ghost"
                onClick={() => setRecipe((current) => rerollPart(current, part.id))}
              >
                {part.label}
              </GameButton>
            ))}
          </div>
        </GamePanel>

        <p className="avatar-lab__meta">
          {PALETTES.length} 套色盘 · {SPECIES.length} 个物种
        </p>
      </aside>
    </div>
  );
}
