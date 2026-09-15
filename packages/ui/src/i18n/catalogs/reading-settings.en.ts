import type { messages as source } from "./reading-settings.zh-CN.js";

export const messages = {
  "reading.settings.title": "Vocabulary aid settings",
  "reading.settings.intent": "What would you like to focus on?",
  "reading.settings.adjust": "Fine-tune",
  "reading.settings.custom": " · Custom",
  "reading.settings.original": "Show Chinese alongside the text",
  "reading.settings.originalShown":
    "The meaning is beside the word for smoother reading, with less opportunity to practise recalling it.",
  "reading.settings.originalHidden":
    "English appears on its own. Reveal the meaning after trying to recall it.",
  "reading.settings.markStyle": "Word highlighting",
  "reading.settings.underline": "Underline",
  "reading.settings.marker": "Highlight",
  "reading.settings.plain": "None",
  "reading.settings.phonetic": "Pronunciation symbols",
  "reading.settings.speak": "Read-aloud buttons",
  "reading.settings.examples": "Example sentences",
  "reading.settings.stageButtons": "Familiar / Still learning buttons",
  "reading.settings.stageNote":
    "Hide these buttons for quieter reading. You will not add words to review through them while they are hidden.",
  "reading.preset.read": "Read",
  "reading.preset.pronounce": "Pronunciation",
  "reading.preset.remember": "Recall",
  "reading.preset.readHint":
    "Show Chinese meanings alongside words without interrupting your reading",
  "reading.preset.pronounceHint": "Add pronunciation symbols and read-aloud buttons as you go",
  "reading.preset.rememberHint":
    "Show English first; try recalling the meaning before revealing it",
} satisfies Record<keyof typeof source, string>;
