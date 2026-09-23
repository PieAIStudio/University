import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { binColour } from "@pieai/university-ui/game-frame/palette.js";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Ball as ToyBall, Block, Star } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import type { InterceptSession, InterceptState } from "./rules/intercept.js";
import { AnchoredLabels, type AnchoredLabel } from "./scene/AnchoredLabels.js";
import { COURTYARD, Courtyard, basketSpots, courtyardBox } from "./scene/Courtyard.js";
import { GameHero, type GameHeroHandle } from "./scene/GameHero.js";
import { Basket, Note, PaperBoat } from "./scene/props.js";
import { fitStage } from "./scene/stage-fit.js";

/**
 * 庭院拦截's scene: the kit's blocks arranged for this mechanic (ADR-0011).
 * It reads the session and never writes it, except to advance time; input
 * reaches the session through the frame's buttons and the boat labels.
 */
export interface InterceptSceneProps {
  readonly session: InterceptSession;
  readonly snapshot: InterceptState;
  readonly recipe?: AvatarRecipe | null;
  /** Stops time: paused, hidden, a panel open. */
  readonly frozen: boolean;
  readonly booting: boolean;
  /** Pixels the frame covers over the canvas's top and bottom edges. */
  readonly hud: { readonly top: number; readonly bottom: number };
  /** What a boat label says to a screen reader. */
  readonly describeBoat: (text: string, revealedBin: string | null, aimed: boolean) => string;
  readonly onTarget: (boatId: number) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

const colour = (index: number) => new THREE.Color(binColour(index)).getHex();
const BOAT_Y = COURTYARD.pond.surface + 0.06;
const BOAT_SCALE = 1.5;

class Boundary extends Component<{ children: ReactNode; fail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.fail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Framing({ hud }: Pick<InterceptSceneProps, "hud">) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !size.height) return;
    const aspect = size.width / size.height;
    const fit = fitStage(courtyardBox(aspect), aspect, {
      top: Math.min(0.4, (hud.top + 8) / size.height),
      bottom: Math.min(0.2, (hud.bottom + 6) / size.height),
    });
    camera.fov = fit.fov;
    camera.position.copy(fit.position);
    camera.lookAt(fit.target);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, hud.top, hud.bottom]);
  return null;
}

function Clock({ session, frozen }: Pick<InterceptSceneProps, "session" | "frozen">) {
  useFrame((_, delta) => {
    if (!frozen) session.advance(delta);
  }, -2);
  return null;
}

function BoatView({
  id,
  session,
  sail,
  reducedMotion,
}: {
  id: number;
  session: InterceptSession;
  sail: number;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const node = group.current;
    const boat = session.getState().boats.find((b) => b.id === id);
    if (!node) return;
    node.visible = Boolean(boat);
    if (!boat) return;
    const t = session.getState().elapsed;
    const bob = reducedMotion ? 0 : Math.sin(t * 2.4 + boat.sway) * 0.03;
    node.position.set(boat.x, BOAT_Y + bob, boat.z);
    // Broadside to the camera, so the hull and the sail read as a boat.
    node.rotation.set(0, reducedMotion ? 0 : Math.sin(t * 1.3 + boat.sway) * 0.12, 0);
    let scale = BOAT_SCALE * Math.min(1, boat.progress / 0.04);
    if (boat.state === "sunk") {
      // Tip over and go under.
      node.rotation.x = Math.min(1.2, boat.gone * 2.4);
      node.position.y -= boat.gone * 0.5;
      scale *= Math.max(0, 1 - boat.gone / 1.1);
    } else if (boat.state === "docked") {
      scale *= Math.max(0, 1 - boat.gone / 0.6);
    }
    node.scale.setScalar(Math.max(0.001, scale));
  });
  return (
    <group ref={group} name={`game-boat-${id}`}>
      <PaperBoat sailColour={sail} />
    </group>
  );
}

function BallView({ id, session, tint }: { id: number; session: InterceptSession; tint: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const node = group.current;
    const ball = session.getState().balls.find((b) => b.id === id);
    if (!node) return;
    node.visible = Boolean(ball);
    if (ball) node.position.set(ball.x, ball.y, ball.z);
  });
  return (
    <group ref={group} name={`game-ball-${id}`}>
      <ToyBall position={[0, 0, 0]} size={[0.17, 0.17, 0.17]} color={tint} />
    </group>
  );
}

interface Effect {
  readonly key: number;
  readonly kind: "stars" | "puff" | "splash" | "note";
  readonly from: THREE.Vector3;
  readonly to?: THREE.Vector3;
}

