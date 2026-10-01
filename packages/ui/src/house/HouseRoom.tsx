import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { GameButton, GameModal } from "@pieai/swimmer-ui-kit";
import {
  usedDays,
  type HouseState,
  type Keepsake,
  type WallMarkStyle,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { KeepsakeArt } from "./keepsake-art.js";
import "./house.css";

/*
 * The learner's house (V7 amendment one; task 10).
 *
 * A 2D room in the brand's flat look: shelves for keepsakes, the coat rack and
 * the pack box (the old wardrobe page, Owner H2), the wall calendar for
 * 「用了」 days, and the window onto an OwnMySpace island. Keepsakes can be
 * dragged from day one (Owner H3), and moved with arrow keys, because a
 * control that only a pointer can move excludes the people who cannot drag.
 *
 * Positions are room units 0–1, anchored at an item's foot, so a later 3D room
 * reads the same placements. The stage keeps a minimum width and the room pans
 * sideways on a phone, so a keepsake stays a finger's size instead of shrinking
 * to a dot; the background pans, an item drags.
 */

export interface HouseKeepsake {
  readonly keepsake: Keepsake;
  readonly unitTitle: string;
  readonly courseTitle: string;
}

export interface HouseRoomProps {
  readonly keepsakes: readonly HouseKeepsake[];
  readonly house: HouseState | undefined;
  /** The learner's local day, YYYY-MM-DD. */
  readonly today: string;
  readonly avatar?: ReactNode;
  /** A keepsake just put on the shelf from a chest. */
  readonly highlight?: string | null;
  readonly onPlace: (id: string, x: number, y: number) => void;
  readonly onMarkStyle: (style: WallMarkStyle) => void;
  readonly onOpenWardrobe: (focus: "rack" | "packs") => void;
  readonly onOpenSegment: (keepsake: Keepsake) => void;
}

/** Where a keepsake stands until the learner moves it: three shelves, then the floor. */
const SHELF_Y = [0.25, 0.45, 0.65];
const SHELF_X = [0.1, 0.19, 0.28];
export function defaultPlacement(index: number): { readonly x: number; readonly y: number } {
  if (index < SHELF_Y.length * SHELF_X.length)
    return { x: SHELF_X[index % SHELF_X.length]!, y: SHELF_Y[Math.floor(index / SHELF_X.length)]! };
  const floor = index - SHELF_Y.length * SHELF_X.length;
  return { x: 0.08 + ((floor * 0.09) % 0.4), y: 0.95 };
}

const STEP = 0.02;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

const COPY = {
  "keepsake.paperPlane": ["keepsake.paperPlane.name", "keepsake.paperPlane.meaning"],
  "keepsake.emojiJar": ["keepsake.emojiJar.name", "keepsake.emojiJar.meaning"],
  "keepsake.redPen": ["keepsake.redPen.name", "keepsake.redPen.meaning"],
  "keepsake.signpost": ["keepsake.signpost.name", "keepsake.signpost.meaning"],
  "keepsake.trophy": ["keepsake.trophy.name", "keepsake.trophy.meaning"],
  "keepsake.lighthouse": ["keepsake.lighthouse.name", "keepsake.lighthouse.meaning"],
} as const;
type CopyStem = keyof typeof COPY;
/** The catalogue keys for a keepsake's name and meaning. */
export const keepsakeCopy = (k: Keepsake) =>
  COPY[(k.copy in COPY ? k.copy : "keepsake.signpost") as CopyStem];

function useKeepsakeText() {
  const t = useI18n();
  return (item: HouseKeepsake) => {
    const [name, meaning] = keepsakeCopy(item.keepsake);
    return {
      name: t.t(name),
      meaning: t.t(meaning),
      source:
        item.keepsake.tier === "course"
          ? t.t("house.from.course", { course: item.courseTitle })
          : t.t(
              item.keepsake.tier === "challenge" ? "house.from.challenge" : "house.from.checkpoint",
              { unit: item.unitTitle },
            ),
    };
  };
}

function Placed({
  item,
  at,
  stage,
  highlight,
  onMove,
  onOpen,
}: {
  readonly item: HouseKeepsake;
  readonly at: { readonly x: number; readonly y: number };
  readonly stage: RefObject<HTMLDivElement | null>;
  readonly highlight: boolean;
  readonly onMove: (x: number, y: number) => void;
  readonly onOpen: () => void;
}) {
  const text = useKeepsakeText()(item);
  const t = useI18n();
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // A drag ends in a click on most browsers; only a press that did not move opens.
  const dragged = useRef(false);
  const toRoom = (event: ReactPointerEvent) => {
    const box = stage.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - box.left) / box.width),
      y: clamp((event.clientY - box.top) / box.height),
    };
  };
  const shown = drag ?? at;
  return (
    <button
      type="button"
      className="house-keepsake"
      data-keepsake={item.keepsake.id}
      data-highlight={highlight || undefined}
      data-dragging={drag ? true : undefined}
      aria-label={t.t("house.keepsake.label", { name: text.name })}
      aria-describedby="house-drag-hint"
      style={{ insetInlineStart: `${shown.x * 100}%`, top: `${shown.y * 100}%` }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        start.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const s = start.current;
        if (!s) return;
        if (!s.moved && Math.hypot(event.clientX - s.x, event.clientY - s.y) < 6) return;
        s.moved = true;
        setDrag(toRoom(event));
      }}
      onPointerUp={(event) => {
        const s = start.current;
        start.current = null;
        if (s?.moved) {
          dragged.current = true;
          const end = toRoom(event);
          setDrag(null);
          onMove(end.x, end.y);
        }
      }}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onOpen();
      }}
      onKeyDown={(event: KeyboardEvent) => {
        const move = {
          ArrowLeft: [-STEP, 0],
          ArrowRight: [STEP, 0],
          ArrowUp: [0, -STEP],
          ArrowDown: [0, STEP],
        }[event.key];
        if (!move) return;
        event.preventDefault();
        onMove(clamp(at.x + move[0]!), clamp(at.y + move[1]!));
      }}
    >
      <KeepsakeArt art={item.keepsake.art} />
    </button>
  );
}

