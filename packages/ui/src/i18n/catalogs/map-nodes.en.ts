import type { messages as source } from "./map-nodes.zh-CN.js";
export const messages: { readonly [K in keyof typeof source]: string } = {
  "mapNodes.personal.makeFirst": "Complete the independent task before finishing this lesson.",
  "mapNodes.personal.saveFailed":
    "Your learning record was not saved. Please try again; your saved lesson is still available.",
  "mapNodes.personal.interrupted":
    "The generation service restarted. Saved lessons are still available; unfinished requests can be started again.",
  "mapNodes.personal.title": "What would you like AI to help you do today?",
  "mapNodes.personal.intro":
    "Describe what you need and where you get stuck. We will use verified material from this section to make a private lesson for you.",
  "mapNodes.personal.example":
    "For example: I want to turn a community event notice into a message for a friend without missing the time or place.",
  "mapNodes.personal.goal": "The problem I want to solve",
  "mapNodes.personal.create": "Create my lesson",
  "mapNodes.personal.start": "Start this lesson",
  "mapNodes.personal.saved": "My personal lessons",
  "mapNodes.personal.generating": "Preparing your lesson",
  "mapNodes.personal.writing": "Turning your need into a practice task…",
  "mapNodes.personal.reviewing": "Checking the teaching and source material…",
  "mapNodes.personal.revising": "Improving the issues found in review…",
  "mapNodes.personal.polishing": "Making the wording easier to follow…",
  "mapNodes.personal.saving": "Validating and saving the new lesson…",
  "mapNodes.personal.cancel": "Cancel generation",
  "mapNodes.personal.cancelled": "Cancelled. Existing courses and progress are unchanged.",
  "mapNodes.personal.short":
    "Add a little more about your task, such as who it is for and what you need to produce.",
  "mapNodes.personal.failed":
    "No usable new lesson was created this time. Existing lessons are unchanged; adjust your goal and try again.",
  "mapNodes.personal.unavailable":
    "Personal lesson generation is not connected yet. This entry remains available; ordinary courses and games still work.",
  "mapNodes.personal.notFound":
    "This personal lesson was not found. Reopen it from My personal lessons.",
  "mapNodes.personal.boundary":
    "This local pilot supports text tasks and uses existing verified references, not live web search. New lessons are not added to the public catalogue.",
  "mapNodes.personal.privacy":
    "Your request is sent to the AI authoring service. Do not include passwords or sensitive personal information.",
  "mapNodes.personal.wait":
    "Writing, independent review and polishing take time. You can return to the map and come back later.",
  "mapNodes.personal.back": "Back to my lessons",
  "mapNodes.personal.review": "After you finish, its card joins your normal review schedule.",
  "mapNodes.personal": "My task",
  "mapNodes.challenge": "Practice game",
  "mapNodes.checkpoint": "Checkpoint",
  "mapNodes.opportunities": "More ways to learn here",
  "mapNodes.range": "Lessons {{first}}–{{last}}",
  "mapNodes.personalPitch": "Describe something you want to do and get a lesson for your task.",
  "mapNodes.challengePitch": "Connect what you learned nearby. Optional practice, not a roadblock.",
  "mapNodes.checkpointPitch":
    "Already know this? Check the material and skip what you demonstrate.",
  "mapNodes.loading": "Preparing this section's material…",
  "mapNodes.loadFailed": "The material could not load. Your progress is unchanged; try again.",
  "mapNodes.retry": "Try again",
  "mapNodes.return": "Back to the map",
  "mapNodes.openLesson": "Open this lesson",
  "mapNodes.proven": "Demonstrated",
  "mapNodes.game.start": "Start matching",
  "mapNodes.game.title": "Knowledge match relay",
  "mapNodes.game.intro":
    "Match questions with their answers from nearby lessons you studied. This is practice, not a skip test.",
  "mapNodes.game.timed": "Three-minute round",
  "mapNodes.game.untimed": "No timer",
  "mapNodes.game.pause": "Pause",
  "mapNodes.game.resume": "Resume",
  "mapNodes.game.paused": "Paused. The timer has stopped too.",
  "mapNodes.game.next": "Next board",
  "mapNodes.game.finish": "Finish this round",
  "mapNodes.game.time": "{{time}} remaining",
  "mapNodes.game.round": "Board {{current}} / {{total}}",
  "mapNodes.game.score": "{{count}} pairs matched",
  "mapNodes.game.pick": "Pair each question with the answer that fits.",
  "mapNodes.game.miss": "These do not match. Check what the question asks and try again.",
  "mapNodes.game.right": "Matched · From “{{lesson}}”",
  "mapNodes.game.done": "Round complete",
  "mapNodes.game.summary": "{{matched}} pairs matched in {{attempts}} attempts.",
  "mapNodes.game.notProof":
    "Matching practice is not proof of mastery. Review schedules and skip records are unchanged.",
  "mapNodes.game.expired":
    "Three minutes are up. Finish now or complete this board without a timer.",
  "mapNodes.game.continueUntimed": "Finish this board without a timer",
  "mapNodes.game.empty":
    "There are not yet two suitable studied cards here. Learn this section, then return to practise.",
  "mapNodes.game.available": "{{count}} cards in this round. No repeats to fill the timer.",
  "mapNodes.game.saved": "Your previous board is saved. Resume when ready.",
  "mapNodes.game.replay": "Play another round",
  "mapNodes.check.title": "Do you already know this section?",
  "mapNodes.check.intro":
    "Check the existing exercises for each lesson, without a timer. Results appear at the end; only demonstrated material is skipped.",
  "mapNodes.check.coverage":
    "This sitting covers {{covered}} / {{total}} lessons, with {{questions}} questions.",
  "mapNodes.check.unavailable":
    "These lessons need a practical task or another assessment. This test will not claim you mastered them:",
  "mapNodes.check.empty":
    "This section needs practical work, so a short quiz cannot prove it yet. You can still take the lessons.",
  "mapNodes.check.start": "Start checkpoint",
  "mapNodes.check.progress": "Question {{current}} / {{total}}",
  "mapNodes.check.answer": "Your answer",
  "mapNodes.check.short": "Write just the short answer requested, without extra explanation.",
  "mapNodes.check.blank": "Write or select an answer first.",
  "mapNodes.check.submit": "Submit this answer",
  "mapNodes.check.settle": "See results",
  "mapNodes.check.saving": "Checking the lesson edition and saving results…",
  "mapNodes.check.changed":
    "The lessons changed. No new skip records were written. Please restart the checkpoint.",
  "mapNodes.check.saveFailed":
    "Your results could not be saved yet. Your answers are retained; try again.",
  "mapNodes.check.complete": "Section checkpoint passed",
  "mapNodes.check.partial": "Your checkpoint results",
  "mapNodes.check.passed": "You may skip {{count}} lessons",
  "mapNodes.check.practice": "Worth studying again",
  "mapNodes.check.untested": "Not assessed yet",
  "mapNodes.check.noRead":
    "Skipping is not reading. Unstudied cards stay out of review; you can return to these lessons anytime.",
  "mapNodes.check.noPass":
    "Nothing to skip from this sitting yet. Your earlier progress is unchanged.",
  "mapNodes.draftFailed": "This step could not be saved locally. Leaving may lose this attempt.",
};
