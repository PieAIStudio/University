import { useMemo, useRef, useState, type ReactNode } from "react";
import { GameButton, GameHudActions, GameInput, GamePanel, GameTabs } from "@pieai/swimmer-ui-kit";
import { selectActivityLevel, type ActivityDifficulty } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { AI_MODES, getLabExamples } from "../learning-play/LearningPlayLab.js";
import { getExampleFamily } from "../learning-play/difficulty-examples.js";
import { LearningActivity } from "../learning-play/LearningActivity.js";
import { PrototypeFrame } from "./PrototypeFrame.js";
import {
  CATALOG_GROUPS,
  createCatalog,
  filterCatalog,
  type CatalogEntry,
  type CatalogGroup,
  type NativeKind,
  type PrototypeSources,
} from "./registry.js";

function NativePlay({ kind }: { readonly kind: NativeKind }) {
  const interfaceTranslator = useI18n();
  const { locale } = useI18n();
  const [variant, setVariant] = useState(0);
  const [difficulty, setDifficulty] = useState<ActivityDifficulty>("intro");
  const examples = useMemo(
    () =>
      getLabExamples(AI_MODES.some((mode) => mode === kind) ? "ai" : "foundations").filter(
        (example) => example.kind === kind,
      ),
    [kind, locale],
  );
  const family = useMemo(() => getExampleFamily(examples[variant]!), [examples, variant]);
  return (
    <div className="play-catalog__native">
      <GameButton
        static
        sound={false}
        variant="ghost"
        onClick={() => setVariant((variant + 1) % examples.length)}
      >
        {interfaceTranslator.t("play.lab.example")}
      </GameButton>
      <LearningActivity
        key={family.id}
        activity={selectActivityLevel(family, difficulty)}
        levels={{ id: family.id, levels: family.levels }}
        initialDifficulty={difficulty}
        onLevelChange={setDifficulty}
        onResult={() => undefined}
      />
    </div>
  );
}

