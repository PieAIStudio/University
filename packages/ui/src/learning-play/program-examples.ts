import type { ProgramActivity } from "@pieai/university-core";

import { translate } from "../i18n/index.js";

/** Localized experiment payloads; these do not produce or publish lessons. */
export function getProgramExamples(): readonly ProgramActivity[] {
  const source = {
    label: translate("play.program.source"),
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration",
  };
  return [
    {
      kind: "program",
      id: "program-delivery",
      title: translate("play.program.delivery.title"),
      brief: translate("play.program.delivery.brief"),
      goal: translate("play.program.delivery.goal"),
      takeaway: translate("play.program.delivery.takeaway"),
      hint: translate("play.program.delivery.hint"),
      source,
      width: 5,
      height: 5,
      start: { x: 0, y: 4, direction: "north" },
      goalCell: { x: 4, y: 0 },
      walls: [
        { x: 1, y: 3 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      checkpoints: [
        { x: 0, y: 2 },
        { x: 3, y: 2 },
      ],
      maxCommands: 5,
      maxRepeat: 4,
    },
    {
      kind: "program",
      id: "program-irrigation",
      title: translate("play.program.irrigation.title"),
      brief: translate("play.program.irrigation.brief"),
      goal: translate("play.program.irrigation.goal"),
      takeaway: translate("play.program.irrigation.takeaway"),
      hint: translate("play.program.irrigation.hint"),
      source,
      width: 6,
      height: 5,
      start: { x: 0, y: 4, direction: "east" },
      goalCell: { x: 5, y: 0 },
      walls: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 3 },
      ],
      checkpoints: [
        { x: 2, y: 4 },
        { x: 2, y: 1 },
        { x: 5, y: 1 },
      ],
      maxCommands: 7,
      maxRepeat: 4,
    },
  ];
}
