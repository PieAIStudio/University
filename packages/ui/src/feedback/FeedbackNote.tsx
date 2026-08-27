import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { lessonRefKey, type FeedbackContext, type FeedbackPort } from "@pieai/university-core";

import { FeedbackIcon } from "../shell/icons.js";

/**
 * A note about the screen you are looking at, on the clipboard, in one move.
 *
 * The owner of this product tries it and wants to say "this is wrong here".
 * Without this they have to leave the app, remember which screen it was, and
 * describe it from memory — and every one of those steps loses the detail that
 * would have made the report actionable. The route, the width and the theme
 * are exactly what gets forgotten and exactly what a machine can capture, so
 * the person only has to supply the sentence a machine cannot.
 *
 * The transport is injected. The authoring shell hands this note to its
 * existing clipboard/AI workflow; the delivery shell stores the same shape in
 * SwimmerBackend. The learner should not have to know which one happened.
 */
export function feedbackNote(args: {
  readonly shell: string;
  readonly route: string;
  readonly viewport: readonly [number, number];
  readonly theme: string;
  readonly at: Date;
  readonly said: string;
  readonly locator?: FeedbackContext["locator"];
  readonly contentRevision?: number | null;
  readonly exerciseAttemptCount?: number;
  readonly signedIn?: boolean;
}): string {
  const [width, height] = args.viewport;
  return [
    `## ${args.said.trim() || "(没写内容)"}`,
    "",
    `- 壳：${args.shell}`,
    `- 路由：${args.route}`,
    `- 课程定位：${args.locator ? lessonRefKey(args.locator) : "未定位到具体课程"}`,
    `- 内容版本：${args.contentRevision ?? "未定位到具体课程"}`,
    `- 练习尝试次数：${args.exerciseAttemptCount ?? 0}`,
    `- 登录状态：${args.signedIn ? "已登录" : "未登录"}`,
    `- 视口：${width}×${height}`,
    `- 主题：${args.theme}`,
    `- 时间：${args.at.toISOString()}`,
  ].join("\n");
}

/** The route in a note follows the app's path-based address, including query. */
export function feedbackRouteOf(location: {
  readonly pathname: string;
  readonly search: string;
}): string {
  return `${location.pathname}${location.search}`;
}

/**
 * Finds the rail footer without living in the rail's tree.
 *
 * The note is mounted next to `App` (in each shell's `main.tsx`) so
 * it still exists on routes that drop UniversityShell. The footer is an empty
 * host the rail always renders. Watching the body is how a sibling finds a
 * node it does not own, and how it lets go when a lesson route removes it.
 */
