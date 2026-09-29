import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { createNerveOpening, type NerveOpeningController } from "@pieai/swimmer-nerve-kit/opening";
import { createGuidanceWalk, type GuidanceController } from "@pieai/swimmer-nerve-kit/guidance";
import type { TargetRegistry } from "@pieai/swimmer-nerve-kit/targets";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { WelcomeCards, WelcomeQuestions } from "@pieai/university-ui/onboarding/WelcomeCards.js";
import { nerveLanguage } from "../nerve-language.js";
import { markerTargetId } from "./map-guide.js";
import type { FirstStoneInvitation, WelcomeInvitation } from "./first-meeting.js";

const noSubscription = () => () => {};
const noGuide = () => null;

/** Effect-owned: StrictMode must never reuse a controller its rehearsal disposed. */
export function useGuideOpening(scope: string) {
  const [owned, setOwned] = useState<{
    scope: string;
    controller: NerveOpeningController<ReactNode>;
  } | null>(null);
  useEffect(() => {
    const controller = createNerveOpening<ReactNode>({ scope: { id: scope } });
    setOwned({ scope, controller });
    return () => controller.dispose();
  }, [scope]);
  return owned?.scope === scope ? owned.controller : null;
}

/** The product chooses eligible pages; the kit owns presentation, courtesy and dismissal. */
export function useFirstMeeting({
  scope,
  ready,
  targets,
  invitation,
  firstStone,
  afterLayout,
  controller,
}: {
  readonly scope: string;
  readonly ready: boolean;
  readonly targets: TargetRegistry;
  readonly invitation: WelcomeInvitation | null;
  readonly firstStone: FirstStoneInvitation | null;
  readonly afterLayout: (run: () => void) => () => void;
  readonly controller: NerveOpeningController<ReactNode> | null;
}) {
  const t = useI18n();
  const latest = useRef({ scope, invitation, firstStone, t });
  latest.current = { scope, invitation, firstStone, t };
  const [ownedWalk, setOwnedWalk] = useState<{
    scope: string;
    id: string;
    controller: GuidanceController;
  } | null>(null);
  const [unavailableFor, setUnavailableFor] = useState<{ scope: string; id: string } | null>(null);
  const walk =
    ownedWalk?.scope === scope && ownedWalk.id === firstStone?.id ? ownedWalk.controller : null;
  const unavailable = unavailableFor?.scope === scope && unavailableFor.id === firstStone?.id;
  const [retry, setRetry] = useState(0);
  const guide = useSyncExternalStore(
    walk?.subscribe ?? noSubscription,
    walk?.getSnapshot ?? noGuide,
    walk?.getSnapshot ?? noGuide,
  );

  useEffect(() => {
    if (!controller || !ready || !invitation) return;
    let seen = false;
    let acted = false;
    const currentInvitation = () =>
      latest.current.scope === scope ? latest.current.invitation : null;
    const leave = (action: (value: WelcomeInvitation) => void) => {
      const value = currentInvitation();
      const page = controller.getSnapshot().current;
      if (!value || page?.topic !== "welcome") return;
      acted = true;
      if (controller.dismiss(page.key)) action(value);
    };
    const choose = (id: string, assessment = false) =>
      leave((value) => {
        const destination = value.choices.find((choice) => choice.id === id);
        if (destination) value.onChoose(destination, assessment);
      });
    const showPaths = (assessment = false) => {
      const value = currentInvitation();
      if (!value) return null;
      return (
        <WelcomeCards
          choices={value.choices}
          assessment={assessment}
          onChoose={(id) => choose(id, assessment)}
          onHelp={() => update("help")}
          onAssess={() => update("assessment")}
          onBrowse={() => leave((entry) => entry.onBrowse())}
          onSignIn={() => leave((entry) => entry.onSignIn())}
        />
      );
    };
    const update = (kind: "paths" | "help" | "assessment") => {
      const current = controller.getSnapshot().current;
      const value = currentInvitation();
      if (!current || current.topic !== "welcome" || !value) return;
      controller.update(current.key, {
        message: latest.current.t.t(
          kind === "help"
            ? "product.welcome.help.message"
            : kind === "assessment"
              ? "product.welcome.assess.choose"
              : "product.welcome.greeting",
        ),
        card:
          kind === "help" ? (
            <WelcomeQuestions
              choices={value.choices}
              onChoose={choose}
              onBack={() => update("paths")}
            />
          ) : (
            showPaths(kind === "assessment")
          ),
      });
    };
    const off = controller.subscribe(() => {
      const current = controller.getSnapshot().current;
      if (current?.topic === "welcome") seen = true;
      else if (seen && !acted) {
        acted = true;
        currentInvitation()?.onDismiss();
      }
    });
    controller.offer({
      topic: "welcome",
      priority: 5,
      message: latest.current.t.t("product.welcome.greeting"),
      card: showPaths() ?? undefined,
    });
    return off;
    // Source cards are supplied only once the real shelf is ready. Later identity/route changes have a new scope.
  }, [controller, ready, scope, invitation !== null]);

  useEffect(() => {
    if (!firstStone || !firstStone.ready || !ready) {
      setOwnedWalk(null);
      setUnavailableFor(null);
      return;
    }
    const expected = firstStone.id;
    let cancelled = false;
    // The previous opening has left the DOM. Use the map's existing post-layout rendezvous, not a guessed delay.
    const cancelLayout = afterLayout(() => {
      if (
        cancelled ||
        latest.current.scope !== scope ||
        latest.current.firstStone?.id !== expected ||
        !latest.current.firstStone.ready
      )
        return;
      const targetId = markerTargetId(firstStone.lessonId);
      if (!targets.capture(targetId)) {
        setUnavailableFor({ scope, id: expected });
        return;
      }
      const next = createGuidanceWalk(
        targets,
        {
          steps: [{ targetId, explanation: latest.current.t.t("product.welcome.firstStone") }],
        },
        `first-stone:${expected}`.slice(0, 180),
        {
          scope: { id: scope },
          language: () => nerveLanguage(latest.current.t.locale),
        },
      );
      setUnavailableFor(null);
      setOwnedWalk({ scope, id: expected, controller: next });
    });
    return () => {
      // A late callback from a lost scene cannot supply the next attempt's
      // target, even when it belongs to the same learner and lesson.
      cancelled = true;
      cancelLayout();
    };
  }, [scope, ready, firstStone?.id, firstStone?.ready, targets, afterLayout, retry]);
  useEffect(() => () => ownedWalk?.controller.dispose(), [ownedWalk]);

  const valid = firstStone?.ready === true && (guide !== null || unavailable);
  const dismissGuide = () => {
    walk?.close();
    setOwnedWalk(null);
    setUnavailableFor(null);
    if (latest.current.scope === scope) latest.current.firstStone?.onDismiss();
  };
  const offscreen = unavailable || guide?.status === "unavailable";
  return {
    target: valid ? (guide?.target ?? null) : null,
    message: valid
      ? t.t(offscreen ? "product.welcome.targetUnavailable" : "product.welcome.firstStone")
      : null,
    activity: valid ? (
      <div
        className="map-guide__go"
        data-welcome-page="3"
        data-first-stone-state={offscreen ? "unavailable" : "showing"}
      >
        <GameButton
          variant="primary"
          static
          data-welcome-enter
          onClick={() => {
            const value = latest.current.scope === scope ? latest.current.firstStone : null;
            if (!value || value.id !== firstStone?.id) return;
            dismissGuide();
            value.onEnter();
          }}
        >
          {t.t("product.welcome.enter")}
        </GameButton>
        {offscreen ? (
          <GameButton variant="secondary" static onClick={() => setRetry((n) => n + 1)}>
            {t.t("product.welcome.retryTarget")}
          </GameButton>
        ) : null}
      </div>
    ) : null,
    dismissGuide,
  };
}
