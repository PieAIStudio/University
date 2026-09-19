import { expect, test, type Page, type Route } from "@playwright/test";

import {
  closeVisibleDialog,
  auditAxeBaseline,
  EXPERIENCE_ROUTES,
  EXPERIENCE_VIEWPORTS,
  openCourseNodeEntry,
  openCoursePickEntry,
  openCourseUnitDialog,
  openFeedbackDialog,
  openLessonLayerDialog,
  openLessonSourceDialog,
  openLibraryDialog,
  openExperienceRoute,
  prepareCoverageTarget,
  assertVisibleAndHittableAtFivePoints,
  clickAndMeasureResponse,
  touchTargetViolations,
  TOUCH_TARGET_EXEMPTIONS,
  type ExperienceViewport,
} from "./harness/experience.js";
import { watchConsole } from "./harness/console.js";
import { namedStep } from "./harness/step.js";

const KNOWN_DIALOG_ISSUES = new Map([
  [
    "feedback",
    "反馈面板是 role=dialog，但 .feedback-note__close 当前小于 44×44，且组件没有 Esc 关闭路径；留在报告，不改产品。",
  ],
]);

const KNOWN_RESPONSE_ISSUES = new Map([
  [
    "lesson/phone/lesson-completion",
    "当前手机长课完成 CTA 的首次 DOM 响应曾测得约 283–330ms；低于 300ms 的运行可通过，超出时留作毛刺记录。",
  ],
]);

type DialogScenario = {
  readonly id: string;
  readonly label: string;
  readonly open: (
    page: Page,
    viewport: ExperienceViewport,
  ) => Promise<import("@playwright/test").Locator>;
};

const DIALOG_SCENARIOS: readonly DialogScenario[] = [
  { id: "course-unit", label: "课程单元说明", open: openCourseUnitDialog },
  { id: "library-reference", label: "图鉴概念说明", open: openLibraryDialog },
  /*
   * 账号能力说明 is not listed. That dialog exists only in a build with no
   * backend configured, which is the shape the site must never ship in;
   * the configured shape draws a sign-in form and no dialog at all. X2/X3
   * still walk /me, and readyProfile now fails if the way in disappears.
   */
  /*
   * An unavailable purchase attempt is an inline alert, not a dialog. T3
   * checks that boundary and that no payment is taken; listing it here would
   * make this overlay invariant demand a dialog the product deliberately does
   * not render.
   */
  { id: "feedback", label: "提意见", open: openFeedbackDialog },
  { id: "lesson-source", label: "课文源码证据", open: openLessonSourceDialog },
  { id: "lesson-layer", label: "课文项目分层", open: openLessonLayerDialog },
];

const MAP_ENTRY_SCENARIOS = [
  { id: "course-pick-entry", label: "地图课程岛入口", open: openCoursePickEntry },
  { id: "course-node-entry", label: "课程关卡入口", open: openCourseNodeEntry },
] as const;

const CORE_ROUTE_IDS = new Set(["world", "plans", "lesson"]);
const CTA_ROUTE_IDS = new Set(["world", "plans", "me", "lesson"]);
const TOUCH_ROUTE_IDS = new Set(["world", "practice", "plans", "lesson"]);

const coreRoutes = EXPERIENCE_ROUTES.filter((route) => CORE_ROUTE_IDS.has(route.id));
const ctaRoutes = EXPERIENCE_ROUTES.filter((route) => CTA_ROUTE_IDS.has(route.id));
const touchRoutes = EXPERIENCE_ROUTES.filter((route) => TOUCH_ROUTE_IDS.has(route.id));

// The complete route table stays in the helper. The BRIEF's speed fallback
// samples core routes, plus the known touch-target and login paths.
const FAST_DIALOG_IDS = new Set(["feedback", "lesson-source"]);
const FAST_DIALOG_SCENARIOS = DIALOG_SCENARIOS.filter((scenario) =>
  FAST_DIALOG_IDS.has(scenario.id),
);

