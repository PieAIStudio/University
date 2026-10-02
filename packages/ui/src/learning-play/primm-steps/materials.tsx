import { useI18n } from "../../i18n/index.js";
import { PrimmSource } from "../PrimmMaterials.js";
import type { PrimmStepsActivity } from "../primm-types.js";

/** A text material: read where it is open, a reminder where it is folded. */
export function PrimmNote({
  material,
  source,
  open,
}: {
  readonly material: PrimmStepsActivity["materials"][number];
  readonly source: PrimmStepsActivity["sources"][number] | undefined;
  readonly open: boolean;
}) {
  return (
    <details className="primm-steps__material" open={open} data-material-id={material.id}>
      <summary>{material.label}</summary>
      <p className="primm__text">{material.text}</p>
      <PrimmSource source={source} />
    </details>
  );
}

/** A 你知道吗 line: something true from outside the lesson, with its source. */
export function PrimmAside({
  text,
  source,
}: {
  readonly text: string;
  readonly source: PrimmStepsActivity["sources"][number] | undefined;
}) {
  const { t } = useI18n();
  return (
    <aside className="primm-steps__aside">
      <b>{t("primm.steps.didYouKnow")}</b>
      <p>{text}</p>
      <PrimmSource source={source} />
    </aside>
  );
}
