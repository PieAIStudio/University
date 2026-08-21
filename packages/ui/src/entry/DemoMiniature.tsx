import { useEffect, useRef, useState } from "react";
import {
  GameBadge,
  GameButton,
  GameInput,
  GameProgress,
  GameSegmentedControl,
  GameSlider,
  GameToggle,
} from "@pieai/swimmer-ui-kit";
import type { DemoNode } from "@pieai/university-core";

/**
 * C9 and C11: a working miniature of the thing being named.
 *
 * This is the half of the source site that actually persuades anyone, and the
 * reason is not that pictures are nicer than words. 「禁用」 has a one-sentence
 * definition that a beginner can read, agree with, and still not recognise on
 * screen. A greyed-out button that does not depress when you click it teaches
 * the same sentence in a way that survives being told once.
 *
 * Every leaf renders through the brand kit rather than through markup written
 * here. That is the portfolio rule, and it also buys the thing that makes these
 * demos honest: the miniature *is* the control the product ships, so it cannot
 * quietly show a nicer button than the one a learner will meet.
 */

type DemoLeaf = Exclude<DemoNode, { kind: "row" | "stack" }>;

function Leaf({ node }: { readonly node: DemoLeaf }) {
  switch (node.kind) {
    case "text":
      return (
        <p className={node.muted ? "demo__text demo__text--muted" : "demo__text"}>{node.text}</p>
      );
    case "button":
      return (
        <GameButton
          variant={node.variant ?? "primary"}
          disabled={node.disabled ?? false}
          // A demo button that navigates or submits would be a trap. It is a
          // real control so that focus, disabled and press feedback are real;
          // it does nothing so that clicking it is safe.
          type="button"
        >
          {node.label}
        </GameButton>
      );
    case "input":
      return (
        <label className="demo__field">
          {node.label ? <span className="demo__field-label">{node.label}</span> : null}
          <GameInput
            defaultValue={node.value ?? ""}
            placeholder={node.placeholder}
            invalid={node.invalid ?? false}
          />
        </label>
      );
    case "toggle":
      return <DemoToggle label={node.label} checked={node.checked} />;
    case "slider":
      return (
        <DemoSlider
          label={node.label}
          value={node.value}
          min={node.min ?? 0}
          max={node.max ?? 100}
        />
      );
    case "badge":
      return <GameBadge tone={node.tone ?? "neutral"}>{node.label}</GameBadge>;
    case "progress":
      return <GameProgress label={node.label} value={node.value} max={node.max ?? 100} showValue />;
    case "divider":
      return <hr className="demo__divider" />;
    case "block":
      return (
        <div
          className={`demo__block demo__block--${node.height ?? "short"}`}
          // The placeholder stands in for content, so it is decoration with a
          // caption rather than something a screen reader should read as a box.
          aria-hidden={node.label ? undefined : true}
        >
          {node.label ?? null}
        </div>
      );
  }
}

/**
 * The demo's own state, not the page's.
 *
 * `checked` in the payload is the starting position. A toggle you cannot flip
 * is a picture of a toggle, and the entry for 「开关」 would then be teaching
 * the thing it is trying to show.
 */
function DemoToggle({ label, checked }: { readonly label: string; readonly checked: boolean }) {
  const [on, setOn] = useState(checked);
  useEffect(() => setOn(checked), [checked]);
  return <GameToggle label={label} checked={on} onClick={() => setOn((value) => !value)} />;
}

function DemoSlider({
  label,
  value,
  min,
  max,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
}) {
  const [current, setCurrent] = useState(value);
  useEffect(() => setCurrent(value), [value]);
  return <GameSlider label={label} value={current} min={min} max={max} onChange={setCurrent} />;
}

function Nodes({ nodes }: { readonly nodes: readonly DemoNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.kind === "row" || node.kind === "stack") {
          return (
            <div key={index} className={`demo__group demo__group--${node.kind}`}>
              {node.children.map((child: DemoLeaf, childIndex: number) => (
                <Leaf key={childIndex} node={child} />
              ))}
            </div>
          );
        }
        return <Leaf key={index} node={node} />;
      })}
    </>
  );
}

export interface DemoState {
  readonly id: string;
  readonly label: string;
  readonly note?: string;
  readonly nodes: readonly DemoNode[];
}

export function DemoMiniature({
  alt,
  caption,
  states,
}: {
  readonly alt: string;
  readonly caption?: string;
  readonly states: readonly DemoState[];
}) {
  const first = states[0];
  const [activeId, setActiveId] = useState(first?.id ?? "");
  const known = useRef(states);
  useEffect(() => {
    if (known.current === states) return;
    known.current = states;
    setActiveId(states[0]?.id ?? "");
  }, [states]);

  const active = states.find((state) => state.id === activeId) ?? first;
  if (!active) return null;

  return (
    <figure className="demo">
      {states.length > 1 ? (
        <GameSegmentedControl
          label="切换状态"
          activeId={active.id}
          options={states.map((state) => ({ id: state.id, label: state.label }))}
          onSelect={setActiveId}
        />
      ) : null}
      {/*
        The viewport scales rather than reflows. A miniature that rearranges
        itself on a narrow screen is no longer showing the arrangement, which
        for a layout demo is the entire content.
      */}
      <div className="demo__viewport">
        {/*
          The arrangement is the meaning here, so the sentence that replaces it
          has to be on the same element a screen reader reaches.
        */}
        <div className="demo__stage" role="img" aria-label={alt}>
          <Nodes nodes={active.nodes} />
        </div>
      </div>
      {active.note ? <p className="demo__note">{active.note}</p> : null}
      {caption ? <figcaption className="demo__caption">{caption}</figcaption> : null}
    </figure>
  );
}
