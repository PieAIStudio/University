import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

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
 * The clipboard is the transport on purpose. The authoring shell already
 * grades through it, there is no server to post to, and a note that needs an
 * account before it can be written is a note that does not get written.
 *
 * **This is scaffolding for a review pass, not a product feature.** Both
 * shells pass `import.meta.env.DEV`, so it does not exist in a build. A
 * permanent feedback surface is a real design job — where it lives, whether it
 * interrupts, what happens to what it collects — and none of that has been
 * done. Shipping this quietly into production would be deciding all of it by
 * accident.
 */
export function feedbackNote(args: {
  readonly shell: string;
  readonly route: string;
  readonly viewport: readonly [number, number];
  readonly theme: string;
  readonly at: Date;
  readonly said: string;
}): string {
  const [width, height] = args.viewport;
  return [
    `## ${args.said.trim() || "(没写内容)"}`,
    "",
    `- 壳：${args.shell}`,
    `- 路由：${args.route}`,
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
 * The note is mounted next to `App` (DEV-only, in each shell's `main.tsx`) so
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

export function FeedbackNote({ shell }: { readonly shell: string }) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const [copied, setCopied] = useState(false);
  const [handCopy, setHandCopy] = useState(false);
  const scrolling = useHiddenWhileScrolling();
  const host = useRailFooter();

  const copy = useCallback(async () => {
    const note = feedbackNote({
      shell,
      route: feedbackRouteOf(window.location),
      viewport: [window.innerWidth, window.innerHeight],
      theme:
        document.documentElement.getAttribute("data-game-ui-theme") ??
        document.querySelector("[data-game-ui-theme]")?.getAttribute("data-game-ui-theme") ??
        "light",
      at: new Date(),
      said,
    });
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setHandCopy(false);
    } catch {
      /*
        A blocked clipboard is where this could have quietly failed. The
        sentence is in the box, but the route, width and theme — the entire
        reason this exists — live only inside the note. So on failure the note
        replaces the box's contents and the panel says to copy it by hand.
        Leaving the person with their own sentence and none of the context
        would be the same as not having the button.
      */
      setSaid(note);
      setHandCopy(true);
      setCopied(false);
    }
  }, [shell, said]);

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
          setCopied(false);
          setHandCopy(false);
        }}
      />
      <p className="feedback-note__meta">
        {handCopy
          ? "复制不了剪贴板，整条已经放进上面的框，手动全选复制。"
          : "路由、宽度、主题和时间会自动带上。"}
      </p>
      <div className="feedback-note__actions">
        <button type="button" className="feedback-note__copy" onClick={copy}>
          {copied ? "已复制 ✓" : "复制这条"}
        </button>
        <button
          type="button"
          className="feedback-note__close"
          onClick={() => {
            setOpen(false);
            setCopied(false);
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
