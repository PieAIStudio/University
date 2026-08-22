import { useCallback, useState } from "react";

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

export function FeedbackNote({ shell }: { readonly shell: string }) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState("");
  const [copied, setCopied] = useState(false);
  const [handCopy, setHandCopy] = useState(false);

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
      <button type="button" className="feedback-note__open" onClick={() => setOpen(true)}>
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
