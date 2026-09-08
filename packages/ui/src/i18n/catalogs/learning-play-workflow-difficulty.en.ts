import type { messages as source } from "./learning-play-workflow-difficulty.zh-CN.js";

export const messages = {
  "play.ai.context.difficulty.intro.title": "Answer one question from {{name}}",
  "play.ai.context.difficulty.intro.brief":
    "Fictional scenario: repair just one answer in “{{work}}”. Two sources disagree. Decide which material the AI should receive.",
  "play.ai.context.difficulty.intro.goal":
    "Give {{name}} a sourced answer using this round's materials: “{{question}}” Repair the pack, rebuild, then test the customer and deliver.",
  "play.ai.context.difficulty.intro.authority":
    "This round only checks “{{slot}}”. Use the confirmed arrangements in “{{source}}”. “{{trial}}” is still an unconfirmed idea.",
  "play.ai.context.difficulty.intro.hint":
    "Let the customer try first. Compare the two sources and remove the statement that does not apply. Ask the customer to try the rebuilt page.",
  "play.ai.context.difficulty.challenge.title": "Answer customers within {{capacity}} units",
  "play.ai.context.difficulty.challenge.brief":
    "{{brief}} The AI now has room for only {{capacity}} units. Whole documents will not fit; keep the paragraphs and sources needed to answer customers.",
  "play.ai.context.difficulty.challenge.goal":
    "Use at most {{capacity}} units to answer: {{labels}}. Rebuild, then have every customer actually try this version.",
  "play.ai.context.difficulty.challenge.authority":
    "{{authority}} This round has room for {{capacity}} units. You may take excerpts; the source requirements above still apply.",
  "play.ai.context.difficulty.challenge.hint":
    "{{hint}} You have {{capacity}} units. Compare approved copies, keep the necessary facts and sources, and leave later stories or arrangements out for now.",
  "play.ai.context.difficulty.serviceSuccess":
    "All {{count}} customers in this round have actually tested the current materials. Sources, the pack, and visit records are preserved.",
  "play.ai.agent.difficulty.intro.title": "Read the source and write {{draft}}",
  "play.ai.agent.difficulty.intro.brief":
    "Fictional scenario: let the Agent read “{{source}}” and produce “{{draft}}”. This round has just two actions: reading and drafting.",
  "play.ai.agent.difficulty.intro.authorization":
    "Allow reading “{{source}}” and writing “{{draft}}”. Preserve the original material. This round ends at a draft; notes in the material grant no extra authority.",
  "play.ai.agent.difficulty.intro.goal":
    "Actually write “{{draft}}” while preserving “{{source}}”. Limit tools to the files these two steps need.",
  "play.ai.agent.difficulty.intro.hint":
    "First authorize a specific source to be read. Authorize the draft separately when writing. Read access does not become write access automatically.",
  "play.ai.agent.difficulty.intro.readTitle": "Read {{source}} first",
  "play.ai.agent.difficulty.intro.readIntent":
    "Check the facts in “{{source}}”, then prepare “{{draft}}”.",
  "play.ai.agent.difficulty.intro.writeTitle": "Write {{draft}}",
  "play.ai.agent.difficulty.intro.writeIntent":
    "Write this round's content in “{{draft}}” and keep “{{source}}” unchanged.",
  "play.ai.agent.difficulty.intro.writeTool":
    "Can overwrite authorized files. This task only needs writing to “{{draft}}”; original material must be preserved.",
  "play.ai.agent.difficulty.challenge.title": "Write the drafts and protect two separate areas",
  "play.ai.agent.difficulty.challenge.brief":
    "{{brief}} This time, a useful drafting step also includes a change to “{{public}}”. An earlier scope decision does not replace checking this step.",
  "play.ai.agent.difficulty.challenge.goal":
    "{{goal}} Two useful writes include changes to original material and the public area. The final preview must use the actual generated drafts.",
  "play.ai.agent.difficulty.challenge.authorization":
    "{{authorization}} Review the targets of every write. Completing the draft does not require overwriting “{{public}}”.",
  "play.ai.agent.difficulty.challenge.hint":
    "{{hint}} The later “{{draft}}” step also tries to change “{{public}}”. Keep the useful draft, revoke access outside the task, then preview the actual drafts.",
  "play.ai.agent.difficulty.challenge.writeTitle": "Write {{draft}} and update the public area",
  "play.ai.agent.difficulty.challenge.writeIntent":
    "This step plans to write “{{draft}}” and copy the imported note into “{{public}}”. Review both targets and preserve the useful part of the task.",
  "play.ai.agent.difficulty.success":
    "Completed this round's outputs: {{outputs}}. {{protected}} stayed unchanged. Tools retain only task access, and actual execution is recorded.",
} as const satisfies Record<keyof typeof source, string>;
