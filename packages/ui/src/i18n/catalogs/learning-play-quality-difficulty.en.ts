import type { messages as source } from "./learning-play-quality-difficulty.zh-CN.js";

export const messages = {
  "play.qualityDifficulty.eval.requirements": "This round: {{count}} request categories{{cross}}",
  "play.qualityDifficulty.eval.crossCount": " and {{count}} combined conditions",
  "play.qualityDifficulty.eval.coverage": "{{count}} / {{total}} categories covered",
  "play.qualityDifficulty.eval.requirementDone": "Frozen",
  "play.qualityDifficulty.eval.requirementPending": "Needs a case",
  "play.qualityDifficulty.eval.crossHeading":
    "Create and rerun separate cases for these combinations",
  "play.qualityDifficulty.eval.crossNext":
    "Next, combine these conditions: {{input}}. Decide for yourself which issue comes first.",
  "play.qualityDifficulty.eval.input-coverage":
    "Valid cases are still missing for: {{missing}}. Set the conditions, choose an expectation, freeze them, then rerun the complete set.",
  "play.qualityDifficulty.eval.invalid-requirements":
    "This round's requirements are incomplete or contradictory. Choose the task again or report this activity.",
  "play.qualityDifficulty.eval.moreTrials":
    "The required cases are ready. You still need to observe a boundary failure.",
  "play.qualityDifficulty.eval.release":
    "The required cases are ready. Choose any needed limits and actually rerun the whole set.",
  "play.qualityDifficulty.eval.releaseNote":
    "Complete this round's requirement list, then run every frozen case with the current release limits. Normal requests must remain useful.",
  "play.qualityDifficulty.eval.intro.brief":
    "Try a normal request, then repeatedly test one boundary condition to see whether the assistant delivers what it promises.",
  "play.qualityDifficulty.eval.intro.goal":
    "Collect a normal case and a “{{boundary}}” case, observe a blind spot, then pass the full release test.",
  "play.qualityDifficulty.eval.intro.hint":
    "The starter still has three responses. Try them one by one, then add a normal request with every condition met.",
  "play.qualityDifficulty.eval.challenge.brief":
    "Handling separate problems does not prove that combined problems are handled correctly. Test conditions together.",
  "play.qualityDifficulty.eval.challenge.goal":
    "Freeze four request categories plus “missing information and unavailable resources” and “missing information and out of scope”. Observe a blind spot, then pass the entire regression set.",
  "play.qualityDifficulty.eval.challenge.hint":
    "Each combination needs its own case. Use the public agreement to judge priority; isolated tests do not count as evidence for combined conditions.",
  "play.qualityDifficulty.eval.challenge.contract":
    "{{contract}} When several conditions apply, check business scope first, missing information next, then slot or stock availability. Handle the earliest applicable issue first.",
  "play.qualityDifficulty.repair.intro.brief":
    "Reproduce the issue yourself, choose between two proposals, then check the original issue and an existing feature.",
  "play.qualityDifficulty.repair.intro.goal":
    "Compare two proposals, fix the sealed issue, then personally verify: {{regression}}",
  "play.qualityDifficulty.repair.intro.hint":
    "Judge both proposals by their actual results. Disabling the button also prevents useful tasks.",
  "play.qualityDifficulty.repair.preserve": "This round must also preserve: {{regression}}",
  "play.qualityDifficulty.repair.booking.third": "Sunday morning",
  "play.qualityDifficulty.repair.booking.challenge.brief":
    "While fixing duplicate bookings, remember that another slot is already booked. Changing one booking must preserve the other.",
  "play.qualityDifficulty.repair.booking.challenge.productBrief":
    "Different class slots may be booked at the same time. Cancelling the selected slot should keep the other bookings.",
  "play.qualityDifficulty.repair.booking.challenge.goal":
    "Fix duplicate submissions, then keep {{keep}}, cancel {{second}} and book {{third}}. Finish with exactly the {{keep}} and {{third}} bookings.",
  "play.qualityDifficulty.repair.booking.challenge.regression":
    "Keep {{keep}} throughout. Also book {{second}}, cancel only {{second}}, then book {{third}}. Finish with just {{keep}} and {{third}}.",
  "play.qualityDifficulty.repair.booking.challenge.step1":
    "Book {{keep}}, then select and book {{second}}. Check that both exist.",
  "play.qualityDifficulty.repair.booking.challenge.step2":
    "Keep {{second}} selected and cancel it. {{keep}} must remain.",
  "play.qualityDifficulty.repair.booking.challenge.step3":
    "Select and book {{third}}. Check that only {{keep}} and {{third}} remain.",
  "play.qualityDifficulty.repair.booking.challenge.hint":
    "Deleting and re-creating the protected booking does not preserve it. Check that it stays throughout the whole trace.",
  "play.qualityDifficulty.repair.preference.third": "High-protein lunch",
  "play.qualityDifficulty.repair.preference.challenge.brief":
    "One successful save is not enough. Change to two different lunches and reopen after each save to see whether each one persists.",
  "play.qualityDifficulty.repair.preference.challenge.productBrief":
    "The default lunch can change repeatedly. Reopening after each save should display the choice just saved.",
  "play.qualityDifficulty.repair.preference.challenge.goal":
    "Fix lost saves, then choose {{second}}, save and reopen. Next choose {{third}}, save and reopen. Both reads must be correct.",
  "play.qualityDifficulty.repair.preference.challenge.regression":
    "Choose {{second}}, save and reopen to check it. Then choose {{third}}, save and reopen to check again. Perform both reopens yourself.",
  "play.qualityDifficulty.repair.preference.challenge.step1":
    "Choose {{second}}, save, then reopen and check that {{second}} appears.",
  "play.qualityDifficulty.repair.preference.challenge.step2":
    "Change to {{third}}, save, then reopen again and check that {{third}} appears.",
  "play.qualityDifficulty.repair.preference.challenge.step3":
    "Check both reopen records. A correct final read does not prove that the earlier save worked.",
  "play.qualityDifficulty.repair.preference.challenge.hint":
    "Reopen immediately after each changed selection is saved. Saving three choices and reopening only at the end is still insufficient evidence.",
  "play.qualityDifficulty.repair.keepFirst":
    "Book “{{choice}}” first. This booking must remain throughout the following actions.",
  "play.qualityDifficulty.repair.addSecond":
    "Keep the original booking, then select and book “{{choice}}”.",
  "play.qualityDifficulty.repair.cancelOnly":
    "Cancel only “{{choice}}” and check that the other booking remains.",
  "play.qualityDifficulty.repair.addReplacement":
    "Now book “{{choice}}”. Two different bookings should remain.",
  "play.qualityDifficulty.repair.keepLost":
    "The protected booking was lost. Re-creating it cannot undo that loss. Reset the product and check again.",
  "play.qualityDifficulty.repair.changeAndRead":
    "Choose and save “{{choice}}”. This change also needs a reopen check.",
  "play.qualityDifficulty.repair.readChange":
    "“{{choice}}” is saved. Reopen now and observe this particular save.",
} satisfies Record<keyof typeof source, string>;
