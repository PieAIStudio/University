// The 彩色液体 column of ui-compare.html, drawn with the real SwimmerUIKit
// liquid components (LiquidSurface, LiquidGroup). Rebuild with
// node docs/reference/interaction-components/lab/src/build-liquid.mjs
import { LiquidGroup, LiquidSurface } from "@pieai/swimmer-ui-kit";
import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

/*
 * Plasticine colours: saturated enough to be colour, soft enough to be
 * friendly, every one dark-ink readable (6.3:1 or better, on the page).
 * `deep` is the same hue a step down, kept for a lip or a stroke only.
 * `soft` is the macaron step up: the light weight (轻) after the Owner found
 * the glossy first draft too heavy (2026-09-30).
 */
const PALETTE = [
  { id: "coral", name: "珊瑚", fill: "#f4876b", deep: "#c9583c", soft: "#f8b3a0" },
  { id: "sun", name: "向日葵", fill: "#f7c948", deep: "#c99a1c", soft: "#f9dd8a" },
  { id: "leaf", name: "嫩叶", fill: "#72c58f", deep: "#3f9660", soft: "#a6dcb8" },
  { id: "sky", name: "晴空", fill: "#6bb3ea", deep: "#3a84bd", soft: "#a9d0f3" },
  { id: "grape", name: "葡萄", fill: "#b39bf0", deep: "#7f63c9", soft: "#cfc0f6" },
  { id: "pink", name: "泡泡糖", fill: "#f59ac2", deep: "#c9628f", soft: "#f8bfd8" },
];
const C = Object.fromEntries(PALETTE.map((p) => [p.id, p]));
const INK = "#2a2320";
const CREAM = "#fff6e6";

/** Page-level switches: light/dark and how much the liquid moves. */
const settings = { mode: "light", motion: "act", weight: "mid" };

/*
 * Three weights, heaviest last. 厚 is the glossy first draft the Owner found too
 * heavy (2026-09-30). 中 keeps a little of 涟's sheen; 轻 drops it. Both lighter
 * weights use the macaron colours, rest as a firm body that turns liquid only
 * while touched, keep the chosen option firm, and cast a shadow as soft as 涟's.
 */
const heavy = (s) => s.weight === "heavy";
const finishOf = (s) => (s.weight === "light" ? "matte" : "glossy");
const fillOf = (colour, s) => (heavy(s) ? colour.fill : colour.soft);
const restForm = (s) => (heavy(s) ? "press" : "set");
const glossOf = (s) => (heavy(s) ? undefined : s.weight === "mid" ? 3 : 2);
const shadowOf = (s) => (heavy(s) ? undefined : "0 2px 5px rgba(42, 35, 32, 0.08)");
const listeners = new Set();
function setLiquidSettings(next) {
  Object.assign(settings, next);
  listeners.forEach((fn) => fn());
}
function useSettings() {
  const [, bump] = useState(0);
  useLayoutEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return settings;
}

/** A plasticine body: a real kit liquid surface with crisp text on top. */
function Bead({ colour, children, onClick, selected, radius = 999, big, pressed, dim, style }) {
  const s = useSettings();
  // Colours stay bright in the dark too: dark ink on them clears 6:1 either way,
  // while the deeper shades fell to 3.3-4.2 with any ink.
  const [down, setDown] = useState(false);
  const fill = colour ? fillOf(colour, s) : s.mode === "dark" ? "#3a3330" : CREAM;
  const touched = Boolean(pressed || down);
  // 厚 swells the chosen one; 轻 says it with colour and the tick, and stays firm.
  const form = touched ? "press" : selected && heavy(s) ? "swell" : restForm(s);
  return (
    <LiquidSurface
      form={form}
      // An engaged `set` is firm: no outline swell and little gloss.
      active={Boolean(selected || touched || form === "set")}
      fill={fill}
      shadow={shadowOf(s)}
      radius={radius}
      liquidFinish={finishOf(s)}
      style={{ display: "block", opacity: dim ? 0.35 : 1, ...style }}
    >
      <button
        type="button"
        className={`lq-bead${big ? " lq-bead--big" : ""}${selected ? " is-selected" : ""}`}
        style={{ color: colour || s.mode !== "dark" ? INK : "#f6efe4" }}
        onClick={onClick}
        onPointerDown={() => setDown(true)}
        onPointerUp={() => setDown(false)}
        onPointerLeave={() => setDown(false)}
        onPointerCancel={() => setDown(false)}
      >
        {selected ? <span className="lq-tick" aria-hidden="true">✓</span> : null}
        {children}
      </button>
    </LiquidSurface>
  );
}

