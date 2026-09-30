// lian-lab.html: an experiment, not the product. 涟's presence panel and
// droplet redrawn with the light the Owner chose for the coloured-liquid theme
// (2026-09-30): no specular layer, a narrow brighter band at the top, a touch
// deeper at the bottom, a soft contact shadow. The shapes keep 涟's own
// outline numbers from SwimmerUIKit liquid-presence: the reveal panel's
// amplitude 8 with radius 28, the droplet's amplitude 3.5, three lobes each.
// Nothing in SwimmerUIKit or SwimmerNerveKit changes. Rebuild with
// node docs/reference/interaction-components/lab/src/build-liquid.mjs
import { LiquidGroup } from "@pieai/swimmer-ui-kit";
import { createRoot } from "react-dom/client";
import { softenGloss } from "./soft-gloss.js";

/** Sampled from the current 涟 (assets/views/lian-now.jpg). */
const NOW = { from: "#27cfd7", to: "#22c5b9", button: "#ef8248", close: "#f1f7ed" };
/** One step lighter, like the macaron palette beside it. */
const SOFT = { from: "#9ce3e8", to: "#8fd8cc", button: "#f9a893", close: "#fffaf1" };

const rgb = (hex) => [16, 8, 0].map((shift) => (parseInt(hex.slice(1), 16) >> shift) & 255);
const css = (c) => `rgb(${c.map(Math.round).join(", ")})`;
/** `hex` moved `amount` of the way to white (1) or black (0), or to another colour. */
function mix(hex, toward, amount) {
  const target = typeof toward === "string" ? rgb(toward) : [toward, toward, toward];
  return css(rgb(hex).map((v, i) => v + (target[i] - v) * amount));
}

/** The same fall of light as the lesson beads: sheen band, body, deeper foot. */
function gradient(id, top, bottom, sheen) {
  const stops = [
    [0, mix(top, 255, sheen)],
    [0.16, mix(top, 255, sheen / 2)],
    [0.55, mix(top, bottom, 0.5)],
    [1, mix(bottom, 0, 0.05)],
  ];
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([at, colour]) => `<stop offset="${at}" stop-color="${colour}"/>`)
    .join("")}</linearGradient>`;
}
const defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
defs.setAttribute("aria-hidden", "true");
defs.setAttribute("width", "0");
defs.setAttribute("height", "0");
defs.style.position = "absolute";
defs.innerHTML = `<defs>${[
  ["now", NOW, 0.18],
  ["soft", SOFT, 0.25],
]
  .map(
    ([key, c, sheen]) =>
      gradient(`ll-${key}-body`, c.from, c.to, sheen) +
      gradient(`ll-${key}-button`, c.button, c.button, sheen) +
      gradient(`ll-${key}-close`, c.close, c.close, 0.6),
  )
  .join("")}</defs>`;
document.body.appendChild(defs);

const SHADOW = "0 6px 14px rgba(20, 60, 60, 0.18)";

/** One liquid body: the two public parts LiquidSurface itself is made of. */
function Body({ fill, radius, amplitude, className, children }) {
  return (
    <span className={`game-ui-liquid-surface ${className}`}>
      <LiquidGroup
        aria-hidden="true"
        className="game-ui-liquid-surface__body"
        blur={5}
        contrast={18}
        // 涟's own gloss, kept one pixel inside the edge (soft-gloss.js) so the
        // edge keeps its anti-aliasing.
        liquidFinish="glossy"
        gloss={3.5}
        fill={fill}
        filterPadding={36}
        shadow={SHADOW}
      >
        <LiquidGroup.Item
          className="game-ui-liquid-surface__shape"
          blob={{ amplitude, lobes: 3 }}
          radius={radius}
        >
          <span className="game-ui-liquid-surface__fill" />
        </LiquidGroup.Item>
      </LiquidGroup>
      <span className="game-ui-liquid-surface__content">{children}</span>
    </span>
  );
}

function Scene({ variant }) {
  return (
    <div className="ll-stage">
      <img className="ll-map" src="assets/views/map-grass.jpg" alt="" />
      <Body fill={`url(#ll-${variant}-body)`} radius={28} amplitude={8} className="ll-panel">
        <div className="ll-panel-in">
          <p className="ll-line">继续：第 1 关 · 大约 1 分钟</p>
          <Body
            fill={`url(#ll-${variant}-close)`}
            radius={999}
            amplitude={3.5}
            className="ll-close"
          >
            <span aria-hidden="true">×</span>
          </Body>
          <Body
            fill={`url(#ll-${variant}-button)`}
            radius={999}
            amplitude={3.5}
            className="ll-start"
          >
            <span>开始</span>
          </Body>
        </div>
      </Body>
      <Body fill={`url(#ll-${variant}-body)`} radius={30} amplitude={3.5} className="ll-drop">
        <span />
      </Body>
    </div>
  );
}

softenGloss(document.body);
new MutationObserver(() => softenGloss(document.body)).observe(document.body, {
  childList: true,
  subtree: true,
});
document.querySelectorAll("[data-lian]").forEach((el) => {
  createRoot(el).render(<Scene variant={el.getAttribute("data-lian")} />);
});