/** Monday-first weeks of the month that holds `today`. */
function monthGrid(today: string): readonly (string | null)[] {
  const [year, month] = today.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1)
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return cells;
}

/**
 * One stroke per used day, five to a group: 一 丅 下 止 正 in Chinese, tally
 * bars in English. The steps are copy, so they live in the catalogue.
 */
function tally(count: number, steps: string): string {
  const [one, two, three, four, five] = steps.split("/") as [
    string,
    string,
    string,
    string,
    string,
  ];
  return five.repeat(Math.floor(count / 5)) + ["", one, two, three, four][count % 5];
}

function WallCalendar({
  house,
  today,
  onMarkStyle,
}: {
  readonly house: HouseState | undefined;
  readonly today: string;
  readonly onMarkStyle: (style: WallMarkStyle) => void;
}) {
  const t = useI18n();
  const style = house?.markStyle?.style ?? "tick";
  const month = today.slice(0, 7);
  const used = new Set(usedDays(house).filter((day) => day.startsWith(month)));
  return (
    <div className="house-calendar" data-mark-style={style}>
      <div
        className="house-calendar__styles"
        role="radiogroup"
        aria-label={t.t("house.calendar.style")}
      >
        {(["tally", "tick", "sticker"] as const).map((option) => (
          <GameButton
            key={option}
            variant="ghost"
            static
            role="radio"
            aria-checked={style === option}
            onClick={() => onMarkStyle(option)}
          >
            {t.t(`house.calendar.${option}`)}
          </GameButton>
        ))}
      </div>
      {style === "tally" ? (
        <p className="house-calendar__tally" data-used-count={used.size}>
          <span aria-hidden="true">{tally(used.size, t.t("house.calendar.tallySteps"))}</span>
          <span>{t.t("house.calendar.count", { count: used.size })}</span>
        </p>
      ) : (
        <ol className="house-calendar__grid" aria-label={t.t("house.calendar.month", { month })}>
          {monthGrid(today).map((day, index) =>
            day ? (
              <li
                key={day}
                data-day={day}
                data-used={used.has(day) || undefined}
                data-today={day === today || undefined}
                aria-label={
                  used.has(day)
                    ? t.t("house.calendar.usedDay", { day: String(Number(day.slice(8))) })
                    : undefined
                }
              >
                <span>{Number(day.slice(8))}</span>
                {used.has(day) ? <i aria-hidden="true">{style === "tick" ? "✓" : "★"}</i> : null}
              </li>
            ) : (
              <li key={`lead-${index}`} aria-hidden="true" />
            ),
          )}
        </ol>
      )}
      <p className="house-calendar__note">{t.t("house.calendar.note")}</p>
    </div>
  );
}

