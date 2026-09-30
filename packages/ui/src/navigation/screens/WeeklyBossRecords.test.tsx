import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProgress, weeklyBossLocationEventId } from "@pieai/university-core";
import { InterfaceLanguageProvider } from "../../i18n/index.js";
import { WeeklyBossRecords } from "./WeeklyBossRecords.js";

const now = new Date(2026, 9, 6, 12).getTime();
describe("weekly records keep the entire win history in accessible DOM", () => {
  for (const locale of ["en", "zh-CN"] as const)
    it(locale, () => {
      const doc = emptyProgress();
      for (let index = 0; index < 12; index++) {
        const week = new Date(Date.UTC(2026, 9, 5 - index * 7)).toISOString().slice(0, 10);
        doc.xpEvents[`weekly-boss:${week}`] = 50;
        doc.xpEvents[
          weeklyBossLocationEventId(week, { studyId: "s", courseId: "c", lessonId: "l" })
        ] = 0;
      }
      doc.xpEvents["weekly-boss:2026-10-05:flawless"] = 0;
      const markup = renderToStaticMarkup(
        <InterfaceLanguageProvider locale={locale}>
          <WeeklyBossRecords document={doc} now={now} />
        </InterfaceLanguageProvider>,
      );
      expect(markup).toContain('data-weekly-wins="12"');
      expect(markup.match(/data-weekly-win=/g)).toHaveLength(12);
      expect(markup).toContain(locale === "en" ? "Five in a row" : "五连中");
      expect(markup).not.toContain("canvas");
    });
});
