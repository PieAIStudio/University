import type { messages as source } from "./learning-play-workflow-usability.zh-CN.js";

export const messages = {
  "play.ai.context.guide.first": "Start with this customer's question",
  "play.ai.context.guide.visit": "Let {{name}} try it",
  "play.ai.context.guide.retry": "Let {{name}} try again",
  "play.ai.context.guide.failed": "The answer got stuck. Check the material behind it",
  "play.ai.context.guide.changed": "Materials changed. Update the page first",
  "play.ai.context.guide.rebuilt": "The page is updated. Ask this customer to try again",
  "play.ai.context.guide.next": "That answer worked. Serve another customer",
  "play.ai.context.guide.done": "Every customer has tried this version",
  "play.ai.context.guide.openSource": "Open “{{title}}”",
  "play.ai.context.guide.materials": "Check and edit materials",
  "play.ai.context.guide.edit": "Check the source and date, then choose what to keep",
  "play.ai.context.guide.editHint":
    "Select a paragraph to give it to the AI. Deselect it to remove it from the pack.",
  "play.ai.context.guide.pickDocument": "Choose another document · {{count}} available",
  "play.ai.context.guide.pack": "View packed paragraphs · {{used}} / {{total}} units",
  "play.ai.context.guide.fullResult": "View the full work sheet",
  "play.ai.context.guide.queue": "All customers · {{count}} / {{total}} verified",
  "play.ai.context.guide.oldAnswer":
    "This answer is from the previous materials. Try the updated page.",
  "play.ai.context.guide.currentPack": "Current materials: {{used}} / {{total}} units",
  "play.ai.context.guide.overCapacity":
    "The pack is {{extra}} units too large. Remove paragraphs you do not need yet.",
  "play.ai.context.guide.return": "Return to the customer and try this page",
  "play.ai.agent.guide.first": "Let it read the task materials first",
  "play.ai.agent.guide.readScope":
    "Read only these {{count}} files. Their contents will stay unchanged.",
  "play.ai.agent.guide.readStart": "Authorize reading only these files and start",
  "play.ai.agent.guide.readDetails": "Inspect the original text to be read",
  "play.ai.agent.guide.readOnly": "This step can read files, but cannot change them.",
  "play.ai.agent.guide.scope": "Review the proposed content, then allow the files you choose",
  "play.ai.agent.guide.ready": "Permissions are ready. Review the content and execute this step",
  "play.ai.agent.guide.document":
    "This request came from a note in the material. Check it against the task",
  "play.ai.agent.guide.risk":
    "Current permissions would change protected material. Review the scope first",
  "play.ai.agent.guide.damaged": "Protected material changed. Restore it, then adjust permissions",
  "play.ai.agent.guide.finish": "The plan is finished. Check the actual files and permissions",
  "play.ai.agent.guide.broad": "The output is ready. Revoke access outside the task first",
  "play.ai.agent.guide.tools": "All tools and permission scopes",
  "play.ai.agent.guide.workspace": "Inspect all files",
  "play.ai.agent.guide.more": "Continuous run and more actions",
  "play.ai.agent.guide.runHelp":
    "Runs only authorized user tasks. Stops at material notes, missing permissions, or changes to protected files.",
  "play.ai.agent.guide.choose": "Choose files for this step",
  "play.ai.agent.guide.files": "Files for this step · {{tool}}",
  "play.ai.agent.guide.before": "Compare with the current content",
  "play.ai.agent.guide.result": "What the last step actually did",
  "play.ai.agent.guide.next": "Next: {{title}}",
  "play.ai.agent.guide.allowed": "Allowed. This permission stays active for later steps.",
  "play.ai.agent.guide.required": "Allow this file before executing the step.",
  "play.ai.agent.guide.kept": "Not authorized. This file will stay unchanged.",
  "play.ai.agent.guide.scopeChanged":
    "File permissions updated. The proposed effects and execution now use this scope.",
} as const satisfies Record<keyof typeof source, string>;