function Phases({ on, count }) {
  const s = useSettings();
  return (
    <div className="lq-top">
      <div className="lq-phases">
        {["猜", "跑", "看", "改", "做"].map((p, i) =>
          i === on ? (
            <LiquidSurface key={p} form="settle" active fill={fillOf(C.sun, s)} radius={999} liquidFinish={finishOf(s)} shadow={shadowOf(s)}>
              <i className="on">{p}</i>
            </LiquidSurface>
          ) : (
            <i key={p}>{p}</i>
          ),
        )}
      </div>
      <span className="lq-count">{count}</span>
    </div>
  );
}

function Guess() {
  const [picked, setPicked] = useState(1);
  const options = ["说说这张照片里有什么。", "勺子在杯子的哪一边？", "帮我看看这张照片。"];
  return (
    <div className="lq-screen">
      <Phases on={0} count="2 / 12" />
      <div className="lq-body">
        <div className="lq-eb">猜 · 选一个</div>
        <h4>你想知道勺子在杯子哪一边。哪句最能问到？</h4>
        <p className="lq-sub">随便猜，猜错不扣分。</p>
        <img className="lq-photo" src="assets/coffee.jpg" alt="" />
        <div className="lq-opts">
          {options.map((text, i) => (
            <Bead
              key={text}
              colour={picked === i ? C.leaf : null}
              selected={picked === i}
              radius={20}
              onClick={() => setPicked(i)}
            >
              {text}
            </Bead>
          ))}
        </div>
        <p className="lq-fb">记住你选的这句。马上发出去试试。</p>
        <Bead colour={C.coral} big>
          发出去试试
        </Bead>
      </div>
    </div>
  );
}

/** A drop that starts where the card was and pours into its bin's body. */
function Pour({ from, colour, onDone }) {
  const s = useSettings();
  const ref = useRef(null);
  const [offset, setOffset] = useState(null);
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !from) return;
    setOffset({ x: from.x - box.x, y: from.y - box.y });
    const t1 = requestAnimationFrame(() => requestAnimationFrame(() => setOffset({ x: 0, y: 0 })));
    const t2 = setTimeout(onDone, 900);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
    };
  }, []);
  return (
    <LiquidGroup.Item
      x={offset?.x ?? 0}
      y={offset?.y ?? 0}
      scale={offset && offset.x === 0 ? 0.35 : 1}
      transition="smooth"
      radius={16}
      // Over the pool, out of the layout: a drop in flight takes no room.
      style={{ position: "absolute", left: "calc(50% - 60px)", top: "calc(50% - 22px)" }}
    >
      <div ref={ref} className="lq-drop" style={{ background: "transparent" }} data-colour={colour.id} />
    </LiquidGroup.Item>
  );
}

function Bin({ colour, label, pours, onPoured, onAnswer }) {
  const s = useSettings();
  return (
    <LiquidGroup
      fill={fillOf(colour, s)}
      liquidFinish={finishOf(s)}
      gloss={glossOf(s)}
      shadow={shadowOf(s)}
      waviness={s.motion === "always" ? 3 : 0}
      className="lq-bin-group"
    >
      <LiquidGroup.Item radius={22}>
        <button type="button" className="lq-bin" style={{ color: INK }} onClick={onAnswer}>
          {label}
        </button>
      </LiquidGroup.Item>
      {pours.map((p) => (
        <Pour key={p.key} from={p.from} colour={colour} onDone={() => onPoured(p.key)} />
      ))}
    </LiquidGroup>
  );
}

function Round() {
  const cards = [
    { text: "杯子是什么颜色？", bin: "yes" },
    { text: "咖啡甜不甜？", bin: "no" },
    { text: "这是哪家店？", bin: "no" },
    { text: "勺子在哪一边？", bin: "yes" },
  ];
  const [at, setAt] = useState(0);
  const [pours, setPours] = useState({ yes: [], no: [] });
  const [feedback, setFeedback] = useState(null);
  const card = useRef(null);
  const serial = useRef(0);
  const answer = (bin) => {
    const current = cards[at % cards.length];
    const box = card.current?.getBoundingClientRect();
    const right = current.bin === bin;
    setFeedback(right ? { ok: true, text: "对了。" } : { ok: false, text: "照片只能看，不能尝，也看不到店名。" });
    if (!right) return;
    setPours((all) => ({ ...all, [bin]: [...all[bin], { key: ++serial.current, from: box ? { x: box.x, y: box.y } : null }] }));
    setAt((n) => n + 1);
  };
  const current = cards[at % cards.length];
  return (
    <div className="lq-screen">
      <Phases on={2} count="6 / 12" />
      <div className="lq-body">
        <div className="lq-eb">看 · 分一分</div>
        <h4>光看照片，答得出来吗？</h4>
        <p className="lq-sub">点下面的颜色，卡片会流进去</p>
        <div className="lq-card-row">
          <div ref={card}>
            <Bead colour={C.sky} radius={18} key={at}>
              {current.text}
            </Bead>
          </div>
        </div>
        <div className="lq-bins">
          {[
            ["yes", "答得出", C.leaf],
            ["no", "答不出", C.coral],
          ].map(([id, label, colour]) => (
            <Bin
              key={id}
              colour={colour}
              label={label}
              pours={pours[id]}
              onAnswer={() => answer(id)}
              onPoured={(key) => setPours((all) => ({ ...all, [id]: all[id].filter((p) => p.key !== key) }))}
            />
          ))}
        </div>
        {feedback ? <p className={`lq-fb ${feedback.ok ? "" : "no"}`}>{feedback.text}</p> : null}
      </div>
    </div>
  );
}

