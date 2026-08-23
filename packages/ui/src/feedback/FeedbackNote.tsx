import { useCallback, useEffect, useState } from "react";

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

/**
 * Out of the way while the page is moving.
 *
 * Pinned to a corner, this covered whatever was under it — measured on the
 * concepts index, the closed pill sat directly on 「界面此刻必须记住、而且会跟着
 * 操作变的信息。」 A phone has no gutter to hide in: the reading column is the
 * whole width, so there is no corner that is reliably empty.
 *
 * Scrolling is the signal. Someone moving the page is reading it and wants
 * nothing on top of it; someone who has stopped is looking at one screen and
 * may be about to say something about it. So it leaves on the first scroll and
 * comes back a beat after the last one.
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

export function FeedbackNote({ shell }: { readonly shell: string }) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const [copied, setCopied] = useState(false);
  const [handCopy, setHandCopy] = useState(false);
  const scrolling = useHiddenWhileScrolling();

  const copy = useCallback(async () => {
    const note = feedbackNote({
      shell,
      route: window.location.hash || window.location.pathname,
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

  if (!open) {
    return (
      <button
        type="button"
        className={`feedback-note__open${scrolling ? " is-away" : ""}`}
        onClick={() => setOpen(true)}
      >
        提意见
      </button>
    );
  }

  return (
    <div className="feedback-note" role="group" aria-label="提意见">
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
  );
}