function useRailFooter(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const sync = () => setHost(document.getElementById("app-shell-rail-footer"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return host;
}

/**
 * Out of the way while the page is moving — but only the floating pill.
 *
 * It used to be pinned to a corner on every screen, and there it covered
 * whatever was under it — measured on the concepts index, the closed pill sat
 * directly on 「界面此刻必须记住、而且会跟着操作变的信息。」 A phone has no
 * gutter to hide in: the reading column is the whole width, so there is no
 * corner that is reliably empty.
 *
 * On the wide layout it now sits in the rail footer, same visual language as
 * the tabs but a button that opens a panel, not a link that goes somewhere.
 * A rail item that vanishes while you scroll would be a tab that cannot be
 * trusted. The hide-on-scroll stays for the floating pill, which still has
 * to live above the tab bar on a phone and on routes with no rail.
 *
 * `capture: true` because `scroll` does not bubble, and the shells scroll an
 * inner element on some screens and the document on others. Capturing at the
 * document catches both without either shell having to declare which it is.
 */
function useHiddenWhileScrolling(): boolean {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setScrolling(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 420);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);

  return scrolling;
}

function FeedbackTrigger({
  className,
  open,
  onOpen,
}: {
  readonly className: string;
  readonly open: boolean;
  readonly onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
    >
      <span className="nav-rail__icon">
        <FeedbackIcon />
      </span>
      <span className="nav-rail__label">提意见</span>
    </button>
  );
}

const unavailableFeedbackPort: FeedbackPort = {
  transport: "unavailable",
  async submit() {
    throw new Error("反馈通道还没有接好。");
  },
  async readMine() {
    throw new Error("反馈通道还没有接好。");
  },
};

type FeedbackNoteContext = Pick<
  FeedbackContext,
  "locator" | "contentRevision" | "exerciseAttemptCount" | "signedIn"
>;

export function FeedbackNote({
  shell,
  port = unavailableFeedbackPort,
  context = {
    locator: null,
    contentRevision: null,
    exerciseAttemptCount: 0,
    signedIn: false,
  },
  lessonTitle = null,
}: {
  readonly shell: string;
  readonly port?: FeedbackPort;
  readonly context?: FeedbackNoteContext;
  /** Display-only title; the submitted payload uses the canonical locator. */
  readonly lessonTitle?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "success" | "hand-copy" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrolling = useHiddenWhileScrolling();
  const host = useRailFooter();

  const submit = useCallback(async () => {
    const at = new Date();
    const feedbackContext: FeedbackContext = {
      ...context,
      // `feedbackRouteOf` and not `hash || pathname`: lesson addresses are
      // paths now, and reading the hash first reported "/" for every lesson.
      route: feedbackRouteOf(window.location),
      viewport: [window.innerWidth, window.innerHeight],
    };
    const note = feedbackNote({
      shell,
      route: feedbackContext.route,
      viewport: feedbackContext.viewport,
      theme:
        document.documentElement.getAttribute("data-game-ui-theme") ??
        document.querySelector("[data-game-ui-theme]")?.getAttribute("data-game-ui-theme") ??
        "light",
      at,
      said,
      locator: feedbackContext.locator,
      contentRevision: feedbackContext.contentRevision,
      exerciseAttemptCount: feedbackContext.exerciseAttemptCount,
      signedIn: feedbackContext.signedIn,
    });
    setState("busy");
    setErrorMessage(null);
    try {
      await port.submit({ message: said, context: feedbackContext });
      setState("success");
    } catch {
      /*
        A blocked clipboard is recoverable because the full note is in the
        text area. A delivery failure is different: showing a checkmark or
        silently copying would spend the learner's trust, so it stays an
        explicit error and never falls back to the clipboard.
      */
      if (port.transport === "clipboard") {
        setSaid(note);
        setState("hand-copy");
        return;
      }
      setState("error");
      setErrorMessage(
        port.transport === "unavailable"
          ? "反馈暂时没有送出：反馈通道还没有接好。这次不会放进剪贴板。"
          : "反馈暂时没有送出，请稍后再试。这次不会放进剪贴板。",
      );
    }
  }, [context, port, said, shell]);

  const isBusy = state === "busy";
  const successMessage =
    port.transport === "clipboard"
      ? "已复制到剪贴板。作者可以把整条贴进 AI 对话。"
      : lessonTitle && context.contentRevision !== null
        ? `收到。这条记在《${lessonTitle}》第 ${context.contentRevision} 版上了。`
        : "收到。这条意见已经记下了。";
  const statusMessage =
    state === "hand-copy"
      ? "复制不了剪贴板，整条已经放进上面的框，手动全选复制。"
      : state === "error"
        ? errorMessage
        : state === "success"
          ? successMessage
          : "路由、课定位、版本、练习尝试次数、登录状态、视口和时间会自动带上。";
  const statusClass = state === "error" ? "is-error" : state === "success" ? "is-success" : "";
  const actionLabel =
    state === "busy"
      ? "正在发送…"
      : state === "success"
        ? port.transport === "clipboard"
          ? "已复制 ✓"
          : "已收到 ✓"
        : port.transport === "clipboard"
          ? "复制这条"
          : "发送意见";

  const panel = open ? (
    <div className="feedback-note" role="dialog" aria-label="提意见">
      <textarea
        className="feedback-note__text"
        value={said}
        autoFocus
        rows={3}
        placeholder="这一屏哪里不对？"
        onChange={(event) => {
          setSaid(event.target.value);
          setState("idle");
          setErrorMessage(null);
        }}
      />
      <p className={`feedback-note__meta ${statusClass}`} role="status">
        {statusMessage}
      </p>
      <div className="feedback-note__actions">
        <button
          type="button"
          className="feedback-note__copy"
          onClick={submit}
          disabled={isBusy || said.trim().length === 0}
        >
          {actionLabel}
        </button>
        <button
          type="button"
          className="feedback-note__close"
          onClick={() => {
            setOpen(false);
            setState("idle");
            setErrorMessage(null);
          }}
        >
          收起
        </button>
      </div>
    </div>
  ) : null;

  const docked = (
    <FeedbackTrigger
      className="nav-rail__link feedback-note__open--docked"
      open={open}
      onOpen={() => setOpen(true)}
    />
  );

  const floatClass = [
    "feedback-note__open",
    "feedback-note__open--float",
    host ? "" : "is-fallback",
    scrolling ? "is-away" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const shellRoot =
    typeof document !== "undefined"
      ? (document.querySelector(".app-shell") ?? document.body)
      : null;

  return (
    <>
      {host ? createPortal(docked, host) : null}
      <FeedbackTrigger className={floatClass} open={open} onOpen={() => setOpen(true)} />
      {panel && shellRoot ? createPortal(panel, shellRoot) : panel}
    </>
  );
}
