import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { LiquidAnchor, LiquidPresence, LiquidReveal } from "@pieai/swimmer-ui-kit/liquid-presence";
import {
  NerveLiquidInteraction,
  type LiquidInteractionRenderers,
  type NerveQuickQuestion,
} from "@pieai/swimmer-nerve-kit/liquid-interaction";
import {
  createObjectSelection,
  type ObjectSelectionBasis,
  type ObjectSelectionController,
} from "@pieai/swimmer-nerve-kit/object-selection";
import { nervePresenceTarget, type NervePresenceTarget } from "@pieai/swimmer-nerve-kit/presence";
import { createTargetRegistry } from "@pieai/swimmer-nerve-kit/targets";
import { useOverlayReservation } from "@pieai/university-world/overlay-reservations.js";
import { translate as t } from "@pieai/university-ui/i18n.js";
import {
  comparableMarkers,
  mapGuideAnswer,
  mapGuideQuestions,
  markerDescriptor,
  markerTargetId,
  navTargetIds,
  placeTargetIds,
  type MapGuideAnswer,
  type MapGuideMap,
  type MapGuideQuestion,
} from "./map-guide.js";
import {
  placedByEngine,
  reconcileTargets,
  releaseTargets,
  type ElementTargetSpec,
  type RegisteredTarget,
} from "./map-targets.js";
import "./map-guide.css";

/**
 * 涟 on the map (ADR-0012, phase one; V5 #map-guide). The droplet sits at the
 * bottom centre of the stage and owns the map's first sentence — the entry
 * hint that used to float there on its own. Asked a question, it answers from
 * the map and flies to the one place the answer names.
 *
 * Since SwimmerNerveKit 0.4 the entry itself is the kit's
 * `NerveLiquidInteraction`: its quick questions, its close and its motion
 * controls, drawn by SwimmerUIKit's liquid body, reveal and anchor. University
 * supplies what only it knows — the questions, the answers read from the map,
 * the places registered by identity, and the one action each place already
 * has. No model, no free text and no voice are wired: nothing is offered that
 * cannot answer (the kit shows no text box without `onText`).
 */
