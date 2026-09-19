import { useId, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  PRIMM_CHECK_JUDGMENTS,
  isPrimmGameComplete,
  placePrimmSortCard,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import type { LessonAssetView } from "../view/lesson-view.js";
import type { PrimmActivity } from "./primm-types.js";
import { PrimmSource } from "./PrimmMaterials.js";

/** Guided evidence only. None of these operations reports an independent grade. */
export interface InvestigationDraft {
  readonly selected: string;
  readonly observation: string;
  readonly placed: Record<string, string>;
  readonly order: string[];
  readonly format: string;
  readonly edited: string;
  readonly decisions: Record<string, boolean>;
  readonly touched: boolean;
}
export const emptyInvestigation = (): InvestigationDraft => ({
  selected: "",
  observation: "",
  placed: {},
  order: [],
  format: "",
  edited: "",
  decisions: {},
  touched: false,
});
export function investigationComplete(activity: PrimmActivity, draft: InvestigationDraft): boolean {
  const game = activity.investigate.game;
  switch (game.kind) {
    case "inspect-image":
      return game.regions.some((r) => r.id === draft.selected) && !!draft.observation.trim();
    case "sort":
      return isPrimmGameComplete(game, { kind: "sort", placed: draft.placed });
    case "layout":
      return draft.touched && draft.order.length === game.items.length;
    case "edit":
      return (
        draft.selected === game.targetId &&
        !!draft.edited.trim() &&
        draft.edited.trim() !== game.sentences.find((s) => s.id === game.targetId)?.text.trim()
      );
    case "collect":
      return game.cards.every((card) => draft.decisions[card.id] === card.relevant);
    case "check-result":
      return isPrimmGameComplete(game, { kind: "check-result", judgments: draft.placed });
  }
}
export function PrimmInvestigate({
  activity,
  assets,
  draft,
  onChange,
}: {
  readonly activity: PrimmActivity;
  readonly assets?: readonly LessonAssetView[];
  readonly draft: InvestigationDraft;
  readonly onChange: (next: InvestigationDraft) => void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [feedback, setFeedback] = useState("");
  const [aspect, setAspect] = useState<number | null>(null);
  const game = activity.investigate.game;
  // Several judgments can land before the parent re-renders (fast keyboard or
  // scripted input); build each one on the latest draft, not the rendered one.
  const latest = useRef(draft);
  latest.current = draft;
  const update = (
    patch:
      | Partial<InvestigationDraft>
      | ((current: InvestigationDraft) => Partial<InvestigationDraft>),
  ) => {
    const next = {
      ...latest.current,
      ...(typeof patch === "function" ? patch(latest.current) : patch),
    };
    latest.current = next;
    onChange(next);
  };
  if (game.kind === "inspect-image") {
    const asset = assets?.find(
      (item) => item.id === game.assetId && item.mime.startsWith("image/"),
    );
    const region = game.regions.find((item) => item.id === draft.selected);
    const copy = asset?.locales?.[locale];
    return (
      <div className="primm-inspect">
        <p>{game.instruction}</p>
        {asset ? (
          <figure>
            <div className="primm-inspect__photo">
              <img
                src={asset.url}
                alt={copy?.alt ?? asset.alt}
                ref={(image) => {
                  if (image?.complete && image.naturalWidth > 0)
                    setAspect(image.naturalWidth / image.naturalHeight);
                }}
                onLoad={(event) =>
                  setAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)
                }
              />
              {game.regions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="primm-inspect__hotspot"
                  disabled={aspect === null}
                  aria-label={t("primm.region", { label: r.label })}
                  aria-pressed={r.id === draft.selected}
                  style={{
                    // A whole-image region must sit behind specific objects.
                    zIndex: 1 + Math.round((1 - r.width * r.height) * 100),
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.width * 100}%`,
                    height: `${r.height * 100}%`,
                  }}
                  onClick={() => update({ selected: r.id })}
                />
              ))}
              {region ? (
                <span
                  className="primm-inspect__region"
                  style={{
                    left: `${region.x * 100}%`,
                    top: `${region.y * 100}%`,
                    width: `${region.width * 100}%`,
                    height: `${region.height * 100}%`,
                  }}
                />
              ) : null}
            </div>
            <figcaption>
              {copy?.caption ?? asset.caption ?? copy?.attribution ?? asset.attribution}
            </figcaption>
          </figure>
        ) : (
          <p role="alert">{t("primm.missingAsset")}</p>
        )}
        <div className="primm__actions">
          {game.regions.map((item) => (
            <GameButton
              key={item.id}
              aria-pressed={draft.selected === item.id}
              disabled={!asset || aspect === null}
              onClick={() => update({ selected: item.id })}
            >
              {t("primm.region", { label: item.label })}
            </GameButton>
          ))}
        </div>
        {region && asset && aspect !== null ? (
          <>
            <div
              className="primm-inspect__zoom"
              role="img"
              aria-label={t("primm.focused")}
              style={{
                aspectRatio: `${(aspect * region.width) / region.height}`,
                width: `min(100%, ${Math.min(360, (220 * aspect * region.width) / region.height)}px)`,
              }}
            >
              <img
                src={asset.url}
                alt=""
                style={{
                  width: `${100 / region.width}%`,
                  height: "auto",
                  left: `${(-100 * region.x) / region.width}%`,
                  top: `${(-100 * region.y) / region.height}%`,
                }}
              />
            </div>
            <p>{region.note}</p>
            <label htmlFor={id}>{t("primm.observation")}</label>
            <textarea
              id={id}
              value={draft.observation}
              onChange={(event) => update({ observation: event.target.value })}
            />
          </>
        ) : null}
      </div>
    );
  }
  if (game.kind === "sort") {
    const selected = game.cards.find((c) => c.id === draft.selected);
    const place = (bucketId: string, cardId = draft.selected) => {
      const card = game.cards.find((c) => c.id === cardId);
      const verdict = placePrimmSortCard(
        game,
        { placed: draft.placed, misses: 0 },
        cardId,
        bucketId,
      );
      if (verdict.kind === "right") {
        update({ placed: { ...verdict.state.placed }, selected: "" });
        setFeedback(verdict.why);
      } else if (verdict.kind === "wrong")
        setFeedback(t("primm.sortWrong", { why: card?.why ?? "" }));
    };
    return (
      <div>
        <p>{t("primm.sortInstruction")}</p>
        <div className="primm__actions">
          {game.cards
            .filter((c) => !draft.placed[c.id])
            .map((card) => (
              <GameButton
                key={card.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", card.id)}
                aria-pressed={draft.selected === card.id}
                onClick={() => update({ selected: card.id })}
              >
                {card.text}
              </GameButton>
            ))}
        </div>
        <p role="status">{selected ? t("primm.selected", { text: selected.text }) : feedback}</p>
        <div className="primm__buckets">
          {game.buckets.map((bucket) => (
            <section
              key={bucket.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                place(bucket.id, event.dataTransfer.getData("text/plain"));
              }}
            >
              <GameButton aria-disabled={!selected} onClick={() => place(bucket.id)}>
                {bucket.label}
              </GameButton>
              <ul>
                {game.cards
                  .filter((c) => draft.placed[c.id] === bucket.id)
                  .map((card) => (
                    <li key={card.id}>{card.text}</li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
        {selected && feedback ? <p role="status">{feedback}</p> : null}
      </div>
    );
  }
  if (game.kind === "layout") {
    const order = draft.order.length ? draft.order : game.items.map((item) => item.id);
    const ordered = order.map((key) => game.items.find((item) => item.id === key)!);
    const move = (index: number, offset: number) => {
      const next = [...order];
      [next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
      update({ order: next, touched: true });
    };
    const format = draft.format || game.formats[0]?.id;
    return (
      <div>
        <p>{game.instruction}</p>
        <ol>
          {ordered.map((item, index) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              <p>{item.text}</p>
              <div className="primm__actions">
                <GameButton
                  disabled={index === 0}
                  aria-label={t("primm.moveUp", { label: item.label })}
                  onClick={() => move(index, -1)}
                >
                  {t("primm.moveUp", { label: item.label })}
                </GameButton>
                <GameButton disabled={index === order.length - 1} onClick={() => move(index, 1)}>
                  {t("primm.moveDown", { label: item.label })}
                </GameButton>
              </div>
            </li>
          ))}
        </ol>
        <fieldset>
          <legend>{t("primm.format")}</legend>
          {game.formats.map((f) => (
            <GameButton
              key={f.id}
              aria-pressed={format === f.id}
              onClick={() => update({ format: f.id, order: [...order], touched: true })}
            >
              {f.label}
            </GameButton>
          ))}
        </fieldset>
        <section aria-label={t("primm.preview")}>
          <h3>{t("primm.preview")}</h3>
          {format === "paragraph" ? (
            <p>{ordered.map((item) => item.text).join(" ")}</p>
          ) : (
            <ul>
              {ordered.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }
  if (game.kind === "edit") {
    const target = game.sentences.find((s) => s.id === game.targetId)!;
    return (
      <div>
        <p>{game.instruction}</p>
        <div className="primm__sentences">
          {game.sentences.map((sentence) => (
            <GameButton
              key={sentence.id}
              variant={draft.selected === sentence.id ? "primary" : "secondary"}
              aria-pressed={draft.selected === sentence.id}
              onClick={() => update({ selected: sentence.id })}
            >
              {sentence.text}
            </GameButton>
          ))}
        </div>
        {draft.selected === game.targetId ? (
          <>
            <label htmlFor={id}>{t("primm.editSentence")}</label>
            <textarea
              id={id}
              placeholder={game.replacementHint}
              value={draft.edited || (!draft.touched ? target.text : "")}
              onChange={(event) => update({ edited: event.target.value, touched: true })}
            />
            <div className="primm__comparison">
              <section>
                <h3>{t("primm.original")}</h3>
                {game.sentences.map((s) => (
                  <p
                    key={s.id}
                    className={s.id === game.targetId ? "primm__changed-sentence" : undefined}
                  >
                    {s.text}
                  </p>
                ))}
              </section>
              <section>
                <h3>{t("primm.edited")}</h3>
                {game.sentences.map((s) => (
                  <p
                    key={s.id}
                    className={s.id === game.targetId ? "primm__changed-sentence" : undefined}
                  >
                    {s.id === game.targetId && draft.touched ? draft.edited : s.text}
                  </p>
                ))}
              </section>
            </div>
          </>
        ) : draft.selected ? (
          <p role="status">{t("primm.wrongTarget")}</p>
        ) : null}
      </div>
    );
  }
  if (game.kind === "check-result") {
    // The learner compares the actual result shown above with the material.
    // Only after judging an item does the lesson show what the material said.
    return (
      <div className="primm-check">
        <p>{game.instruction}</p>
        {game.items.map((item) => {
          const judged = draft.placed[item.id];
          return (
            <section key={item.id} className="primm__record" data-check-item={item.id}>
              <h3>{item.label}</h3>
              <div className="primm__actions" role="group" aria-label={item.label}>
                {PRIMM_CHECK_JUDGMENTS.map((judgment) => (
                  <GameButton
                    key={judgment}
                    variant={judged === judgment ? "primary" : "secondary"}
                    aria-pressed={judged === judgment}
                    aria-label={t("primm.checkChoice", {
                      label: item.label,
                      choice: t(`primm.check.${judgment}`),
                    })}
                    onClick={() =>
                      update((current) => ({
                        placed: { ...current.placed, [item.id]: judgment },
                      }))
                    }
                  >
                    {t(`primm.check.${judgment}`)}
                  </GameButton>
                ))}
              </div>
              {judged ? (
                <p role="status">
                  <strong>{t("primm.checkSource")}</strong>
                  {item.expected} {item.why}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <p>{game.instruction}</p>
      {game.cards.map((card) => (
        <section key={card.id} className="primm__record">
          <h3>{card.label}</h3>
          <p>{card.text}</p>
          <PrimmSource source={activity.sources.find((s) => s.id === card.sourceId)} />
          <div className="primm__actions">
            <GameButton
              onClick={() =>
                update({ decisions: { ...draft.decisions, [card.id]: !draft.decisions[card.id] } })
              }
            >
              {t(draft.decisions[card.id] ? "primm.remove" : "primm.collect", {
                label: card.label,
              })}
            </GameButton>
            {draft.decisions[card.id] !== false ? (
              <GameButton
                onClick={() => update({ decisions: { ...draft.decisions, [card.id]: false } })}
              >
                {t("primm.reject", { label: card.label })}
              </GameButton>
            ) : null}
          </div>
          {card.id in draft.decisions ? <p role="status">{card.why}</p> : null}
        </section>
      ))}
      <section aria-label={t("primm.notes")}>
        <h3>{t("primm.notes")}</h3>
        {game.cards.some((c) => draft.decisions[c.id]) ? (
          <ul>
            {game.cards
              .filter((c) => draft.decisions[c.id])
              .map((card) => (
                <li key={card.id}>
                  {card.text}{" "}
                  <span className="primm__credit">
                    {activity.sources.find((s) => s.id === card.sourceId)?.reference.label}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p>{t("primm.emptyNotes")}</p>
        )}
      </section>
    </div>
  );
}
