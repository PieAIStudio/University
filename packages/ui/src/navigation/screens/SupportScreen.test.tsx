import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterfaceLanguageProvider } from "../../i18n/index.js";
import { SupportScreen } from "./SupportScreen.js";
import { ProfileScreen } from "../empty/ProfileScreen.js";

for (const locale of ["zh-CN", "en"] as const)
  describe(`support ${locale}`, () => {
    it.each(["privacy", "terms", "refunds"] as const)(
      "%s has no invented agreement or consent",
      (page) => {
        const html = renderToStaticMarkup(
          <InterfaceLanguageProvider locale={locale}>
            <SupportScreen page={page} />
          </InterfaceLanguageProvider>,
        );
        expect(html).toContain('data-policy-status="unpublished"');
        expect(html).not.toMatch(/<form|type="checkbox"|mailto:|example\.com/);
        expect(html).toContain(`/help?lang=${locale}`);
        expect(html).toContain(`/about?lang=${locale}`);
      },
    );
    it("has real account, FAQ and feedback destinations without fake contact details", () => {
      const html = renderToStaticMarkup(
        <InterfaceLanguageProvider locale={locale}>
          <SupportScreen
            page="help"
            saveStatus={<span data-live-save-state>actual host status</span>}
          />
        </InterfaceLanguageProvider>,
      );
      expect(html.match(/data-faq=/g)).toHaveLength(6);
      expect(html).toContain("data-live-save-state");
      expect(html).toContain(`/me?lang=${locale}#profile-help`);
      expect(html).toContain(`/plans?lang=${locale}`);
    });
    it("keeps the existing feedback host and separates the email from save status", () => {
      const email = "long-learner-account@example.test";
      const html = renderToStaticMarkup(
        <InterfaceLanguageProvider locale={locale}>
          <ProfileScreen
            passagesRead={0}
            lessonsCompleted={0}
            accountEmail={email}
            saveStatus={<span>LOCAL-ONLY</span>}
          />
        </InterfaceLanguageProvider>,
      );
      expect(html).toContain(email);
      expect(html).toContain("LOCAL-ONLY");
      expect(html).toContain('id="profile-feedback-host"');
      expect(html).toContain(`/about?lang=${locale}`);
      expect(html).toContain(`/help?lang=${locale}`);
      const guest = renderToStaticMarkup(
        <InterfaceLanguageProvider locale={locale}>
          <ProfileScreen passagesRead={0} lessonsCompleted={0} />
        </InterfaceLanguageProvider>,
      );
      expect(guest).not.toContain("data-profile-email");
    });
  });
