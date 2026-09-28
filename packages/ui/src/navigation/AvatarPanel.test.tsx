import { withInterfaceLocale } from "../../test-support/interface-locale.js";
// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AvatarPanel } from "./AvatarPanel.js";

const WEEK = Array.from({ length: 7 }, (_, index) => ({
  day: `2026-09-${28 + index}`,
  studied: index === 0,
  rested: index === 1,
  today: index === 2,
}));

function panel(overrides: Partial<Parameters<typeof AvatarPanel>[0]> = {}) {
  return renderToStaticMarkup(
    withInterfaceLocale(
      <AvatarPanel
        avatar={<button type="button">avatar</button>}
        todayProgress={0.5}
        streakDays={3}
        rank={{ name: "Stone" }}
        level={<div className="level">level</div>}
        week={WEEK}
        today={{ done: 0, goal: 1 }}
        membership={{ href: "/plans" }}
        {...overrides}
      />,
    ),
  );
}

describe("AvatarPanel", () => {
  it("draws today's ring by progress and turns it gold when the goal is met", () => {
    expect(panel()).not.toContain("data-goal-met");
    expect(panel({ todayProgress: 1 })).toContain('data-goal-met="true"');
    expect(panel({ todayProgress: Number.NaN })).toContain('stroke-dasharray="0 ');
  });

  it("names the streak for a screen reader, and greys a zero rather than hiding it", () => {
    expect(panel()).toMatch(/role="img" aria-label="[^"]*3/);
    expect(panel()).not.toContain("data-muted");
    expect(panel({ streakDays: 0 })).toMatch(/avatar-panel__flame"[^>]*data-muted="true"/);
  });

  it("says each day's full name, since two weekdays share a letter", () => {
    const labels = [...panel().matchAll(/class="avatar-panel__day"[^>]*aria-label="([^"]*)"/g)];
    expect(new Set(labels.map((match) => match[1])).size).toBe(7);
  });

  it("marks the week's studied, rest and today dots", () => {
    const html = panel();
    expect(html.match(/data-studied="true"/g)).toHaveLength(1);
    expect(html.match(/data-rested="true"/g)).toHaveLength(1);
    expect(html.match(/data-today="true"/g)).toHaveLength(1);
    expect(html.match(/class="avatar-panel__day"/g)).toHaveLength(7);
  });

  it("links membership only when given a real path", () => {
    expect(panel()).toContain('href="/plans"');
    expect(panel({ membership: undefined })).not.toContain("avatar-panel__membership");
  });
});
