import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GameButton, GameField, GameInput, GamePanel, GameToggle } from "@pieai/swimmer-ui-kit";
import {
  fillRecipe as kitFillRecipe,
  randomRecipe as kitRandomRecipe,
  SPECIES as KIT_SPECIES,
  type AvatarHandle as KitAvatarHandle,
  type AvatarRecipe as KitRecipe,
} from "@pieai/swimmer-avatar-kit";
import { Avatar as KitAvatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import {
  Avatar as OursAvatar,
  dressScene,
  fillRecipe as oursFillRecipe,
  randomRecipe as oursRandomRecipe,
  SPECIES as OURS_SPECIES,
  type AvatarRecipe as OursRecipe,
} from "@pieai/university-avatar";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { WORLD, type View } from "../url-state";
import {
  COMPARE_PRESETS,
  parseCompareHash,
  toCompareHash,
  type CompareQuery,
  type CompareSolo,
} from "./presets";

const CAMERA = {
  position: [0.55, 1.2, 3.5] as [number, number, number],
  fov: 30,
  near: 0.05,
  far: 60,
};

type BuildStats = { meshes: number; verts: number; buildMs: number };
type FrameStats = { medianMs: number; meanMs: number; samples: number };

function pinSpecies<T extends OursRecipe | KitRecipe>(
  recipe: T,
  species: string,
  fill: (recipe: T) => T,
): T {
  return fill({
    ...recipe,
    species,
    body: null,
    stance: null,
    parts: {},
  });
}

function recipeJson(recipe: OursRecipe | KitRecipe): string {
  return JSON.stringify(recipe);
}

function FrameSampler({
  onReport,
  warmupFrames = 30,
  sampleFrames = 120,
}: {
  onReport: (stats: FrameStats) => void;
  warmupFrames?: number;
  sampleFrames?: number;
}) {
  const deltas = useRef<number[]>([]);
  const frames = useRef(0);
  const reported = useRef(false);

  useFrame((_, dt) => {
    if (reported.current) return;
    frames.current += 1;
    if (frames.current <= warmupFrames) return;
    deltas.current.push(dt * 1000);
    if (deltas.current.length < sampleFrames) return;
    reported.current = true;
    const sorted = [...deltas.current].sort((a, b) => a - b);
    const meanMs = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const medianMs = sorted[Math.floor(sorted.length / 2)] ?? meanMs;
    onReport({ medianMs, meanMs, samples: sorted.length });
  });

  return null;
}

function StudioCanvas({
  label,
  children,
  stats,
  frames,
  onFrames,
  samplerKey,
  orbit,
}: {
  label: string;
  children: ReactNode;
  stats: BuildStats | null;
  frames: FrameStats | null;
  onFrames: (stats: FrameStats) => void;
  samplerKey: string;
  orbit: boolean;
}) {
  return (
    <section className="avatar-compare__stage" aria-label={label} data-compare-side={label}>
      <Canvas
        dpr={1}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          preserveDrawingBuffer: true,
        }}
        camera={CAMERA}
        shadows
        onCreated={({ gl, scene, camera }) => {
          dressScene(scene, gl);
          camera.lookAt(0, 0.9, 0);
        }}
      >
        {children}
        <FrameSampler key={samplerKey} onReport={onFrames} />
        {orbit ? (
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
        ) : null}
      </Canvas>
      <p className="avatar-compare__readout">
        {stats
          ? `${label} · ${stats.meshes} 件 · ${stats.verts.toLocaleString()} 顶点 · 首建 ${stats.buildMs}ms${
              frames
                ? ` · 帧 ${frames.medianMs.toFixed(2)}ms 中位 / ${frames.meanMs.toFixed(2)}ms 均 (${frames.samples} 帧)`
                : " · 帧采样中"
            }`
          : `${label} · 构建中`}
      </p>
    </section>
  );
}