function EffectView({ effect, done }: { effect: Effect; done: (key: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const age = useRef(0);
  const life = effect.kind === "note" ? 0.65 : 0.7;
  useFrame((_, delta) => {
    age.current += delta;
    const node = group.current;
    if (!node) return;
    const k = Math.min(1, age.current / life);
    if (effect.kind === "note" && effect.to) {
      node.position.lerpVectors(effect.from, effect.to, k);
      node.position.y += Math.sin(Math.PI * k) * 1.6;
      node.rotation.y = k * 6;
    } else {
      node.children.forEach((child, i) => {
        const a = (i / node.children.length) * Math.PI * 2;
        const r = k * (effect.kind === "splash" ? 0.7 : 0.9);
        child.position.set(
          Math.cos(a) * r,
          k * (effect.kind === "splash" ? 0.6 : 1.1),
          Math.sin(a) * r,
        );
        child.scale.setScalar(Math.max(0.01, 1 - k));
      });
    }
    if (age.current >= life) done(effect.key);
  });
  const bits = effect.kind === "stars" ? 5 : 4;
  return (
    <group ref={group} position={effect.from}>
      {effect.kind === "note" ? (
        <Note />
      ) : (
        Array.from({ length: bits }, (_, i) => (
          <group key={i}>
            {effect.kind === "stars" ? (
              <Star scale={0.16} />
            ) : effect.kind === "splash" ? (
              <ToyBall position={[0, 0, 0]} size={[0.09, 0.09, 0.09]} color={TOY.water} />
            ) : (
              <Block size={[0.12, 0.12, 0.12]} color={TOY.coral} />
            )}
          </group>
        ))
      )}
    </group>
  );
}

function Director({
  session,
  hero,
  reducedMotion,
  onRight,
  addEffect,
}: {
  session: InterceptSession;
  hero: RefObject<GameHeroHandle | null>;
  reducedMotion: boolean;
  onRight: (binId: string) => void;
  addEffect: (effect: Omit<Effect, "key">) => void;
}) {
  const seen = useRef(0);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const state = session.getState();
    const round = session.currentRound()?.round;
    for (const event of state.events) {
      if (event.id <= seen.current) continue;
      seen.current = event.id;
      const boat =
        "boatId" in event ? state.boats.find((candidate) => candidate.id === event.boatId) : null;
      if (boat) point.set(boat.x, BOAT_Y + 0.3, boat.z);
      switch (event.kind) {
        case "throw":
          if (boat) hero.current?.look(point.clone());
          hero.current?.act("throw", { speed: 1.6 });
          break;
        case "right": {
          hero.current?.feel("happy", 0.8);
          if (!reducedMotion && boat) addEffect({ kind: "stars", from: point.clone() });
          const index = round?.bins.findIndex((bin) => bin.id === event.binId) ?? -1;
          const spot = basketSpots(round?.bins.length ?? 2)[index];
          if (boat && spot)
            addEffect({
              kind: "note",
              from: point.clone(),
              to: new THREE.Vector3(spot.x, COURTYARD.terrace.top + 0.6, spot.z),
            });
          onRight(event.binId);
          break;
        }
        case "wrong":
          hero.current?.act("flinch");
          hero.current?.feel("surprised", 0.9);
          if (!reducedMotion && boat) addEffect({ kind: "puff", from: point.clone() });
          break;
        case "docked":
          hero.current?.act("flinch");
          hero.current?.feel("sad", 1);
          if (!reducedMotion && boat) addEffect({ kind: "splash", from: point.clone() });
          break;
        case "round-clear":
        case "won":
          hero.current?.look(null);
          hero.current?.act("cheer");
          hero.current?.feel("happy", 1.6);
          break;
        case "lost":
          hero.current?.look(null);
          hero.current?.feel("sad", 4);
          break;
      }
    }
  });
  return null;
}