export function PlayCatalog({
  sources,
  presentation,
  renderThree,
  learner = false,
}: {
  readonly sources: PrototypeSources;
  readonly presentation: string;
  /** Library presentation reuses every playable activity; author diagnostics
   * and historic layout comparisons remain in the retained laboratory. */
  readonly learner?: boolean;
  readonly renderThree?: (mode: NonNullable<CatalogEntry["threeMode"]>) => ReactNode;
}) {
  const interfaceTranslator = useI18n();
  const { locale } = useI18n();
  const entries = useMemo(
    () => createCatalog(sources).filter((entry) => !learner || entry.group !== "history"),
    [sources, learner],
  );
  const groups = CATALOG_GROUPS.filter((id) => !learner || id !== "history");
  const title = interfaceTranslator.t(learner ? "album.courseware" : "gallery.title");
  const groupLabel = (id: CatalogGroup | "all") =>
    interfaceTranslator.t(learner ? `doors.courseware.${id}` : `gallery.${id}`);
  const [group, setGroup] = useState<CatalogGroup | "all">(
    () => groups.find((g) => g === new URLSearchParams(location.search).get("group")) ?? "all",
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const requested = new URLSearchParams(location.search).get("entry");
    return (
      entries.find((e) => e.id === requested)?.id ??
      entries.find((e) => group === "all" || e.group === group)?.id ??
      null
    );
  });
  const [round, setRound] = useState(0);
  const playArea = useRef<HTMLElement>(null);
  const picker = useRef<HTMLDetailsElement>(null);
  const listButton = useRef<HTMLButtonElement>(null);
  const shown = useMemo(
    () => filterCatalog(entries, group, query, interfaceTranslator.t),
    [entries, group, query, locale],
  );
  const selected = entries.find((entry) => entry.id === selectedId);
  const choose = (entry: CatalogEntry) => {
    setSelectedId(entry.id);
    const url = new URL(location.href);
    url.searchParams.set("entry", entry.id);
    url.searchParams.set("group", group);
    history.replaceState(history.state, "", url);
    setRound(0);
    if (window.matchMedia("(max-width: 760px)").matches && picker.current)
      picker.current.open = false;
    requestAnimationFrame(() => {
      playArea.current?.scrollIntoView({ block: "start", behavior: "instant" });
      playArea.current?.focus({ preventScroll: true });
    });
  };
  return (
    <div className="play-catalog">
      <header className="play-catalog__header">
        {!learner ? <a href="/play-lab">{interfaceTranslator.t("gallery.back")}</a> : null}
        <h1>{title}</h1>
        <p>{interfaceTranslator.t(learner ? "doors.courseware.intro" : "gallery.intro")}</p>
        {!learner ? (
          <a href={`/play-lab/prop-finish?lang=${locale}`} data-testid="prop-finish-link">
            {interfaceTranslator.t("finish.open")}
          </a>
        ) : null}
      </header>
      <div className="play-catalog__layout">
        <details ref={picker} className="play-catalog__picker" open>
          <summary>
            {title} · {entries.length}
          </summary>
          <label htmlFor="play-catalog-search">
            {interfaceTranslator.t(learner ? "doors.courseware.search" : "gallery.search")}
          </label>
          <GameInput
            id="play-catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <GameTabs
            id="play-catalog-groups"
            activeId={group}
            onSelect={(id) => {
              setGroup(id as CatalogGroup | "all");
              const first = entries.find((entry) => id === "all" || entry.group === id);
              if (first) {
                setSelectedId(first.id);
                setRound(0);
              }
              const url = new URL(location.href);
              url.searchParams.set("group", id);
              if (first) url.searchParams.set("entry", first.id);
              history.replaceState(history.state, "", url);
            }}
            tabs={(["all", ...groups] as const).map((id) => ({
              id,
              label: `${groupLabel(id)} ${id === "all" ? entries.length : entries.filter((entry) => entry.group === id).length}`,
              panelId: "play-catalog-results",
            }))}
          />
          <p className="play-catalog__count" role="status">
            {interfaceTranslator.t("gallery.results", { count: shown.length })}
          </p>
          <div
            id="play-catalog-results"
            role="tabpanel"
            aria-labelledby={`play-catalog-groups-${group}`}
            className="play-catalog__results"
          >
            {shown.length ? (
              <ul>
                {shown.map((entry, index) => (
                  <li key={entry.id}>
                    <button
                      ref={index === 0 ? listButton : undefined}
                      type="button"
                      aria-pressed={selectedId === entry.id}
                      data-entry-id={entry.id}
                      onClick={() => choose(entry)}
                    >
                      <strong>{interfaceTranslator.t(entry.name)}</strong>
                      <span>{interfaceTranslator.t(entry.action)}</span>
                      {!learner ? <small>{entry.id}</small> : null}
                      {!learner && entry.threeMode ? (
                        <small>
                          {interfaceTranslator.t(
                            entry.retained ? "gallery.three.retained" : "gallery.three.new",
                          )}
                        </small>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{interfaceTranslator.t("gallery.empty")}</p>
            )}
          </div>
        </details>
        <section
          className="play-catalog__play"
          ref={playArea}
          tabIndex={-1}
          aria-label={
            selected
              ? interfaceTranslator.t(selected.name)
              : interfaceTranslator.t("gallery.choose")
          }
        >
          {selected ? (
            <>
              <div className="play-catalog__selection">
                <div>
                  <p className="play-catalog__eyebrow">
                    {groupLabel(selected.group)}
                    {!learner ? (
                      <>
                        {" "}
                        · <code>{selected.id}</code>
                      </>
                    ) : null}
                  </p>
                  <h2>{interfaceTranslator.t(selected.name)}</h2>
                  {!learner && selected.threeMode ? (
                    <small>
                      {interfaceTranslator.t(
                        selected.retained ? "gallery.three.retained" : "gallery.three.new",
                      )}
                    </small>
                  ) : null}
                </div>
                <GameHudActions label={interfaceTranslator.t("gallery.controls")}>
                  {!selected.href && !selected.threeMode ? (
                    <GameButton
                      sound={false}
                      static
                      variant="secondary"
                      onClick={() => setRound(round + 1)}
                    >
                      {interfaceTranslator.t("gallery.retry")}
                    </GameButton>
                  ) : null}
                  <GameButton
                    sound={false}
                    static
                    variant="ghost"
                    onClick={() => {
                      setSelectedId(null);
                      if (picker.current) picker.current.open = true;
                      requestAnimationFrame(() => listButton.current?.focus());
                    }}
                  >
                    {interfaceTranslator.t("gallery.exit")}
                  </GameButton>
                </GameHudActions>
              </div>
              <p className="play-catalog__action">{interfaceTranslator.t(selected.action)}</p>
              {!selected.threeMode ? (
                <p className="play-catalog__controls">
                  <b>{interfaceTranslator.t("gallery.controls")}：</b>
                  {interfaceTranslator.t(selected.controls)}
                </p>
              ) : null}
              {selected.rhythm ? (
                <p className="play-catalog__scope">
                  {interfaceTranslator.t(
                    learner ? `doors.courseware.${selected.rhythm}` : `gallery.${selected.rhythm}`,
                  )}
                </p>
              ) : null}
              {selected.source ? (
                <p className="play-catalog__limit">
                  {interfaceTranslator.t(
                    learner ? "doors.courseware.localDemo" : "gallery.researchLimit",
                  )}
                </p>
              ) : null}
              <div key={`${selected.id}:${round}`} className="play-catalog__board">
                {selected.threeMode ? renderThree?.(selected.threeMode) : null}
                {selected.nativeKind ? <NativePlay kind={selected.nativeKind} /> : null}
                {selected.source ? (
                  <PrototypeFrame
                    source={sources[selected.source]}
                    presentation={presentation}
                    entryId={selected.prototypeId}
                    title={interfaceTranslator.t(selected.name)}
                  />
                ) : null}
                {selected.href ? (
                  <GamePanel title={interfaceTranslator.t("gallery.paths")}>
                    <p>{interfaceTranslator.t("gallery.pathsScope")}</p>
                    {!learner ? <p>{interfaceTranslator.t("gallery.pathNote")}</p> : null}
                    <a className="play-catalog__lesson-link" href={selected.href}>
                      {interfaceTranslator.t("gallery.openLesson")} →
                    </a>
                  </GamePanel>
                ) : null}
              </div>
              <p className="play-catalog__scope">
                {learner ? (
                  interfaceTranslator.t(
                    selected.href
                      ? "doors.courseware.courseProgress"
                      : "doors.courseware.noProgress",
                  )
                ) : (
                  <>
                    <b>{interfaceTranslator.t("gallery.scope")}：</b>
                    {interfaceTranslator.t(selected.scope)}
                  </>
                )}
              </p>
              {!learner && selected.source ? (
                <p className="play-catalog__scope">{interfaceTranslator.t("gallery.boundary")}</p>
              ) : null}
            </>
          ) : (
            <p className="play-catalog__empty">{interfaceTranslator.t("gallery.choose")}</p>
          )}
        </section>
      </div>
      {!learner ? (
        <details className="play-catalog__rationale">
          <summary>{interfaceTranslator.t("gallery.appearance")}</summary>
          <p>{interfaceTranslator.t("gallery.appearanceText")}</p>
          <a
            href="https://developer.apple.com/design/human-interface-guidelines/game-controls"
            target="_blank"
            rel="noreferrer"
          >
            Apple HIG · Game controls
          </a>
          {" · "}
          <a
            href="https://developer.apple.com/design/human-interface-guidelines/designing-for-games"
            target="_blank"
            rel="noreferrer"
          >
            Designing for games
          </a>
        </details>
      ) : null}
    </div>
  );
}
