import type { messages as source } from "./learning-play-quality-usability.zh-CN.js";

export const messages = {
  "play.qualityGuide.eval.start": "Try this request and see how the assistant responds.",
  "play.qualityGuide.eval.starter": "A ready-to-try request",
  "play.qualityGuide.eval.startAction": "Try the starter request",
  "play.qualityGuide.eval.starterNote":
    "The conditions and expectation are explicit. Only clicking records an actual trial.",
  "play.qualityGuide.eval.candidate": "Trying {{candidate}} · Change candidate",
  "play.qualityGuide.eval.repeat": "Try the same request again. Does the answer stay the same?",
  "play.qualityGuide.eval.tryCandidate":
    "This candidate has not answered the current request. Try it once.",
  "play.qualityGuide.eval.discovered":
    "The same conditions produced different results. Now make your own request.",
  "play.qualityGuide.eval.ownQuestion": "Make my own request",
  "play.qualityGuide.eval.compose":
    "Confirm or adjust the conditions, then choose what you think the product should do.",
  "play.qualityGuide.eval.next.fulfilled":
    "Next: can a normal request succeed when every condition is met?",
  "play.qualityGuide.eval.next.clarify":
    "Next: what should the assistant do when key information is missing?",
  "play.qualityGuide.eval.next.unavailable":
    "Next: what should happen when a slot or item is unavailable?",
  "play.qualityGuide.eval.next.out-of-scope":
    "Next: what if a customer asks for something beyond the service?",
  "play.qualityGuide.eval.coverage": "{{count}} / 4 request categories covered",
  "play.qualityGuide.eval.moreTrials":
    "You have all four categories. Observe a boundary failure before deciding how to release.",
  "play.qualityGuide.eval.release":
    "All four categories are ready. Choose any needed limits, then test the whole set.",
  "play.qualityGuide.eval.openRelease": "Open release checks",
  "play.qualityGuide.eval.releaseClosed": "Before release: limits and full test set",
  "play.qualityGuide.eval.contract": "Read the product agreement",
  "play.qualityGuide.repair.productTab": "Product and replay",
  "play.qualityGuide.repair.patchTab": "Choose a change",
  "play.qualityGuide.repair.historyTab": "Records and restore",
  "play.qualityGuide.repair.navigation": "Repair workspace",
  "play.qualityGuide.repair.book": "Click “{{submit}}” once and count the booking records.",
  "play.qualityGuide.repair.bookAgain":
    "Keep the same time slot. Book once more and see whether another record appears.",
  "play.qualityGuide.repair.choose": "First choose “{{choice}}”.",
  "play.qualityGuide.repair.save": "Now click “{{submit}}” to save your selection.",
  "play.qualityGuide.repair.reopen":
    "The page says it saved. Reopen the page to check whether your choice survived.",
  "play.qualityGuide.repair.capture":
    "The actual result differs from the agreement. Seal these actions before trying a repair.",
  "play.qualityGuide.repair.choosePatch":
    "Each proposal claims to fix the issue. Choose one and read its scope before applying it.",
  "play.qualityGuide.repair.replay":
    "Let both versions take the same actions, and compare each result.",
  "play.qualityGuide.repair.replayNext": "Next action: {{action}}",
  "play.qualityGuide.repair.checkReplay":
    "Both versions have taken the same actions. Check whether the original issue is fixed.",
  "play.qualityGuide.repair.oldNext":
    "The original issue passed. Now personally try a feature that already worked.",
  "play.qualityGuide.repair.cancel":
    "You booked once. Cancel it now to see whether you can change the slot.",
  "play.qualityGuide.repair.changeChoice":
    "Choose “{{choice}}” to check whether users can still change their minds.",
  "play.qualityGuide.repair.bookChanged":
    "Book the new slot and check that only its booking remains.",
  "play.qualityGuide.repair.reloadLatest":
    "After saving again, reopen and check that the latest choice remains.",
  "play.qualityGuide.repair.checkOld":
    "The old feature has been tried. Check the actual results of both versions.",
  "play.qualityGuide.repair.blocked":
    "This change blocked an old feature. Keep the evidence and compare another proposal.",
  "play.qualityGuide.repair.tryAnother": "Try another change",
  "play.qualityGuide.repair.finish":
    "The original issue and old feature both passed. Accept the repair and take its record.",
  "play.qualityGuide.repair.tools": "Review, find differences and branch",
  "play.qualityGuide.repair.manual":
    "Your clicks now reach both versions and leave records of your own actions.",
  "play.qualityGuide.repair.restoreCue":
    "This restored state is playable. Continue operating it or compare the sealed issue again.",
  "play.qualityGuide.repair.failureReport": "Original issue and reproduction clues",
} satisfies Record<keyof typeof source, string>;