export function InterceptScene(props: InterceptSceneProps) {
  const { session, snapshot, frozen, booting, hud } = props;
  const reducedMotion = usePrefersReducedMotion();
  const hero = useRef<GameHeroHandle>(null);
  const round = snapshot.rounds[snapshot.roundIndex]?.round ?? null;
  const bins = round?.bins ?? [];
  const binIndex = useCallback(
    (binId: string) => bins.findIndex((bin) => bin.id === binId),
    [bins],
  );
  const [effects, setEffects] = useState<Effect[]>([]);
  const serial = useRef(0);
  const addEffect = useCallback((effect: Omit<Effect, "key">) => {
    setEffects((list) => [...list.slice(-11), { ...effect, key: ++serial.current }]);
  }, []);
  const dropEffect = useCallback((key: number) => {
    setEffects((list) => list.filter((effect) => effect.key !== key));
  }, []);
  // Notes in each basket this round.
  const [collected, setCollected] = useState<Record<string, number>>({});
  const roundKey = `${snapshot.roundIndex}/${round?.id ?? ""}`;
  useEffect(() => setCollected({}), [roundKey]);
  const onRight = useCallback(
    (binId: string) => setCollected((counts) => ({ ...counts, [binId]: (counts[binId] ?? 0) + 1 })),
    [],
  );
  const spots = basketSpots(bins.length);
  const heroY = COURTYARD.terrace.top + 0.1;

  const labels: AnchoredLabel[] = [
    ...snapshot.boats
      .filter((boat) => boat.state === "sailing")
      .map((boat) => {
        const item = round?.items.find((candidate) => candidate.id === boat.itemId);
        const right = boat.revealed && item ? binIndex(item.binId) : -1;
        const aimed = snapshot.targetId === boat.id;
        return {
          id: boat.id,
          priority: 10 + boat.progress,
          selected: aimed,
          ariaLabel: props.describeBoat(
            item?.text ?? "",
            right >= 0 ? bins[right]!.label : null,
            aimed,
          ),
          onPick: () => props.onTarget(boat.id),
          content: (
            <>
              {item?.text}
              {right >= 0 ? (
                <small style={{ background: binColour(right) }}>{bins[right]!.label}</small>
              ) : null}
            </>
          ),
        } satisfies AnchoredLabel;
      }),
    ...bins.map((bin, index) => ({
      id: -1 - index,
      priority: 0,
      className: "game-label--basket",
      content: (
        <>
          {bin.label}
          {collected[bin.id] ? ` · ${collected[bin.id]}` : ""}
        </>
      ),
    })),
  ];
  const anchor = (id: number, out: THREE.Vector3) => {
    if (id < 0) {
      const spot = spots[-1 - id];
      if (!spot) return false;
      out.set(spot.x, COURTYARD.terrace.top + 0.75, spot.z);
      return true;
    }
    const boat = session.getState().boats.find((b) => b.id === id && b.state === "sailing");
    if (!boat || boat.progress < 0.03) return false;
    out.set(boat.x, BOAT_Y + 1.2, boat.z);
    return true;
  };

  return (
    <Boundary fail={props.onFailure}>
      <Stage
        cameraFrom={[0, 12, 13]}
        lookAt={[0, 0, -0.5]}
        cameraFar={200}
        paused={frozen && !booting}
        onSceneReady={props.onReady}
        onRendererUnavailable={props.onFailure}
        onContextLost={props.onFailure}
      >
        <color attach="background" args={[TOY.sky]} />
        <Framing hud={hud} />
        <Clock session={session} frozen={frozen} />
        <Courtyard baskets={Math.max(2, bins.length)} />
        {spots.map((spot, index) => (
          <group key={`${roundKey}/${index}`} position={[spot.x, COURTYARD.terrace.top, spot.z]}>
            <Basket colour={colour(index)} notes={collected[bins[index]?.id ?? ""] ?? 0} />
          </group>
        ))}
        <GameHero
          ref={hero}
          position={[COURTYARD.hero.x, heroY, COURTYARD.hero.z]}
          recipe={props.recipe ?? null}
          reducedMotion={reducedMotion}
          paused={frozen && !booting}
        />
        {snapshot.boats.map((boat) => {
          const item = round?.items.find((candidate) => candidate.id === boat.itemId);
          const right = boat.revealed && item ? binIndex(item.binId) : -1;
          return (
            <BoatView
              key={boat.id}
              id={boat.id}
              session={session}
              sail={right >= 0 ? colour(right) : TOY.cream}
              reducedMotion={reducedMotion}
            />
          );
        })}
        {snapshot.balls.map((ball) => (
          <BallView
            key={ball.id}
            id={ball.id}
            session={session}
            tint={colour(Math.max(0, binIndex(ball.binId)))}
          />
        ))}
        {effects.map((effect) => (
          <EffectView key={effect.key} effect={effect} done={dropEffect} />
        ))}
        <Director
          session={session}
          hero={hero}
          reducedMotion={reducedMotion}
          onRight={onRight}
          addEffect={addEffect}
        />
        <AnchoredLabels labels={labels} anchor={anchor} inset={hud} />
      </Stage>
    </Boundary>
  );
}