function Build() {
  const pieces = [
    { id: "look", text: "看这张照片，", colour: C.sun },
    { id: "cup", text: "杯子里", colour: C.leaf },
    { id: "foam", text: "有没有泡沫？", colour: C.sky },
    { id: "all", text: "说说整张照片", colour: C.coral },
    { id: "long", text: "写得越长越好", colour: C.pink },
  ];
  const s = useSettings();
  const [placed, setPlaced] = useState([]);
  const origin = useRef({});
  const place = (piece, el) => {
    if (placed.some((p) => p.id === piece.id)) return;
    const box = el?.getBoundingClientRect();
    origin.current[piece.id] = box ? { x: box.x, y: box.y } : null;
    setPlaced((list) => [...list, piece]);
  };
  return (
    <div className="lq-screen">
      <Phases on={3} count="7 / 12" />
      <div className="lq-body">
        <div className="lq-eb">改 · 排一排</div>
        <h4>现在想知道：杯子里有没有泡沫。拼一句，只问这一处</h4>
        <p className="lq-ctx">原来那句：说说这张照片里有什么。</p>
        <LiquidGroup
          className="lq-sentence"
          fill={fillOf(C.grape, s)}
          liquidFinish={finishOf(s)}
          gloss={glossOf(s)}
          shadow={shadowOf(s)}
          blur={7}
          waviness={s.motion === "always" ? 3 : 0}
        >
          {placed.length ? (
            placed.map((piece) => <Placed key={piece.id} piece={piece} from={origin.current[piece.id]} />)
          ) : (
            <LiquidGroup.Item radius={16}>
              <span className="lq-slot">点下面的词块，拼进来</span>
            </LiquidGroup.Item>
          )}
        </LiquidGroup>
        <div className="lq-tray">
          {pieces.map((piece) => (
            <TrayPiece key={piece.id} piece={piece} used={placed.some((p) => p.id === piece.id)} onPlace={place} />
          ))}
        </div>
        <div className="lq-row">
          <Bead colour={C.coral} big>
            拼好了，发车
          </Bead>
          <button type="button" className="lq-reset" onClick={() => setPlaced([])}>
            重来
          </button>
        </div>
      </div>
    </div>
  );
}

function TrayPiece({ piece, used, onPlace }) {
  const ref = useRef(null);
  return (
    <div ref={ref} className="lq-tray-piece">
      <Bead colour={piece.colour} radius={14} dim={used} onClick={() => onPlace(piece, ref.current)}>
        {piece.text}
      </Bead>
    </div>
  );
}

/** A piece that flies from the tray and fuses into the sentence body. */
function Placed({ piece, from }) {
  const ref = useRef(null);
  const [offset, setOffset] = useState(null);
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !from) return;
    setOffset({ x: from.x - box.x, y: from.y - box.y });
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setOffset({ x: 0, y: 0 })));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <LiquidGroup.Item
      x={offset?.x ?? 0}
      y={offset?.y ?? 0}
      transition="bouncy"
      radius={14}
    >
      <span ref={ref} className="lq-word" style={{ color: INK }}>
        {piece.text}
      </span>
    </LiquidGroup.Item>
  );
}

function Palette() {
  const s = useSettings();
  return (
    <div className="lq-palette">
      {PALETTE.map((p) => (
        <div key={p.id} className="lq-swatch">
          <Bead colour={p} radius={18}>
            {p.name}
          </Bead>
          <code>{fillOf(p, s)}</code>
        </div>
      ))}
    </div>
  );
}

const SCREENS = { guess: Guess, round: Round, build: Build, palette: Palette };
document.querySelectorAll("[data-liquid]").forEach((el) => {
  const Screen = SCREENS[el.getAttribute("data-liquid")];
  if (Screen) createRoot(el).render(<Screen />);
});
window.LiquidTheme = { set: setLiquidSettings, PALETTE, INK };
