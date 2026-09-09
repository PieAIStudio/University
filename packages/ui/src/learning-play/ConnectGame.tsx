import { useEffect, useId, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  checkConnections,
  connectionKey,
  traceConnectionProbe,
  type Connection,
  type ConnectActivity,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import type { ActivityControls } from "./controls.js";

export function ConnectGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<ConnectActivity>) {
  const [edges, setEdges] = useState<Connection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [layout, setLayout] = useState({ width: 600, height: 288, nodeWidth: 168, nodeHeight: 88 });
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [activeProbe, setActiveProbe] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [traces, setTraces] = useState<{ label: string; visited: string[]; blocked: boolean }[]>(
    [],
  );
  const board = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const markerId = useId().replaceAll(":", "");
  useEffect(() => {
    if (!board.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const element = board.current;
      if (!element) return;
      const node = element.querySelector<HTMLButtonElement>(".play-connect__node");
      setCompact(element.clientWidth < 540);
      setLayout({
        width: element.clientWidth,
        height: element.clientHeight,
        nodeWidth: node?.offsetWidth ?? 168,
        nodeHeight: node?.offsetHeight ?? 88,
      });
    });
    observer.observe(board.current);
    for (const node of board.current.querySelectorAll(".play-connect__node"))
      observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  const rows = Math.max(1, Math.ceil(activity.nodes.length / 2));
  const nodes = activity.nodes.map((node, index) => ({
    ...node,
    x: compact ? (index % 2 === 0 ? 25 : 75) : node.x,
    y: compact ? ((Math.floor(index / 2) + 0.5) / rows) * 100 : node.y,
  }));
  const nodeOf = (id: string) => nodes.find((node) => node.id === id)!;
  const choose = (id: string) => {
    if (disabled || running) return;
    playSound("ui.press");
    setTraces([]);
    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected !== id && !edges.some((edge) => edge.from === selected && edge.to === id))
      setEdges([...edges, { from: selected, to: id }]);
    setSelected(null);
  };
  const run = () => {
    if (disabled || running) return;
    setSelected(null);
    const result = checkConnections(activity, edges);
    const extra = result.extra[0];
    const message = result.passed
      ? t("play.connect.win", { count: activity.edges.length })
      : extra
        ? t("play.connect.extra", { from: nodeOf(extra.from).label, to: nodeOf(extra.to).label })
        : t("play.connect.missing", { why: result.missing[0]?.why ?? activity.hint });
    const paths = activity.probes.map((probe) => {
      const trace = traceConnectionProbe(probe.path, edges);
      return { label: probe.label, visited: trace.visited, blocked: trace.blocked !== null };
    });
    const frames = paths.flatMap((path) => path.visited.map((id) => ({ id, label: path.label })));
    const finish = () => {
      setRunning(false);
      setActiveNode(null);
      setActiveProbe(null);
      setTraces(paths);
      onAttempt(
        result.passed,
        {
          connections: edges,
          probes: paths.map((path) => ({
            ...path,
            visited: path.visited.map((id) => nodeOf(id).label),
          })),
        },
        message,
      );
    };
    playSound("ui.press");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setRunning(true);
    setTraces([]);
    frames.forEach((frame, index) =>
      timers.current.push(
        setTimeout(() => {
          setActiveNode(frame.id);
          setActiveProbe(frame.label);
        }, index * 240),
      ),
    );
    timers.current.push(setTimeout(finish, frames.length * 240 + 160));
  };
  return (
    <div className="play-connect">
      <p className="play-instruction">
        {selected
          ? t("play.connect.selected", { label: nodeOf(selected).label })
          : guided
            ? edges.length
              ? t("play.usability.connect.next", { count: edges.length })
              : t("play.usability.connect.first", { name: activity.nodes[0]!.label })
            : t("play.connect.help")}
      </p>
      <div
        ref={board}
        className="play-connect__board"
        data-compact={compact}
        style={compact ? { height: rows * 150 } : undefined}
        aria-label={t("play.connect.board")}
      >
        <svg
          className="play-connect__wires"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="8"
              markerHeight="8"
              markerUnits="userSpaceOnUse"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8z" fill="currentColor" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const from = nodeOf(edge.from);
            const to = nodeOf(edge.to);
            const startX = (from.x / 100) * layout.width;
            const startY = (from.y / 100) * layout.height;
            const endX = (to.x / 100) * layout.width;
            const endY = (to.y / 100) * layout.height;
            const dx = endX - startX;
            const dy = endY - startY;
            // Terminate outside the real button bounds; center-to-center arrows
            // were hidden by the nodes, especially at phone widths.
            const inset =
              1 /
              Math.max(
                Math.abs(dx) / (layout.nodeWidth / 2),
                Math.abs(dy) / (layout.nodeHeight / 2),
              );
            const gap = 4 / Math.max(1, Math.hypot(dx, dy));
            return (
              <path
                key={connectionKey(edge)}
                className={activeNode === edge.to ? "is-travelling" : ""}
                d={`M${startX + dx * (inset + gap)} ${startY + dy * (inset + gap)} L${endX - dx * (inset + gap)} ${endY - dy * (inset + gap)}`}
                markerEnd={`url(#${markerId})`}
              />
            );
          })}
        </svg>
        {nodes.map((node) => (
          <GameButton
            sound={false}
            type="button"
            variant={selected === node.id ? "primary" : "secondary"}
            aria-pressed={selected === node.id}
            aria-label={node.label}
            disabled={disabled || running}
            key={node.id}
            className={`play-connect__node ${activeNode === node.id ? "is-active" : ""}`}
            style={{ insetInlineStart: `${node.x}%`, top: `${node.y}%` }}
            onClick={() => choose(node.id)}
          >
            <span className="play-connect__port" />
            <strong>{node.label}</strong>
            <small>{node.note}</small>
          </GameButton>
        ))}
        {activeProbe ? (
          <p className="play-connect__signal" role="status">
            {activeProbe}
          </p>
        ) : null}
      </div>
      <div className="play-connect__connections" aria-live="polite">
        {edges.length === 0 ? (
          <p className="play-muted">{t("play.connect.empty")}</p>
        ) : (
          edges.map((edge) => (
            <GameButton
              sound={false}
              variant="ghost"
              static
              type="button"
              key={connectionKey(edge)}
              disabled={disabled || running}
              aria-label={t("play.connect.remove", {
                from: nodeOf(edge.from).label,
                to: nodeOf(edge.to).label,
              })}
              onClick={() => {
                setEdges(edges.filter((other) => other !== edge));
                setTraces([]);
                playSound("ui.press");
              }}
            >
              <span>
                {nodeOf(edge.from).label} <span aria-hidden="true">→</span> {nodeOf(edge.to).label}
              </span>
              <span aria-hidden="true">×</span>
            </GameButton>
          ))
        )}
      </div>
      <div className="play-action-row">
        <GameButton
          sound={false}
          type="button"
          disabled={disabled || running || edges.length === 0}
          onClick={run}
        >
          {t(running ? "play.connect.running" : "play.connect.run")}
        </GameButton>
        <span className="play-muted">{t("play.connect.progress", { count: edges.length })}</span>
      </div>
      {traces.length > 0 ? (
        <div className="play-connect__traces" aria-label={t("play.connect.trace")}>
          {traces.map((trace) => (
            <p key={trace.label}>
              <strong>{trace.label}</strong>
              <span>
                {trace.visited.map((id) => nodeOf(id).label).join(" → ")}
                {trace.blocked ? " …" : " ✓"}
              </span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