export function HouseRoom({
  keepsakes,
  house,
  today,
  avatar,
  highlight = null,
  onPlace,
  onMarkStyle,
  onOpenWardrobe,
  onOpenSegment,
}: HouseRoomProps) {
  const t = useI18n();
  const text = useKeepsakeText();
  const stage = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<HouseKeepsake | null>(null);
  const [sheet, setSheet] = useState<"calendar" | "window" | null>(null);
  const monthUsed = new Set(usedDays(house).filter((day) => day.startsWith(today.slice(0, 7))));
  const used = monthUsed.size;
  return (
    <section className="shell-screen house" data-house aria-labelledby="house-title">
      <header className="shell-screen__head">
        <h1 id="house-title">{t.t("house.title")}</h1>
        <p className="shell-screen__lede">{t.t(keepsakes.length ? "house.lede" : "house.empty")}</p>
      </header>
      <p id="house-drag-hint" className="house__hint">
        {t.t("house.dragHint")}
      </p>
      <div className="house-room" data-house-room>
        <div className="house-room__stage" ref={stage}>
          <svg className="house-room__scene" viewBox="0 0 960 600" aria-hidden="true">
            <rect className="house-room__wall" x="0" y="0" width="960" height="440" />
            <rect className="house-room__floor" x="0" y="440" width="960" height="160" />
            <path className="house-room__wood" d="M0 440 H960" strokeWidth="4" />
            {SHELF_Y.map((y) => (
              <rect
                key={y}
                className="house-room__shelf"
                x="50"
                y={y * 600}
                width="290"
                height="12"
                rx="5"
              />
            ))}
            <rect className="house-room__table" x="560" y="470" width="170" height="14" rx="6" />
            <path className="house-room__wood" d="M575 484 V560 M715 484 V560" strokeWidth="8" />
            <path
              className="house-room__wood"
              d="M925 440 V200 M905 220 H945"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
          <button
            type="button"
            className="house-room__window"
            data-house-window
            onClick={() => setSheet("window")}
          >
            <span>{t.t("house.window.label")}</span>
          </button>
          <button
            type="button"
            className="house-room__calendar"
            data-house-calendar
            onClick={() => setSheet("calendar")}
          >
            <span className="house-room__calendar-head">{t.t("house.calendar.title")}</span>
            <span className="house-room__calendar-count">
              {t.t("house.calendar.count", { count: used })}
            </span>
            <span className="house-room__calendar-days" aria-hidden="true">
              {monthGrid(today).map((day, index) => (
                <i
                  key={day ?? `lead-${index}`}
                  data-blank={day ? undefined : true}
                  data-marked={day && monthUsed.has(day) ? true : undefined}
                />
              ))}
            </span>
          </button>
          <button
            type="button"
            className="house-room__rack"
            data-house-rack
            onClick={() => onOpenWardrobe("rack")}
          >
            <span>{t.t("house.rack")}</span>
          </button>
          <button
            type="button"
            className="house-room__packs"
            data-house-packs
            onClick={() => onOpenWardrobe("packs")}
          >
            <span>{t.t("house.packs")}</span>
          </button>
          {avatar ? <div className="house-room__avatar">{avatar}</div> : null}
          {keepsakes.length === 0 ? (
            <p className="house-room__postcard" data-house-welcome>
              {t.t("house.welcome")}
            </p>
          ) : null}
          {keepsakes.map((item, index) => (
            <Placed
              key={item.keepsake.id}
              item={item}
              at={house?.placements[item.keepsake.id] ?? defaultPlacement(index)}
              stage={stage}
              highlight={highlight === item.keepsake.id}
              onMove={(x, y) => onPlace(item.keepsake.id, x, y)}
              onOpen={() => setOpen(item)}
            />
          ))}
        </div>
      </div>
      <section className="house__list" aria-labelledby="house-list-title">
        <h2 id="house-list-title">{t.t("house.listTitle")}</h2>
        {keepsakes.length ? (
          <ul>
            {keepsakes.map((item) => {
              const words = text(item);
              return (
                <li key={item.keepsake.id} data-keepsake-row={item.keepsake.id}>
                  <KeepsakeArt art={item.keepsake.art} />
                  <div>
                    <strong>{words.name}</strong>
                    <span>{words.meaning}</span>
                    <small>{words.source}</small>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{t.t("house.listEmpty")}</p>
        )}
      </section>
      {open ? (
        <GameModal open title={text(open).name} onClose={() => setOpen(null)}>
          <div className="house-detail" data-keepsake-detail={open.keepsake.id}>
            <KeepsakeArt art={open.keepsake.art} />
            <p>{text(open).meaning}</p>
            <p className="house-detail__source">{text(open).source}</p>
            <GameButton
              static
              onClick={() => {
                setOpen(null);
                onOpenSegment(open.keepsake);
              }}
            >
              {t.t("house.backToSegment")}
            </GameButton>
          </div>
        </GameModal>
      ) : null}
      {sheet === "calendar" ? (
        <GameModal open title={t.t("house.calendar.title")} onClose={() => setSheet(null)}>
          <WallCalendar house={house} today={today} onMarkStyle={onMarkStyle} />
        </GameModal>
      ) : null}
      {sheet === "window" ? (
        <GameModal open title={t.t("house.window.title")} onClose={() => setSheet(null)}>
          <p data-house-window-note>{t.t("house.window.body")}</p>
        </GameModal>
      ) : null}
    </section>
  );
}