export function MapGuide({
  map,
  opening,
  openingVisible,
  onShortcuts,
  onOpenDetails,
}: {
  readonly map: MapGuideMap;
  /** The map's first sentence, said until the learner has picked once. */
  readonly opening: ReactNode;
  readonly openingVisible: boolean;
  readonly onShortcuts: () => void;
  /** Where 涟's capabilities, cost and privacy are explained: Settings. */
  readonly onOpenDetails?: () => void;
}) {
  const registry = useMemo(() => createTargetRegistry(), []);
  const registered = useRef(new Map<string, RegisteredTarget>());
  const root = useRef<HTMLDivElement>(null);
  const seat = useRef<HTMLDivElement>(null);
  const reserve = useOverlayReservation("map-guide");
  const scope = useScopeSource(map.scope);
  const [outletOpen, setOutletOpen] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [compare, setCompare] = useState<Compare | null>(null);
  const gesture = useRef(0);
  const shortcuts = useRef(onShortcuts);
  shortcuts.current = onShortcuts;
  const compareRef = useRef(compare);
  compareRef.current = compare;
  const selectionView = useSyncExternalStore(
    compare?.selection.subscribe ?? noSubscription,
    compare?.selection.getSnapshot ?? noSelection,
    compare?.selection.getSnapshot ?? noSelection,
  );
  const expired =
    compare?.basis != null &&
    (selectionView?.status !== "active" || selectionView.key !== compare.basis.context.key);
  // The question list closes under the pointer; the next control gets focus.
  const pendingFocus = useRef<"answer" | "compare" | null>(null);
  const goRef = useRef<HTMLDivElement>(null);
  const candidatesRef = useRef<HTMLUListElement>(null);

  // Answers are read from the map as it is now.
  const answers = useMemo(
    () =>
      new Map(
        mapGuideQuestions(map.view).map((question) => [
          question,
          mapGuideAnswer(question, map, () => shortcuts.current()),
        ]),
      ),
    [map],
  );
  const comparable = useMemo(() => comparableMarkers(map.markers), [map.markers]);
  const questions = useMemo<readonly NerveQuickQuestion[]>(
    () =>
      [...answers.keys()].map((question) => ({
        id: question,
        label: t(`map.guide.q.${question}`),
        ...(question === "compare" && comparable.length < 2 ? { disabled: true } : {}),
      })),
    [answers, comparable.length],
  );

  // Every place the map shows is registered by identity, bound to the element
  // the map already renders; the DOM adapter reads it only when asked.
  useLayoutEffect(() => {
    const stage = root.current?.closest<HTMLElement>(".stagewrap");
    const shell = root.current?.closest<HTMLElement>(".app-shell") ?? document;
    const next: ElementTargetSpec[] = [];
    for (const marker of map.markers) {
      const element = stage?.querySelector(`[data-map-marker="${CSS.escape(marker.id)}"]`);
      if (element)
        next.push({
          id: markerTargetId(marker.id),
          element,
          ...markerDescriptor(marker, map),
          available: placedByEngine,
        });
    }
    for (const navId of ["practice", "more"] as const) {
      const [railId, tabsId] = navTargetIds(navId);
      const label = t(`map.guide.place.${navId}`);
      const rail = shell.querySelector(`.nav-rail [data-nav-id="${navId}"]`);
      const tabs = shell.querySelector(`.tab-bar [data-nav-id="${navId}"]`);
      if (rail) next.push({ id: railId!, element: rail, label });
      if (tabs) next.push({ id: tabsId!, element: tabs, label });
    }
    const changed = reconcileTargets(registry, registered.current, next);
    // A replaced island is not the one the learner chose: the kit's
    // selection sees it on refresh and expires the comparison.
    const selection = compareRef.current?.selection;
    if (selection?.getSnapshot().items.some((item) => changed.has(item.id))) selection.refresh();
  }, [map, registry]);
  useEffect(() => {
    const current = registered.current;
    return () => releaseTargets(current);
  }, []);

  // A new scope — another account, study, view or course — is a new map:
  // nothing said or selected on the old one survives into it.
  useEffect(() => {
    setShown(null);
    setCompare(null);
  }, [map.scope]);
  useEffect(() => () => compare?.selection.dispose(), [compare?.selection]);

  // Point only once the answer panel has shrunk and the labels have stepped
  // around it; a place the learner cannot see is said, not flown to.
  useEffect(() => {
    if (!shown || shown.resolved) return;
    return afterLayout(() => {
      const place = shown.answer.place;
      const target = place
        ? (placeTargetIds(place)
            .map((id) => nervePresenceTarget(registry, id, `${id}#${shown.key}`))
            .find((candidate) => candidate !== null) ?? null)
        : null;
      setShown((current) =>
        current?.key === shown.key
          ? { ...current, target, resolved: true, unseen: place !== null && target === null }
          : current,
      );
    });
  }, [shown, registry]);

  // The islands a comparison can be made of, read once the panel has settled.
  useEffect(() => {
    if (!compare || compare.candidates !== null) return;
    return afterLayout(() => {
      const candidates = comparable.flatMap((marker) => {
        const found = registry.locate(markerTargetId(marker.id));
        return found ? [{ id: found.id, label: found.label }] : [];
      });
      setCompare((current) =>
        current?.key === compare.key ? { ...current, candidates } : current,
      );
    });
  }, [compare, comparable, registry]);

  function ask(id: string): void | false {
    const question = id as MapGuideQuestion;
    const answer = answers.get(question);
    if (!answer) return false;
    const key = ++gesture.current;
    // A new question retires the old one, including an open comparison.
    setShown(null);
    setCompare(null);
    if (question === "compare") {
      setCompare({
        key,
        selection: createObjectSelection({
          id: `map-guide.compare.${key}`,
          scope: scope.read(),
          targets: registry,
          readScope: scope.read,
          subscribeScope: scope.subscribe,
        }),
        candidates: null,
        basis: null,
        notice: null,
      });
    } else {
      setShown({ key, answer, target: null, resolved: answer.place === null, unseen: false });
    }
    pendingFocus.current = question === "compare" ? "compare" : "answer";
  }

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || (pending === "compare" && compare?.candidates === null)) return;
    pendingFocus.current = null;
    const next =
      (pending === "answer"
        ? goRef.current?.querySelector<HTMLElement>("button")
        : candidatesRef.current?.querySelector<HTMLElement>("button:not(:disabled)")) ??
      seat.current?.querySelector<HTMLElement>("button");
    requestAnimationFrame(() => next?.focus({ preventScroll: true }));
  });

  function choose(targetId: string) {
    if (!compare) return;
    const label = compare.candidates?.find((item) => item.id === targetId)?.label ?? "";
    if (!compare.selection.add(targetId)) {
      // Gone from the map since the list was read: say so, read it again.
      setCompare({
        ...compare,
        candidates: null,
        notice: t("map.guide.compare.gone", { title: label }),
      });
      return;
    }
    if (compare.selection.getSnapshot().items.length < 2) {
      setCompare({ ...compare, notice: null });
      return;
    }
    const basis = compare.selection.capture();
    if (!basis) compare.selection.clear();
    setCompare({
      ...compare,
      basis,
      candidates: basis ? compare.candidates : null,
      notice: basis ? null : t("map.guide.compare.expired"),
    });
  }

  function clear() {
    setShown(null);
    setCompare(null);
  }

  const renderers = useMemo<LiquidInteractionRenderers>(
    () => ({
      body: (props) => (
        <LiquidPresence
          {...props}
          onDismiss={() =>
            setShown((current) => (current ? { ...current, target: null } : current))
          }
        />
      ),
      frame: (content, props) => <LiquidReveal {...props}>{content}</LiquidReveal>,
      // Centred over a droplet that sits at the bottom centre.
      outlet: (content, props) => (
        <LiquidAnchor {...props} placement="top">
          {content}
        </LiquidAnchor>
      ),
    }),
    [],
  );

  const place = shown?.answer.place;
  const message = shown
    ? [
        shown.answer.text,
        shown.unseen && place
          ? t(place.kind === "marker" ? "map.guide.offscreen.map" : "map.guide.offscreen.menu")
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    : compare
      ? compareMessage(compare, selectionView, expired)
      : null;
  const go = shown?.answer.go;
  const activity = go ? (
    <div ref={goRef} className="map-guide__go">
      <GameButton
        variant="primary"
        onClick={() => {
          clear();
          go.run();
        }}
      >
        {go.label}
      </GameButton>
    </div>
  ) : compare && compare.candidates !== null ? (
    <MapGuideComparison
      compare={compare}
      view={selectionView}
      expired={expired}
      listRef={candidatesRef}
      onChoose={choose}
      onAgain={() => {
        compare.selection.clear();
        setCompare({ ...compare, basis: null, candidates: null, notice: null });
      }}
    />
  ) : null;

  return (
    <div ref={root} className="map-guide" data-map-guide={outletOpen ? "open" : "closed"}>
      {outletOpen ? null : (
        <p
          className={`hint hint--entry map-guide__opening${openingVisible ? "" : " hint--dismissed"}`}
          data-game-ui-tone="glass"
        >
          {opening}
        </p>
      )}
      <div ref={seat} className="map-guide__seat">
        <NerveLiquidInteraction
          renderers={renderers}
          questions={questions}
          onQuestion={ask}
          target={shown?.target ?? null}
          message={message}
          activity={activity}
          onDismissPeek={clear}
          onDismissGuide={clear}
          onBoundsChange={(rect) => {
            reserve(rect);
            setOutletOpen(rect !== null);
          }}
          onOpenDetails={onOpenDetails}
        />
      </div>
    </div>
  );
}