export function AvatarCompare({ onOpen }: { onOpen: (view: View) => void }) {
  const initial = parseCompareHash(location.hash);
  const [seedText, setSeedText] = useState(initial.seed);
  const [species, setSpecies] = useState<string | null>(initial.species);
  const [gaze, setGaze] = useState(initial.gaze);
  const [orbit, setOrbit] = useState(initial.orbit);
  const [solo, setSolo] = useState<CompareSolo | null>(initial.solo);
  const [oursStats, setOursStats] = useState<BuildStats | null>(null);
  const [kitStats, setKitStats] = useState<BuildStats | null>(null);
  const [oursFrames, setOursFrames] = useState<FrameStats | null>(null);
  const [kitFrames, setKitFrames] = useState<FrameStats | null>(null);

  const writeHash = useCallback((next: CompareQuery) => {
    const hash = toCompareHash(next);
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const next = parseCompareHash(location.hash);
      setSeedText(next.seed);
      setSpecies(next.species);
      setSolo(next.solo);
      setGaze(next.gaze);
      setOrbit(next.orbit);
      setOursStats(null);
      setKitStats(null);
      setOursFrames(null);
      setKitFrames(null);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const apply = useCallback(
    (next: Partial<CompareQuery> & { seed?: string }) => {
      const query: CompareQuery = {
        seed: next.seed ?? seedText,
        species: next.species === undefined ? species : next.species,
        solo: next.solo === undefined ? solo : next.solo,
        gaze: next.gaze ?? gaze,
        orbit: next.orbit ?? orbit,
      };
      setSeedText(query.seed);
      setSpecies(query.species);
      setSolo(query.solo);
      setGaze(query.gaze);
      setOrbit(query.orbit);
      setOursStats(null);
      setKitStats(null);
      setOursFrames(null);
      setKitFrames(null);
      writeHash(query);
    },
    [gaze, orbit, seedText, solo, species, writeHash],
  );

  const oursRecipe = useMemo(() => {
    const raw = oursRandomRecipe(seedText);
    return species ? pinSpecies(raw, species, oursFillRecipe) : raw;
  }, [seedText, species]);

  const kitRecipe = useMemo(() => {
    const raw = kitRandomRecipe(seedText);
    return species ? pinSpecies(raw, species, kitFillRecipe) : raw;
  }, [seedText, species]);

  const recipesEqual = recipeJson(oursRecipe) === recipeJson(kitRecipe);
  const oursReady = solo === "kit" || oursStats !== null;
  const kitReady = solo === "ours" || kitStats !== null;
  const framesReady =
    (solo === "kit" || oursFrames !== null) && (solo === "ours" || kitFrames !== null);
  const compareReady = oursReady && kitReady;

  const onKitBuilt = useCallback((avatar: KitAvatarHandle) => {
    setKitStats({
      meshes: avatar.stats.meshes,
      verts: avatar.stats.verts,
      buildMs: avatar.stats.buildMs,
    });
  }, []);

  return (
    <main
      className="avatar-compare"
      data-compare-ready={compareReady ? "1" : "0"}
      data-frames-ready={framesReady ? "1" : "0"}
      data-recipe-equal={recipesEqual ? "1" : "0"}
      data-seed={oursRecipe.seed}
      data-species={oursRecipe.species ?? ""}
      data-ours-verts={oursStats?.verts ?? ""}
      data-ours-build-ms={oursStats?.buildMs ?? ""}
      data-ours-meshes={oursStats?.meshes ?? ""}
      data-ours-frame-ms={oursFrames?.medianMs.toFixed(3) ?? ""}
      data-kit-verts={kitStats?.verts ?? ""}
      data-kit-build-ms={kitStats?.buildMs ?? ""}
      data-kit-meshes={kitStats?.meshes ?? ""}
      data-kit-frame-ms={kitFrames?.medianMs.toFixed(3) ?? ""}
    >
      {solo !== "kit" ? (
        <StudioCanvas
          label="ours"
          stats={oursStats}
          frames={oursFrames}
          onFrames={setOursFrames}
          samplerKey={`ours:${seedText}:${species ?? ""}:${gaze ? "1" : "0"}`}
          orbit={orbit}
        >
          <OursAvatar recipe={oursRecipe} gaze={gaze} onBuilt={setOursStats} />
        </StudioCanvas>
      ) : (
        <div
          className="avatar-compare__stage avatar-compare__stage--empty"
          data-compare-side="ours"
        />
      )}
      {solo !== "ours" ? (
        <StudioCanvas
          label="kit"
          stats={kitStats}
          frames={kitFrames}
          onFrames={setKitFrames}
          samplerKey={`kit:${seedText}:${species ?? ""}:${gaze ? "1" : "0"}`}
          orbit={orbit}
        >
          <KitAvatar recipe={kitRecipe} gaze={gaze} onBuilt={onKitBuilt} />
        </StudioCanvas>
      ) : (
        <div
          className="avatar-compare__stage avatar-compare__stage--empty"
          data-compare-side="kit"
        />
      )}

      <aside className="avatar-compare__dock">
        <GamePanel title="头像对照">
          <p className="avatar-compare__lede">
            同一粒种子，左边是 <code>packages/avatar</code>，右边是{" "}
            <code>@pieai/swimmer-avatar-kit@0.1.0</code>
            。相机、灯光、画布尺寸相同。
          </p>
          <div className="avatar-compare__actions">
            <GameButton type="button" variant="ghost" onClick={() => onOpen(WORLD)}>
              回到地图
            </GameButton>
            <GameButton
              type="button"
              variant="ghost"
              onClick={() => onOpen({ kind: "avatar-lab" })}
            >
              头像工坊
            </GameButton>
          </div>
          <p className="avatar-compare__verdict" data-recipe-equal={recipesEqual ? "1" : "0"}>
            {recipesEqual ? "配方 JSON 一致" : "配方 JSON 不一致"}
          </p>
          <GameToggle
            checked={gaze}
            label={gaze ? "注视开" : "注视关"}
            onClick={() => apply({ gaze: !gaze })}
          />
        </GamePanel>

        <GamePanel title="种子">
          <div className="avatar-compare__stack">
            <GameField label="配方" hint="两边各自 randomRecipe(seed)，再按物种 fillRecipe。">
              <GameInput
                value={seedText}
                onChange={(event) => setSeedText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") apply({ seed: seedText.trim() || DEFAULT_SEED });
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </GameField>
            <GameButton
              type="button"
              variant="secondary"
              onClick={() => apply({ seed: seedText.trim() || DEFAULT_SEED })}
            >
              应用种子
            </GameButton>
          </div>
        </GamePanel>

        <GamePanel title="物种">
          <div className="avatar-compare__chips" role="group" aria-label="物种">
            <GameButton
              type="button"
              variant={species === null ? "primary" : "ghost"}
              onClick={() => apply({ species: null })}
            >
              随种子
            </GameButton>
            {OURS_SPECIES.map((entry) => (
              <GameButton
                key={entry.id}
                type="button"
                variant={species === entry.id ? "primary" : "ghost"}
                onClick={() => apply({ species: entry.id })}
              >
                {entry.label}
              </GameButton>
            ))}
          </div>
        </GamePanel>

        <GamePanel title="取证预设">
          <div className="avatar-compare__chips" role="group" aria-label="取证预设">
            {COMPARE_PRESETS.map((preset) => (
              <GameButton
                key={preset.seed}
                type="button"
                variant={
                  seedText === preset.seed && species === preset.species ? "primary" : "ghost"
                }
                onClick={() => apply({ seed: preset.seed, species: preset.species })}
              >
                {preset.species}
              </GameButton>
            ))}
          </div>
        </GamePanel>

        <GamePanel title="帧成本">
          <p className="avatar-compare__lede">
            双画布同屏会互相抢帧。点一边单独跑 120 帧，才是可比较的稳态数字。
          </p>
          <div className="avatar-compare__chips" role="group" aria-label="单独测量">
            <GameButton
              type="button"
              variant={solo === null ? "primary" : "ghost"}
              onClick={() => apply({ solo: null })}
            >
              并排
            </GameButton>
            <GameButton
              type="button"
              variant={solo === "ours" ? "primary" : "ghost"}
              onClick={() => apply({ solo: "ours" })}
            >
              只测 ours
            </GameButton>
            <GameButton
              type="button"
              variant={solo === "kit" ? "primary" : "ghost"}
              onClick={() => apply({ solo: "kit" })}
            >
              只测 kit
            </GameButton>
          </div>
        </GamePanel>

        <p className="avatar-compare__meta">
          ours {OURS_SPECIES.length} 物种 · kit {KIT_SPECIES.length} 物种 · seed {oursRecipe.seed}
        </p>
      </aside>
    </main>
  );
}

const DEFAULT_SEED = COMPARE_PRESETS[0].seed;
