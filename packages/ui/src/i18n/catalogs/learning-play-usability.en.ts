import type { messages as sourceMessages } from "./learning-play-usability.zh-CN.js";
export const messages = {
  "play.usability.hunt.change": "Try a different input",
  "play.usability.goal": "Goal and background",
  "play.sort.guidePickItem": "Pick something, then pick where it belongs.",
  "play.sort.guidePickBucket": "Now pick the bucket it belongs in.",
  "play.sort.missGeneric": "That bucket does not hold this one. Think again about what it is.",
  "play.sort.misses": "{{value0}} misplaced so far. A miss costs nothing — take your time.",
  "play.usability.explore": "Explore freely",
  "play.usability.guide": "Follow the prompts",
  "play.usability.brief.start": "One request. What will these two products do?",
  "play.usability.brief.first": "Try signing up once. No settings to fill in first.",
  "play.usability.brief.difference": "Look: the two products made different decisions.",
  "play.usability.brief.ask": "Ask the organizer",
  "play.usability.brief.question": "Clarify one thing · {{current}} / {{total}}",
  "play.usability.brief.choose": "Add the agreement you just heard. It changes the actual product.",
  "play.usability.brief.next": "Ask about the next thing",
  "play.usability.brief.test": "The agreement is ready. Try the product yourself.",
  "play.usability.brief.testNote":
    "Try signing up, then check the roster. Accept the result here when ready.",
  "play.usability.brief.review": "Review or change the agreement",
  "play.usability.brief.try": "Try the product",
  "play.usability.brief.change": "The client changed their mind. Update only what needs to change.",
  "play.usability.brief.changed": "Then try it again with the new rules.",
  "play.usability.connect.first": "Start with “{{name}}”, then select what it leads to.",
  "play.usability.connect.next":
    "{{count}} connections so far. Add another or send a signal to try them.",
  "play.usability.tune.first": "Move “{{name}}” and see what changes.",
  "play.usability.tune.changed":
    "Check which requirements still need work, then adjust another control.",
  "play.usability.tune.note": "Try whenever you like. You can keep adjusting after a miss.",
  "play.usability.hunt.first": "Try one ordinary value and see what happens.",
  "play.usability.hunt.next": "Try a different value. Can the promise and result disagree?",
  "play.usability.hunt.try": "Try this value",
  "play.usability.dispatch.first":
    "Your first request is here. Choose an entry below to handle it.",
  "play.usability.dispatch.next": "A new request. Check whether a saved copy can help.",
  "play.usability.dispatch.options": "Try a timed challenge",
  "play.usability.program.first": "Add one forward move, then see where it goes.",
  "play.usability.program.add": "Add a forward move",
  "play.usability.program.run": "Run these instructions",
  "play.usability.program.ready": "Your instructions are ready. Run them to see what happens.",
  "play.usability.program.edit": "See where it stopped? Change your instructions and try again.",
  "play.usability.program.editAction": "Edit the instructions",
  "play.contrast.guidePredict":
    "Guess first: will these two give the same result this time? Then you get to see what each one did.",
  "play.contrast.predictSame": "Same",
  "play.contrast.predictApart": "Different",
  "play.contrast.landedSame": "Both landed the same \u2014 open it again",
  "play.contrast.landedApart": "They came apart \u2014 open it again",
  "play.contrast.notWhatYouSaid": "Not what you guessed.",
  "play.contrast.summary":
    "Give the same thing to \u201c{{value0}}\u201d and \u201c{{value1}}\u201d and sometimes they land together, sometimes they do not.",
  "play.contrast.misses":
    "{{value0}} wrong so far. A wrong guess costs nothing \u2014 it is the one that teaches you something.",
  "play.weigh.guideDecide":
    "For this situation, which one? The same choice will not be right every time.",
  "play.weigh.progress": "Situation {{value0}} of {{value1}}",
  "play.weigh.notHere":
    "Not this one, not here. Try again: what are you actually short of in this situation?",
  "play.weigh.costOfOther": "Picking \u201c{{value0}}\u201d would have cost: {{value1}}",
  "play.weigh.flipHeading": "Look back \u2014 same two choices, and the answer changed sides:",
  "play.weigh.misses":
    "{{value0}} wrong so far. A wrong pick costs nothing; knowing why is the point.",
} as const satisfies Record<keyof typeof sourceMessages, string>;
