import type { ComponentProps, ReactNode } from "react";
import { GameButton, GameModal } from "@pieai/swimmer-ui-kit";
import {
  leagueStanding,
  questsForToday,
  restTicketBalance,
  studyWeek,
  todayGoalProgress,
  toPath,
  type ProgressDocument,
} from "@pieai/university-core";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { AvatarPanel } from "@pieai/university-ui/navigation/AvatarPanel.js";
import { leagueTierName } from "@pieai/university-ui/navigation/league-tier-name.js";
import { LevelProgress } from "@pieai/university-ui/navigation/screens.js";
import { EmblemImage } from "@pieai/university-world";
import { RailIdentity } from "@pieai/university-world/avatar.js";

interface LearnerAvatarPanelProps {
  readonly progress: ProgressDocument;
  readonly avatarRecipe: ComponentProps<typeof RailIdentity>["recipe"];
  readonly signedIn: boolean;
  /** On a phone rail the avatar opens this panel in a dialog instead of going to the account. */
  readonly opensDialog: boolean;
  readonly onOpenDialog: () => void;
  readonly onOpenAccount: () => void;
  readonly onOpenHouse: () => void;
}

/**
 * The learner's avatar and their day at a glance. One projection feeds the
 * rail, the phone dialog and Me: no competing daily counter.
 */
export function LearnerAvatarPanel({
  progress,
  avatarRecipe,
  signedIn,
  opensDialog,
  onOpenDialog,
  onOpenAccount,
  onOpenHouse,
}: LearnerAvatarPanelProps) {
  const interfaceTranslator = useI18n();
  const now = Date.now();
  const standing = leagueStanding(progress, now);
  const lessonQuest = questsForToday(progress, now).find((quest) => quest.id === "lesson");
  return (
    <AvatarPanel
      onOpenWardrobe={onOpenHouse}
      avatar={
        <RailIdentity
          recipe={avatarRecipe}
          signedIn={signedIn}
          label={opensDialog ? interfaceTranslator.t("journey.avatar.open") : undefined}
          onOpen={opensDialog ? onOpenDialog : onOpenAccount}
        />
      }
      todayProgress={todayGoalProgress(progress, now)}
      streakDays={progress.streak.days}
      rank={{
        name: leagueTierName(standing.tier),
        emblem: <EmblemImage kind="rank" id={standing.tier.id} size={56} />,
      }}
      level={<LevelProgress totalXp={progress.totalXp} rail />}
      week={studyWeek(progress, now)}
      today={{ done: lessonQuest?.done ?? 0, goal: lessonQuest?.goal ?? 1 }}
      rest={{
        balance: restTicketBalance(progress.streak),
        covered: progress.streak.rest?.covered.length ?? 0,
      }}
      membership={{ href: toPath({ kind: "plans" }) }}
    />
  );
}

/** The phone's avatar dialog: the same panel, and the way on to the account. */
export function LearnerAvatarDialog({
  onClose,
  onOpenAccount,
  children,
}: {
  readonly onClose: () => void;
  readonly onOpenAccount: () => void;
  readonly children: ReactNode;
}) {
  const interfaceTranslator = useI18n();
  return (
    <GameModal
      open
      className="journey-avatar-modal"
      size="sm"
      title={interfaceTranslator.t("journey.avatar.title")}
      closeLabel={interfaceTranslator.t("journey.avatar.close")}
      onClose={onClose}
      footer={
        <GameButton variant="secondary" static onClick={onOpenAccount}>
          {interfaceTranslator.t("product.account.open")}
        </GameButton>
      }
    >
      {children}
    </GameModal>
  );
}