interface Shown {
  readonly key: number;
  readonly answer: MapGuideAnswer;
  readonly target: NervePresenceTarget | null;
  /** Whether the place has been looked for yet (see the pointing effect). */
  readonly resolved: boolean;
  /** Looked for and not on screen: said, not flown to. */
  readonly unseen: boolean;
}

type SelectionView = ReturnType<ObjectSelectionController["getSnapshot"]>;
const noSubscription = () => () => {};
const noSelection = (): SelectionView | null => null;

interface Compare {
  readonly key: number;
  readonly selection: ObjectSelectionController;
  /** Islands on screen when last read; null until the panel has settled. */
  readonly candidates: readonly { readonly id: string; readonly label: string }[] | null;
  /** Captured at the learner's second choice, in the order they chose. */
  readonly basis: ObjectSelectionBasis | null;
  readonly notice: string | null;
}

function compareMessage(compare: Compare, view: SelectionView | null, expired: boolean): string {
  if (compare.notice) return compare.notice;
  if (compare.basis) return t(expired ? "map.guide.compare.expired" : "map.guide.compare.note");
  const first = view?.items[0];
  if (first) return t("map.guide.compare.first", { title: first.label });
  if (compare.candidates !== null && compare.candidates.length < 2)
    return t("map.guide.compare.none");
  return t("map.guide.a.compare");
}

