import type { messages as sourceMessages } from "./learning-play-ai-agent-play.zh-CN.js";

export const messages = {
  "play.ai.agent.play.intro":
    "Take the controls: inspect each file the agent wants to read or write, change its access beside that file, then let it advance. Drafts really change in this sandbox; broad permissions can also damage its source material.",
  "play.ai.agent.play.filesTitle": "This action's files and access",
  "play.ai.agent.play.usingTool": "Tool for this action: {{tool}}",
  "play.ai.agent.play.filesHint":
    "These switches change the actual tool scope above and remain in effect for later actions. Proposed content has not been written yet.",
  "play.ai.agent.play.readTarget": "Read",
  "play.ai.agent.play.writeTarget": "Write",
  "play.ai.agent.play.readWriteTarget": "Read and write",
  "play.ai.agent.play.allowTarget": "Allow {{tool}} to access {{file}}",
  "play.ai.agent.play.targetAllowed": "The tool currently has access.",
  "play.ai.agent.play.targetRequiredBlocked":
    "This required file is out of scope, so the whole action will pause.",
  "play.ai.agent.play.targetOptionalBlocked": "The tool cannot currently reach this target.",
  "play.ai.agent.play.before": "Current content",
  "play.ai.agent.play.readContent": "Current content to be read",
  "play.ai.agent.play.proposed": "Proposed content · not written yet",
  "play.ai.agent.play.effectPrevented":
    "The current scope blocks this write. Existing content will stay unchanged.",
  "play.ai.agent.play.protectedReachable":
    "The current scope allows this write. Executing it would change material that must be preserved.",
  "play.ai.agent.play.engineReady":
    "This action can execute with the current permissions. Above, you can see which content will stay and which will change.",
  "play.ai.agent.play.engineBlocked":
    "This action cannot execute yet. Inspect the required file switches, or return the extra instruction from the material.",
  "play.ai.agent.play.requiredPause":
    "Paused here without executing. You can remove unwanted file access beside each target, keep the required artifact, and continue.",
  "play.ai.agent.play.requiredPauseSimple":
    "Paused here without executing. The task still needs this action's input or artifact. You can adjust its file scope before continuing.",
  "play.ai.agent.play.adjustHere": "Adjust this action's file scope here",
  "play.ai.agent.play.scopeChanged":
    "{{tool}} now has the updated access. The toolbox and this action's file switches show the same scope.",
  "play.ai.agent.play.run": "Advance to my next decision",
  "play.ai.agent.play.stop": "Stop here",
  "play.ai.agent.play.runHelp":
    "Advance executes authorized user tasks in order. It pauses at document instructions, missing permissions, or changes to protected material. You can also stop anytime. No fast reactions required.",
  "play.ai.agent.play.running":
    "Advancing with current permissions. Actual file results will appear step by step.",
  "play.ai.agent.play.stopped":
    "Stopped before the next action. Inspect files, change permissions, then continue when ready.",
  "play.ai.agent.play.backgroundStopped":
    "Advancing stopped when this page moved to the background. You decide when to resume.",
  "play.ai.agent.play.pause.document-action":
    "Paused before an extra instruction found in the material. It is not new user authorization. Inspect its source and targets, then decide this action yourself.",
  "play.ai.agent.play.pause.protected-change":
    "Paused before changing {{paths}}. Current access would let this action overwrite protected material. You can narrow access beside the file.",
  "play.ai.agent.play.pause.workspace-damaged":
    "Advancing stopped: {{paths}} has already changed. Restore the checkpoint, repair the scope, then replay.",
  "play.ai.agent.play.pause.scope-denied":
    "Paused at {{tool}}: required files are not authorized yet. Inspect the switches beside the files before continuing.",
  "play.ai.agent.play.pause.round-ended":
    "The plan is complete. Actual artifacts remain in the workspace, ready for review.",
  "play.ai.agent.play.resultTitle": "What just happened",
  "play.ai.agent.play.resultRead": "Read {{paths}}",
  "play.ai.agent.play.resultChanged": "Wrote {{paths}}",
  "play.ai.agent.play.resultBlocked": "Scope blocked {{paths}}",
  "play.ai.agent.play.stepExecuted": "Executed “{{title}}”. The actual result is shown here.",
} as const satisfies Record<keyof typeof sourceMessages, string>;
