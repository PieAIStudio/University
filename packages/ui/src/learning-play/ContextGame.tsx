import { useEffect, useId, useRef, useState } from "react";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
import {
  evaluateContextPack,
  evaluateContextService,
  visitContextProduct,
  setContextDocument,
  toggleContextParagraph,
  type ContextActivity,
  type ContextPackResult,
  type ContextVisit,
} from "@pieai/university-core";
import { translate } from "../i18n/index.js";
import { playSound } from "../sound/sound.js";
import type { ActivityControls } from "./controls.js";
import { ContextCounter } from "./ContextCounter.js";

interface PackingTrial {
  readonly number: number;
  readonly selection: readonly string[];
  readonly result: ContextPackResult;
}

export function ContextGame({
  activity,
  disabled,
  guided = false,
  onAttempt,
}: ActivityControls<ContextActivity>) {
  const [documentId, setDocumentId] = useState(activity.documents[0]?.id ?? "");
  const [selection, setSelection] = useState<readonly string[]>(activity.initialParagraphIds ?? []);
  const [result, setResult] = useState<ContextPackResult | null>(() =>
    activity.visitors?.length
      ? evaluateContextPack(activity, activity.initialParagraphIds ?? [])
      : null,
  );
  const [visits, setVisits] = useState<readonly ContextVisit[]>([]);
  const [activeVisitor, setActiveVisitor] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly PackingTrial[]>([]);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const reported = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const counterTop = useRef<HTMLDivElement>(null);
  const paperTop = useRef<HTMLHeadingElement>(null);
  const materialDetails = useRef<HTMLDetailsElement>(null);
  const guideCounter = guided && !!activity.visitors?.length;
  const selectedDocument = activity.documents.find((document) => document.id === documentId);
  const current = evaluateContextPack(activity, selection);
  const service = evaluateContextService(activity, selection, visits);
  const resultId = useId();
  const resultStale =
    result !== null &&
    (selection.length !== result.selectedParagraphIds.length ||
      selection.some((id) => !result.selectedParagraphIds.includes(id)));
  const packed = activity.documents.flatMap((document) =>
    document.paragraphs
      .map((paragraph, index) => ({ document, paragraph, index }))
      .filter(({ paragraph }) => selection.includes(paragraph.id)),
  );

  useEffect(() => {
    if (!result || activity.visitors?.length) return;
    const heading = resultHeading.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const bounds = heading.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight - 80) {
      heading.scrollIntoView({ block: "start" });
    }
  }, [result, activity.visitors?.length]);

  function edit(next: readonly string[]) {
    if (disabled || reported.current) return;
    playSound("ui.press");
    setSelection(next);
  }

  function openMaterials(id?: string) {
    if (id) setDocumentId(id);
    setMaterialsOpen(true);
    setLibraryOpen(false);
    requestAnimationFrame(() => {
      paperTop.current?.focus({ preventScroll: true });
      paperTop.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }

  function handoff(outcome: ContextPackResult): string {
    const materials = packed.map(({ document, paragraph, index }) =>
      [
        translate("play.ai.context.sourceLine", {
          document: document.title,
          paragraph: index + 1,
          date: document.date,
        }),
        document.provenance,
        paragraph.text,
      ].join("\n"),
    );
    return [
      `${translate("play.ai.context.handoff")} — ${activity.title}`,
      activity.goal,
      activity.authorityNote,
      translate("play.ai.context.handoffMaterials"),
      ...materials,
      translate("play.ai.context.handoffResult"),
      ...outcome.rows.map(
        (row) => `${row.label}: ${row.value ?? translate(`play.ai.context.status.${row.status}`)}`,
      ),
    ].join("\n\n");
  }

  function generate() {
    if (disabled || reported.current) return;
    playSound("ui.press");
    const outcome = evaluateContextPack(activity, selection);
    setResult(outcome);
    setHistory((items) =>
      [
        ...items,
        { number: (items.at(-1)?.number ?? 0) + 1, selection: [...selection], result: outcome },
      ].slice(-6),
    );
    if (activity.visitors?.length) {
      if (!guideCounter) setActiveVisitor(null);
      counterTop.current?.scrollIntoView({ block: "start", behavior: "instant" });
      return;
    }
    const message = outcome.passed
      ? translate("play.ai.context.success", { count: outcome.rows.length })
      : outcome.overCapacity
        ? translate("play.ai.context.capacityBlocked", {
            extra: Math.max(0, outcome.units - activity.capacity),
          })
        : translate("play.ai.context.fail", {
            labels: outcome.rows
              .filter((row) => row.status !== "ready")
              .map((row) => row.label)
              .join(" · "),
          });
    if (outcome.passed) reported.current = true;
    onAttempt(
      outcome.passed,
      {
        selectedParagraphIds: outcome.selectedParagraphIds,
        units: outcome.units,
        capacity: activity.capacity,
        workResult: outcome.rows,
        packingHistory: [
          ...history.map((trial) => ({
            selection: trial.selection,
            units: trial.result.units,
            passed: trial.result.passed,
          })),
          { selection, units: outcome.units, passed: outcome.passed },
        ],
        handoff: handoff(outcome),
      },
      message,
    );
  }

  function serve(visitorId: string) {
    if (disabled || reported.current || !result || resultStale) return;
    const reply = visitContextProduct(activity, result.selectedParagraphIds, visitorId);
    if (!reply) return;
    setActiveVisitor(visitorId);
    setVisits((previous) => [...previous, reply].slice(-24));
    playSound(reply.passed ? "answer.correct" : "ui.press");
  }

  function deliver() {
    if (disabled || reported.current || !result) return;
    const passed = service.passed && !resultStale;
    if (passed) reported.current = true;
    const names = activity.visitors
      ?.filter((visitor) => service.missingVisitorIds.includes(visitor.id))
      .map((visitor) => visitor.name)
      .join("、");
    onAttempt(
      passed,
      {
        selectedParagraphIds: selection,
        units: current.units,
        capacity: activity.capacity,
        workResult: current.rows,
        visits,
        handoff: handoff(current),
      },
      passed
        ? translate("play.ai.context.difficulty.serviceSuccess", {
            count: activity.visitors?.length ?? 0,
          })
        : resultStale
          ? translate("play.ai.context.counterStale")
          : !current.passed
            ? translate("play.ai.context.repairCounterFirst")
            : translate("play.ai.context.visitRemaining", { names: names ?? "" }),
    );
  }

  return (
    <div className="play-ai-workflow play-ai-context" data-guided={guideCounter}>
      {activity.visitors?.length && result ? (
        <div ref={counterTop} className="ai-context-counter-anchor">
          <ContextCounter
            activity={activity}
            result={result}
            visits={visits}
            served={service.servedVisitorIds}
            active={activeVisitor}
            stale={resultStale}
            disabled={disabled}
            guided={guideCounter}
            onVisit={serve}
            onBuild={generate}
            onFinish={deliver}
            onSource={openMaterials}
            onMaterials={() => openMaterials()}
          />
        </div>
      ) : null}
      <details
        ref={materialDetails}
        className="play-context-materials"
        open={!guideCounter || materialsOpen}
        onToggle={(event) => {
          if (guideCounter) setMaterialsOpen(event.currentTarget.open);
        }}
      >
        <summary>{translate("play.ai.context.guide.materials")}</summary>
        <div className="play-context-materials__body">
          {guideCounter ? (
            <p className="play-context-materials__hint">
              {translate("play.ai.context.guide.editHint")}
            </p>
          ) : null}
          {!guideCounter ? (
            <p className="play-ai-workflow__intro">{translate("play.ai.context.help")}</p>
          ) : null}
          <details className="play-ai-workflow__brief">
            <summary>{translate("play.ai.context.authority")}</summary>
            <p>{activity.authorityNote}</p>
          </details>
          <div className="play-ai-context__desk">
            <details
              className="play-context-library"
              open={!guideCounter || libraryOpen}
              onToggle={(event) => {
                if (guideCounter) setLibraryOpen(event.currentTarget.open);
              }}
            >
              <summary>
                {translate("play.ai.context.guide.pickDocument", {
                  count: activity.documents.length,
                })}
              </summary>
              <nav
                className="play-ai-context__library"
                aria-label={translate("play.ai.context.library")}
              >
                <h4>{translate("play.ai.context.library")}</h4>
                {activity.documents.map((document, index) => {
                  const count = document.paragraphs.filter((paragraph) =>
                    selection.includes(paragraph.id),
                  ).length;
                  return (
                    <GameButton
                      key={document.id}
                      variant={document.id === documentId ? "primary" : "secondary"}
                      sound={false}
                      aria-pressed={document.id === documentId}
                      onClick={() => {
                        setDocumentId(document.id);
                        if (guideCounter) setLibraryOpen(false);
                        playSound("ui.press");
                      }}
                    >
                      <span className="play-ai-context__document-index" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        {document.title}
                        <small>
                          {document.date}
                          {count > 0 ? ` · ${count}/${document.paragraphs.length}` : ""}
                        </small>
                      </span>
                    </GameButton>
                  );
                })}
              </nav>
            </details>
            {selectedDocument ? (
              <section className="play-ai-context__paper" aria-label={selectedDocument.title}>
                <header>
                  <div>
                    <h4 ref={paperTop} tabIndex={-1}>
                      {selectedDocument.title}
                    </h4>
                    <p>{selectedDocument.provenance}</p>
                    <time dateTime={selectedDocument.date}>{selectedDocument.date}</time>
                  </div>
                  <GameButton
                    variant="secondary"
                    sound={false}
                    disabled={disabled}
                    onClick={() =>
                      edit(
                        setContextDocument(
                          activity,
                          selection,
                          selectedDocument.id,
                          !selectedDocument.paragraphs.every((paragraph) =>
                            selection.includes(paragraph.id),
                          ),
                        ),
                      )
                    }
                  >
                    {translate(
                      selectedDocument.paragraphs.every((paragraph) =>
                        selection.includes(paragraph.id),
                      )
                        ? "play.ai.context.removeDocument"
                        : "play.ai.context.includeDocument",
                    )}
                  </GameButton>
                </header>
                {selectedDocument.paragraphs.map((paragraph, index) => (
                  <div
                    key={paragraph.id}
                    className="play-ai-context__paragraph"
                    data-packed={selection.includes(paragraph.id)}
                  >
                    <div className="play-ai-context__paragraph-meta">
                      <span>{translate("play.ai.context.paragraph", { count: index + 1 })}</span>
                      <span>{translate("play.ai.context.units", { count: paragraph.units })}</span>
                    </div>
                    <p>{paragraph.text}</p>
                    <GameToggle
                      checked={selection.includes(paragraph.id)}
                      disabled={disabled}
                      label={translate("play.ai.context.excerpt", { count: index + 1 })}
                      onClick={() =>
                        edit(toggleContextParagraph(activity, selection, paragraph.id))
                      }
                    />
                  </div>
                ))}
              </section>
            ) : null}
          </div>
          {guideCounter ? (
            <div
              className="play-context-build"
              data-stale={resultStale}
              data-over-capacity={current.overCapacity}
            >
              <p role="status">
                {current.overCapacity
                  ? translate("play.ai.context.guide.overCapacity", {
                      extra: current.units - activity.capacity,
                    })
                  : translate("play.ai.context.guide.currentPack", {
                      used: current.units,
                      total: activity.capacity,
                    })}
              </p>
              <GameButton
                variant={resultStale ? "primary" : "secondary"}
                disabled={disabled}
                sound={false}
                onClick={
                  resultStale
                    ? generate
                    : () =>
                        counterTop.current?.scrollIntoView({ block: "start", behavior: "instant" })
                }
              >
                {translate(
                  resultStale ? "play.ai.context.buildCounter" : "play.ai.context.guide.return",
                )}
              </GameButton>
            </div>
          ) : null}
          <details className="play-context-packed" open={!guideCounter}>
            <summary>
              {translate("play.ai.context.guide.pack", {
                used: current.units,
                total: activity.capacity,
              })}
            </summary>
            <section className="play-ai-context__box" data-over-capacity={current.overCapacity}>
              <header>
                <h4>{translate("play.ai.context.pack")}</h4>
                <strong>
                  {translate("play.ai.context.capacity", {
                    used: current.units,
                    total: activity.capacity,
                  })}
                </strong>
              </header>
              <div className="play-ai-context__capacity" aria-hidden="true">
                {Array.from({ length: activity.capacity }, (_, index) => (
                  <span key={index} data-filled={index < current.units} />
                ))}
              </div>
              <p className="play-ai-workflow__note">{translate("play.ai.context.capacityNote")}</p>
              {packed.length ? (
                <ul className="play-ai-context__packed-list">
                  {packed.map(({ document, paragraph, index }) => (
                    <li key={paragraph.id}>
                      <span>
                        {document.title} ·{" "}
                        {translate("play.ai.context.paragraph", { count: index + 1 })}
                      </span>
                      <GameButton
                        variant="ghost"
                        sound={false}
                        disabled={disabled}
                        aria-label={`${translate("play.ai.context.removeParagraph")} · ${document.title} · ${index + 1}`}
                        onClick={() =>
                          edit(toggleContextParagraph(activity, selection, paragraph.id))
                        }
                      >
                        ×
                      </GameButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{translate("play.ai.context.packingEmpty")}</p>
              )}
              {!guideCounter ? (
                <GameButton
                  variant="primary"
                  sound={false}
                  disabled={disabled}
                  aria-controls={resultId}
                  onClick={generate}
                >
                  {translate("play.ai.context.run")}
                </GameButton>
              ) : null}
            </section>
          </details>
        </div>
      </details>
      <details className="play-context-result" open={!guideCounter}>
        <summary>{translate("play.ai.context.guide.fullResult")}</summary>
        <section className="play-ai-context__result" id={resultId}>
          <h4 ref={resultHeading} tabIndex={-1}>
            {translate("play.ai.context.work")}
          </h4>
          {resultStale ? (
            <div className="play-ai-workflow__warning" role="status">
              <p>{translate("play.ai.context.stale")}</p>
              {!guideCounter ? (
                <GameButton
                  variant="secondary"
                  sound={false}
                  disabled={disabled}
                  onClick={generate}
                >
                  {translate("play.ai.context.rerun")}
                </GameButton>
              ) : null}
            </div>
          ) : null}
          {!result ? (
            <p className="play-ai-workflow__note">{translate("play.ai.context.workEmpty")}</p>
          ) : (
            <>
              <h5>{activity.workTitle}</h5>
              {result.overCapacity ? (
                <p className="play-ai-workflow__warning">
                  {translate("play.ai.context.capacityBlocked", {
                    extra: Math.max(0, result.units - activity.capacity),
                  })}
                </p>
              ) : null}
              <div className="play-ai-context__work-rows">
                {result.rows.map((row, index) => (
                  <article key={row.slotId} data-status={row.status}>
                    <header>
                      <span className="play-ai-context__work-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <h5>{row.label}</h5>
                      <span>{translate(`play.ai.context.status.${row.status}`)}</span>
                    </header>
                    <p className="play-ai-context__work-value">
                      {row.value ??
                        translate(
                          `play.ai.context.reason.${row.status === "ready" ? "missing" : row.status}`,
                          { label: row.label },
                        )}
                    </p>
                    {row.evidence.length ? (
                      <details>
                        <summary>{translate("play.ai.context.sources")}</summary>
                        <ul>
                          {row.evidence.map((item) => {
                            const document = activity.documents.find(
                              (candidate) => candidate.id === item.documentId,
                            )!;
                            const paragraph =
                              document.paragraphs.findIndex(
                                (candidate) => candidate.id === item.paragraphId,
                              ) + 1;
                            return (
                              <li key={item.paragraphId}>
                                <p>{item.text}</p>
                                <small>
                                  {translate("play.ai.context.sourceLine", {
                                    document: document.title,
                                    paragraph,
                                    date: document.date,
                                  })}
                                </small>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </details>
      <details className="play-ai-workflow__history">
        <summary>{translate("play.ai.context.history")}</summary>
        {history.length ? (
          <ol>
            {history.map((trial) => (
              <li key={trial.number}>
                <span>
                  {translate("play.ai.context.historyItem", {
                    count: trial.number,
                    units: trial.result.units,
                    ready: trial.result.rows.filter((row) => row.status === "ready").length,
                  })}
                </span>
                <GameButton
                  variant="ghost"
                  disabled={disabled}
                  sound={false}
                  onClick={() => {
                    edit(trial.selection);
                    setResult(trial.result);
                  }}
                >
                  {translate("play.ai.context.restore")}
                </GameButton>
              </li>
            ))}
          </ol>
        ) : (
          <p>{translate("play.ai.context.historyEmpty")}</p>
        )}
      </details>
    </div>
  );
}
