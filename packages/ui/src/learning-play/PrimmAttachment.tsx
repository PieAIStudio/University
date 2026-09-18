import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "../i18n/index.js";
import { PrimmMaterials } from "./PrimmMaterials.js";
import type { PrimmLessonProps } from "./primm-types.js";

/** Moving a prepared attachment changes readiness, never the canonical input. */
export function PrimmAttachment({
  activity,
  assets,
  attached,
  disabled,
  onAttach,
}: Pick<PrimmLessonProps, "activity" | "assets"> & {
  readonly attached: boolean;
  readonly disabled: boolean;
  readonly onAttach: (attached: boolean) => void;
}) {
  const { t } = useI18n();
  const material = (
    <PrimmMaterials
      activity={activity}
      assets={assets}
      materialIds={activity.starter.materialIds}
      assetIds={activity.starter.assetIds}
    />
  );
  return (
    <div className="primm-attachment" data-primm-operation="attach-and-send">
      {!attached ? (
        <section
          className="primm-attachment__tray"
          draggable={!disabled}
          onDragStart={(event) =>
            event.dataTransfer.setData("application/x-university-material", activity.id)
          }
        >
          {material}
          <GameButton disabled={disabled} onClick={() => onAttach(true)}>
            {activity.run.attachmentLabel}
          </GameButton>
        </section>
      ) : null}
      <section
        className="primm-attachment__conversation"
        aria-label={t("primm.conversation")}
        onDragOver={(event) => {
          if (!disabled) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (
            !disabled &&
            event.dataTransfer.getData("application/x-university-material") === activity.id
          )
            onAttach(true);
        }}
      >
        <h3>{t("primm.conversation")}</h3>
        {attached ? (
          <>
            {material}
            <GameButton disabled={disabled} onClick={() => onAttach(false)}>
              {t("primm.detach")}
            </GameButton>
          </>
        ) : (
          <p className="primm-attachment__empty">{t("primm.attachmentTarget")}</p>
        )}
        <p className="primm__credit">{t("primm.prompt")}</p>
        <pre className="primm__text">{activity.starter.prompt}</pre>
      </section>
    </div>
  );
}