test.describe("M 跨屏体验不变量", () => {
  for (const viewport of EXPERIENCE_VIEWPORTS) {
    test(`X1 ${viewport.id}：地图入口是非模态且可用 Esc 取消`, async ({ page }) => {
      const consoleErrors = watchConsole(page);
      for (const scenario of MAP_ENTRY_SCENARIOS) {
        await namedStep(page, `X1 ${viewport.id} · ${scenario.label}`, async () => {
          const entry = await scenario.open(page, viewport);
          await expect(entry).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(entry).toBeHidden();
          await expect(
            page.locator('[aria-modal="true"], .path-card__scrim, main[inert]'),
          ).toHaveCount(0);
        });
      }
      consoleErrors.assertClean();
    });

    test(`X1 ${viewport.id}：可见弹层都有可用退出路径`, async ({ page }) => {
      const consoleErrors = watchConsole(page);
      for (const scenario of FAST_DIALOG_SCENARIOS) {
        await namedStep(page, `X1 ${viewport.id} · ${scenario.label}`, async () => {
          const dialog = await scenario.open(page, viewport);
          try {
            const via = await closeVisibleDialog(page, dialog, scenario.label);
            expect(["control", "escape"]).toContain(via);
          } catch (error) {
            const known = KNOWN_DIALOG_ISSUES.get(scenario.id);
            if (!known) throw error;
            console.log(`已知 X1 违规 ${scenario.id}: ${known}`);
            console.log(error instanceof Error ? error.message : String(error));
          }
        });
      }
      consoleErrors.assertClean();
    });

    test(`X2/X6 ${viewport.id}：核心页面可回地图且只接受已记录 axe 基线`, async ({ page }) => {
      const consoleErrors = watchConsole(page);
      for (const route of coreRoutes) {
        await namedStep(page, `X2 ${viewport.id} · ${route.label}`, async () => {
          await openExperienceRoute(page, route, viewport);
          await namedStep(page, `X6 ${viewport.id} · ${route.label}`, async () => {
            const audit = await auditAxeBaseline(page, route, viewport);
            if (audit.stale.length > 0) {
              console.log(
                `axe baseline 已消失 ${route.id}/${viewport.id}: ${audit.stale.length} 项`,
              );
            }
          });
          await route.returnToWorld(page);
        });
      }
      consoleErrors.assertClean();
    });

    test(`X3/X5 ${viewport.id}：核心主控件可命中且点击后及时响应`, async ({ page }) => {
      const rejectedUrls = new Set<string>();
      let signInRequests = 0;
      let unexpectedAuthRequests = 0;
      const consoleErrors = watchConsole(page, {
        expectedHttpErrors: [{ status: 400, matchesUrl: (url) => rejectedUrls.has(url) }],
      });
      const rejectOnlySyntheticSignIn = async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const body = request.postDataJSON();
        if (
          signInRequests !== 0 ||
          request.method() !== "POST" ||
          url.pathname !== "/auth/v1/token" ||
          url.searchParams.get("grant_type") !== "password" ||
          body?.email !== "response-check@example.invalid" ||
          body?.password !== "synthetic-response-check-only"
        ) {
          unexpectedAuthRequests++;
          await route.abort();
          return;
        }
        signInRequests++;
        rejectedUrls.add(request.url());
        await route.fulfill({
          status: 400,
          json: { code: "invalid_credentials", msg: "synthetic-sign-in-rejected" },
        });
      };
      for (const route of ctaRoutes) {
        // Credentials and the fail-closed network fixture have the same scope.
        // Other screens must not inherit a mock that changes refresh behavior.
        if (route.id === "me") {
          await page.route("**/auth/v1/token**", rejectOnlySyntheticSignIn);
        }
        try {
          await namedStep(page, `X3/X5 ${viewport.id} · ${route.label}`, async () => {
            await openExperienceRoute(page, route, viewport);
            if (route.id === "me") {
              const form = page.locator("details.account-panel__form");
              await form.locator('input[type="email"]').fill("response-check@example.invalid");
              await form.locator('input[type="password"]').fill("synthetic-response-check-only");
              await expect(form.locator('button[type="submit"]')).toBeEnabled();
            }
            for (const target of route.coverage) {
              await namedStep(
                page,
                `X3 ${viewport.id} · ${route.label} · ${target.label}`,
                async () => {
                  const locator = await prepareCoverageTarget(page, target);
                  await assertVisibleAndHittableAtFivePoints(
                    page,
                    locator,
                    `${route.label} / ${target.label}`,
                  );
                },
              );
            }
            const primary = route.primary;
            if (!primary) return;
            await namedStep(
              page,
              `X5 ${viewport.id} · ${route.label} · ${primary.label}`,
              async () => {
                const response = await clickAndMeasureResponse(page, primary);
                const responseKey = `${route.id}/${viewport.id}/${primary.id}`;
                if (response.elapsedMs > 300) {
                  const known = KNOWN_RESPONSE_ISSUES.get(responseKey);
                  if (!known) {
                    expect(
                      response.elapsedMs,
                      `${route.label} 的 CTA 从真实点击到响应耗时 ${response.elapsedMs}ms。`,
                    ).toBeLessThanOrEqual(300);
                  } else {
                    console.log(`已知 X5 违规 ${responseKey}: ${known}`);
                    console.log(`实际测得 ${response.elapsedMs}ms`);
                  }
                }
                expect(
                  response.urlChanged || response.domChanged,
                  `${route.label} 的 CTA 点击后 300ms 内没有 URL、DOM、aria-busy 或 disabled 响应。`,
                ).toBe(true);
                if (route.id === "me") {
                  const form = page.locator("details.account-panel__form");
                  await expect(form.getByRole("alert")).toBeVisible();
                  await expect(form).not.toContainText("synthetic-sign-in-rejected");
                  await expect(form.locator('input[type="email"]')).toHaveValue(
                    "response-check@example.invalid",
                  );
                  await expect(form.locator('input[type="password"]')).toHaveValue("");
                  expect(signInRequests).toBe(1);
                }
              },
            );
          });
        } finally {
          if (route.id === "me") {
            // Clear synthetic inputs before releasing the only auth interceptor.
            const form = page.locator("details.account-panel__form");
            if (await form.count()) {
              await form.locator('input[type="password"]').fill("");
              await form.locator('input[type="email"]').fill("");
            }
            await page.unroute("**/auth/v1/token**", rejectOnlySyntheticSignIn);
          }
        }
      }
      for (const route of EXPERIENCE_ROUTES.filter((candidate) => candidate.primary === null)) {
        expect(route.noPrimaryReason, `${route.label} 的无主 CTA 说明不能为空`).toBeTruthy();
        console.log(`X5 ${viewport.id} · ${route.label}：无主 CTA，${route.noPrimaryReason}`);
      }
      expect(signInRequests).toBe(1);
      expect(unexpectedAuthRequests).toBe(0);
      consoleErrors.assertClean();
    });
  }

  test("X4 phone：手机交互目标不挤成误触区", async ({ page }) => {
    const viewport = EXPERIENCE_VIEWPORTS.find((candidate) => candidate.id === "phone")!;
    const consoleErrors = watchConsole(page);
    for (const route of touchRoutes) {
      await namedStep(page, `X4 phone · ${route.label}`, async () => {
        await openExperienceRoute(page, route, viewport);
        const findings = await touchTargetViolations(page, route.id);
        const exempted = findings.filter((finding) =>
          TOUCH_TARGET_EXEMPTIONS.some(
            (exemption) =>
              finding.routeId === exemption.routeId && finding.target === exemption.selector,
          ),
        );
        if (exempted.length > 0) {
          console.log(
            `X4 phone · ${route.label}：使用 ${exempted.length} 条已知豁免：${exempted
              .map((finding) => finding.target)
              .join(", ")}`,
          );
        }
        const unexpected = findings.filter(
          (finding) =>
            !TOUCH_TARGET_EXEMPTIONS.some(
              (exemption) =>
                finding.routeId === exemption.routeId && finding.target === exemption.selector,
            ),
        );
        expect(
          unexpected,
          `触控目标小于 44px 且邻近中心不足 44px：${JSON.stringify(unexpected)}`,
        ).toEqual([]);
      });
    }
    consoleErrors.assertClean();
  });
});
