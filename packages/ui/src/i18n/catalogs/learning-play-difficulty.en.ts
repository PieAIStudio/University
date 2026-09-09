import type { messages as sourceMessages } from "./learning-play-difficulty.zh-CN.js";
export const messages = {
  "play.difficulty.label": "Task difficulty",
  "play.difficulty.intro": "Starter",
  "play.difficulty.practice": "Practice",
  "play.difficulty.challenge": "Challenge",
  "play.difficulty.change": "Changing difficulty starts a new round. Guidance is independent.",
  "play.difficulty.connect.intro": "Connect the first three stops and try this short causal chain.",
  "play.difficulty.connect.practice": "Connect all relationships, including both outcome branches.",
  "play.difficulty.connect.challenge":
    "Connect success, failure and retry paths, then run both probes.",
  "play.difficulty.connect.retry": "Prepare to retry",
  "play.difficulty.connect.retryNote": "After handling failure, start a new attempt",
  "play.difficulty.connect.retryWhy": "After failure, prepare a new attempt.",
  "play.difficulty.connect.againWhy": "When ready, return to the request or work entry.",
  "play.difficulty.connect.firstChain": "Try the first three stops",
  "play.difficulty.connect.recovery": "Retry after a failure",
  "play.difficulty.tune.intro":
    "Adjust one variable to meet the listed requirements. Other parameters are fixed.",
  "play.difficulty.tune.practice": "Coordinate two variables to meet all requirements.",
  "play.difficulty.tune.challenge": "Find a working combination under tighter task constraints.",
  "play.difficulty.tune.minimumWidth": "Delivered image width",
  "play.difficulty.tune.widthWhy":
    "This layout needs at least 1000px width. Shrinking dimensions alone is insufficient.",
  "play.difficulty.hunt.intro":
    "Explore a small range near the boundary and find one disagreement.",
  "play.difficulty.hunt.practice": "Find a counterexample in the full input range.",
  "play.difficulty.hunt.challenge":
    "Find a counterexample and test below, at and above the faulty boundary.",
  "play.difficulty.hunt.more":
    "You found a counterexample. Test both sides and the boundary itself to complete the evidence.",
  "play.difficulty.hunt.complete":
    "The counterexample and all three boundary regions have actual test evidence.",
  "play.difficulty.dispatch.intro":
    "Handle three requests and discover the difference between serving and reusing.",
  "play.difficulty.dispatch.practice":
    "Complete mixed requests within budget; distinguish cached copies from live data.",
  "play.difficulty.dispatch.challenge":
    "Some named resources have new versions; some requests need fresh data. Respect actual cache keys.",
  "play.difficulty.dispatch.revised": "{{name}} · revised",
  "play.difficulty.dispatch.newVersion":
    "The content and its cache key changed. An old copy cannot serve this version.",
  "play.difficulty.program.intro": "Reach the nearby goal with a short set of instructions.",
  "play.difficulty.program.practice":
    "Visit every checkpoint and avoid obstacles on the way to the goal.",
  "play.difficulty.program.challenge":
    "The old shortcut misses a new checkpoint. Plan a detour within the instruction budget.",
  "play.difficulty.ai-brief.intro":
    "Two agreements are given. Clarify the remaining one and test the product yourself.",
  "play.difficulty.ai-brief.practice":
    "Clarify three behavior agreements, apply them, then test and accept.",
  "play.difficulty.ai-brief.challenge":
    "Accept the original agreement, then handle a client change while keeping other rules intact.",
  "play.difficulty.brief.given": "Agreements supplied with the task",
  "play.difficulty.brief.givenNote":
    "These are already written and are not decisions you made this round. Still test the product yourself.",
} as const satisfies Record<keyof typeof sourceMessages, string>;