/**
 * Two islands the learner chose, side by side, in the order chosen. What each
 * says is the description University registered for it — its own state and
 * count — so nothing here is inferred: no order between the courses, no
 * score, nothing submitted. It expires when either island is replaced, the
 * scope changes, or another question is asked.
 */
function MapGuideComparison({
  compare,
  view,
  expired,
  listRef,
  onChoose,
  onAgain,
}: {
  readonly compare: Compare;
  readonly view: SelectionView | null;
  readonly expired: boolean;
  readonly listRef: RefObject<HTMLUListElement | null>;
  readonly onChoose: (targetId: string) => void;
  readonly onAgain: () => void;
}) {
  const { basis } = compare;
  if (basis && !expired) {
    return (
      <div className="map-guide__compare" data-guide-compare="result">
        <ol className="map-guide__pair" aria-label={t("map.guide.compare.title")}>
          {basis.context.objects.map((object, index) => (
            <li key={object.id}>
              <strong>
                {index + 1} · {object.label}
              </strong>
              {object.description ? <span>{object.description}</span> : null}
            </li>
          ))}
        </ol>
        <GameButton variant="secondary" onClick={onAgain}>
          {t("map.guide.compare.again")}
        </GameButton>
      </div>
    );
  }
  if (basis) {
    return (
      <div className="map-guide__compare" data-guide-compare="expired">
        <GameButton variant="secondary" onClick={onAgain}>
          {t("map.guide.compare.again")}
        </GameButton>
      </div>
    );
  }
  const chosen = new Set(view?.items.map((item) => item.id));
  const candidates = compare.candidates ?? [];
  if (candidates.length < 2 && chosen.size === 0) return null;
  return (
    <ul
      ref={listRef}
      className="map-guide__compare map-guide__candidates"
      data-guide-compare="choose"
      aria-label={t("map.guide.compare.pick")}
    >
      {candidates.map((candidate) => (
        <li key={candidate.id}>
          <GameButton
            variant="secondary"
            aria-pressed={chosen.has(candidate.id)}
            disabled={chosen.has(candidate.id) || view?.status !== "active"}
            onClick={() => onChoose(candidate.id)}
          >
            {chosen.has(candidate.id) ? `1 · ${candidate.label}` : candidate.label}
          </GameButton>
        </li>
      ))}
    </ul>
  );
}

/**
 * The assistance scope as a source the kit can read and watch. Changing it
 * closes every session opened under the old one (the kit's own rule).
 */
function useScopeSource(scope: string) {
  const current = useRef(scope);
  const listeners = useRef(new Set<() => void>());
  const source = useMemo(
    () => ({
      read: () => ({ id: current.current }),
      subscribe: (listener: () => void) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [],
  );
  useLayoutEffect(() => {
    if (current.current === scope) return;
    current.current = scope;
    for (const listener of listeners.current) listener();
  }, [scope]);
  return source;
}

/**
 * Run after the next few frames: the answer panel's new size reaches the
 * label layout through `onBoundsChange`, and the projector places the labels
 * on its following frame. Returns a cancel for an effect's cleanup.
 */
function afterLayout(run: () => void): () => void {
  let frames = 0;
  let handle = requestAnimationFrame(function wait() {
    if (++frames < 3) handle = requestAnimationFrame(wait);
    else run();
  });
  return () => cancelAnimationFrame(handle);
}
