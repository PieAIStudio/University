import type { messages as sourceMessages } from "./grading-copy.zh-CN.js";

export const messages = {
  "grading.account.changedBeforeSave":
    "Your account has changed. This answer was not saved to the new account. Your original input is still kept under the original account.",
  "grading.account.changedBeforeSend":
    "Your account has changed. This answer was not sent. Please continue in the original account.",
  "grading.result.correct": "Correct.",
  "grading.hint.tryAgain": "Think it over—the answer is in the passage above.",
  "grading.request.signIn":
    "Sign in to use AI grading for this question. Automatic answer checks are still free. Please sign in and try again.",
  "grading.request.notConfigured":
    "The AI grading service has not been configured. Automatic answer checks are still free. Please contact the product administrator to set up the service.",
  "grading.request.incomplete": "The AI grading service returned an incomplete result.",
  "grading.request.unavailable":
    "The AI grading service is temporarily unavailable. Please try again later.",
  "grading.quota.exhaustedTitle": "You have used all of today's free AI gradings",
  "grading.quota.whatItDoes":
    "It provides a structured AI evaluation for open questions that automatic answer matching cannot assess.",
  "grading.quota.exhausted": "You have used all of today's free AI gradings. They renew tomorrow.",
  "grading.quota.exhaustedFuture":
    "Your free allowance renews tomorrow. If you need more grading now, you can view the membership plans.",
  "grading.quota.viewPlans": "View membership plans",
  "grading.quota.unavailableTitle": "Today's free AI grading allowance is temporarily unavailable",
  "grading.quota.unavailableReason":
    "The free allowance service has not returned a result, so no request that might incur a charge will be sent.",
  "grading.quota.unavailableFuture":
    "Once the allowance service is available, resubmit this answer to check today's free AI grading allowance again.",
  "grading.offer.signInTitle": "Sign in to choose AI grading",
  "grading.offer.signInReason":
    "You are not signed in, so the service cannot link this AI grading to your wallet. Free hints are still available.",
  "grading.offer.signInFuture":
    "After you sign in, this page will check the AI grading balance for that account. You can then decide whether to use it.",
  "grading.offer.notConfiguredTitle": "The AI grading service is not connected yet",
  "grading.offer.notConfiguredReason":
    "The online grading service has not been set up for this learning environment. This does not indicate a problem with your answer. Free hints are still available.",
  "grading.offer.notConfiguredFuture":
    "Once the service is available, this page will show the cost and balance before asking you to choose whether to use it.",
  "grading.offer.unavailableTitle": "AI grading costs and allowances are temporarily unavailable",
  "grading.offer.unavailableReason":
    "The service did not return your daily free grading allowance or wallet balance, so no request that might incur a charge will be sent. Free hints are still available.",
  "grading.offer.unavailableFuture":
    "Once the service is available, resubmit this answer to check your daily free grading allowance and wallet balance again.",
  "grading.hint.addReasons": "You can add more reasons and try again.",
  "grading.result.undecidedExplanation":
    "We cannot tell whether this answer is correct yet. Your answer has been submitted, but text matching alone cannot reliably assess this kind of explanation.",
  "grading.result.undecidedNext":
    "You can expand or rewrite your answer, read the hint below, or choose the AI evaluation offered on this page. You can also continue to the next lesson for now.",
  "grading.local.title": "This version uses an AI assistant on your computer",
  "grading.local.whatItDoes":
    "AI grading in online learning shows the cost and balance first, then lets you decide whether to use it.",
  "grading.local.whyUnavailable":
    "This is the authoring workspace. Open questions go to an AI assistant on your computer; this workspace does not connect to the online AI grading service.",
  "grading.local.futureSupport":
    "Switch to online learning and sign in to see the online service costs, balance, and options.",
  "grading.offer.readFailureTitle": "Your AI grading allowance is temporarily unavailable",
  "grading.offer.readFailureWhat":
    "It provides an additional structured evaluation for open questions that automatic answer matching cannot assess.",
  "grading.offer.readFailureReason":
    "The cost or wallet balance could not be read, so no request that might incur a charge will be sent. The free hints below are still available.",
  "grading.offer.readFailureFuture":
    "Once the service is available, resubmit this answer to check the cost and balance again.",
  "grading.expression.unavailableTitle": "Writing feedback is not connected yet",
  "grading.expression.whatItDoes":
    "AI gives feedback on how to express your explanation more clearly, without changing whether your answer is marked correct.",
  "grading.expression.whyUnavailable":
    "The writing feedback packet service is not available in this learning environment. No packet has been sent to AI.",
  "grading.expression.futureSupport":
    "Once the service is connected, your account plan will still be checked before the feedback material is passed to AI.",
  "grading.expression.failed": "The feedback packet could not be created. Please try again later.",
  "grading.answer.saveFailed":
    "Your evaluation is ready, but your learning record could not be saved. Your input is still here. Please keep this page open and try again once storage is available.",
  "grading.answer.submitFailed": "Your answer could not be submitted. Please try again later.",
  "grading.result.refreshFailed": "The evaluation could not be refreshed.",
  "grading.answer.label": "Your answer",
  "grading.answer.explainHost":
    "Explain fully in your own words. Your AI assistant will assess the answer and give feedback.",
  "grading.answer.explain": "Explain fully in your own words.",
  "grading.answer.shortHost":
    "Answer in your own words. Your AI assistant will assess it; an exact word-for-word match is not required.",
  "grading.answer.short": "Answer in your own words.",
  "grading.answer.storageUnavailable":
    "This browser cannot save unsubmitted answers. Your text is still on this page.",
  "grading.answer.draftFailed":
    "Your unsubmitted answer could not be saved on this device. Your text is still on this page. Please keep it open.",
  "grading.answer.submitting": "Submitting…",
  "grading.answer.completed": "Completed",
  "grading.answer.resubmit": "Resubmit",
  "grading.answer.submit": "Submit",
  "grading.answer.cancelRetry": "Cancel new answer",
  "grading.answer.retry": "Answer again",
  "grading.answer.emptyHint": "Write your answer to submit it",
  "grading.result.awaitingTitle": "Answer recorded · Waiting for AI evaluation",
  "grading.result.awaitingRefresh":
    "This page does not grade the answer itself. Paste the help packet into an AI assistant. Its evaluation will appear here once it writes back. You can leave this page; it will refresh as soon as you return.",
  "grading.result.awaitingInstructions":
    "This page does not grade the answer itself. Paste the help packet into an AI assistant and ask it to grade the answer and write back.",
  "grading.quota.afterTitle": "Allowance after AI grading",
  "grading.result.extensions": "Further learning",
  "grading.expression.checking": "Checking membership benefits…",
  "grading.expression.copied": "Writing feedback packet copied",
  "grading.expression.ask": "Ask AI for feedback on my writing",
  "grading.expression.instructions":
    "Paste it into an AI assistant. It only reviews how you express yourself; it does not change the grade.",
  "grading.quota.choices": "AI grading options",
  "grading.quota.loadingTitle": "Checking AI grading cost and balance",
  "grading.quota.loading":
    "We are checking the cost of this grading and your remaining wallet balance. AI grading will not start until this check is complete.",
  "grading.quota.freeTitle": "Free AI grading is still available today",
  "grading.quota.freeConsent":
    "Only choosing “Use today's free AI grading” uses one of today's free gradings. Reading hints first does not use your free allowance.",
  "grading.quota.freeHintSelected":
    "You chose to read hints first. This does not use your free allowance.",
  "grading.quota.freeSelected": "You chose today's free AI grading.",
  "grading.quota.freeHint": "Read hints first (keeps your free allowance)",
  "grading.quota.walletTitle": "AI grading will use your wallet balance",
  "grading.quota.walletConsent":
    "Only choosing “Use AI grading” deducts this grading from your wallet. Reading hints first does not use your wallet.",
  "grading.quota.walletHintSelected":
    "You chose to read hints first. This does not use your wallet.",
  "grading.quota.walletHint": "Read hints first (keeps your wallet balance)",
  "grading.quota.details": "View AI grading details",
  "grading.packet.region": "Help packet and paste instructions",
  "grading.packet.copied": "Exercise help packet copied to the clipboard",
  "grading.packet.copyFailed":
    "Automatic copying failed. Use the button below to copy it manually.",
  "grading.packet.copyInstructions":
    "Copy the help packet → Ask an AI assistant to grade the answer and write back",
  "grading.packet.openAssistant":
    "Open an AI assistant, such as Grok Build, Claude Code, Antigravity, or Codex.",
  "grading.packet.paste": "Start a new conversation, paste (⌘V / Ctrl+V), and send.",
  "grading.packet.writeBack":
    "Ask the AI to follow the packet instructions to write `/tmp/ul-host-grade.json` and run the host-grade command.",
  "grading.packet.return":
    "Return to this page. The evaluation will appear automatically once it is written back.",
  "grading.packet.copyAgain": "Copied · Copy again",
  "grading.packet.copy": "Copy help packet",
  "grading.result.waitAndRefresh": "Waiting for evaluation · Refresh now",
  "grading.result.refresh": "Refresh evaluation",
  "grading.result.pass": "Passed",
  "grading.result.fail": "Not passed",
  "grading.result.undecided": "Cannot assess yet",
  "grading.request.failed": "Request failed ({{status}})",
  "grading.offer.whatItDoes":
    "It provides a structured AI evaluation for open questions that automatic answer matching cannot assess. This uses {{cost}}.",
  "grading.hint.source": "\n\nFrom a real project: {{path}}, lines {{start}}–{{end}}",
  "grading.hint.quote": "Look again at this sentence you just read:\n\n> {{quote}}{{source}}",
  "grading.answer.submittedAt": "This is the answer you submitted on {{date}}.",
  "grading.quota.usedFree":
    "This used today's free AI grading. {{remaining}}. Your free allowance renews tomorrow.",
  "grading.quota.usedWallet": "This AI grading used your wallet. {{balance}}.",
  "grading.result.region": "{{grader}} result",
  "grading.quota.freeOffer":
    "This uses {{cost}} from today's free allowance. {{remaining}}. Your wallet will not be charged.",
  "grading.quota.useFree": "Use today's free AI grading (uses {{cost}})",
  "grading.quota.exhaustedWalletOffer":
    "You have used all of today's free AI gradings. They renew tomorrow. Grading now uses {{cost}} from your wallet. {{balance}}.",
  "grading.quota.walletOffer": "This uses {{cost}}. {{balance}}.",
  "grading.quota.useWallet": "Use AI grading (uses {{cost}})",
  "grading.quota.unavailableOffer": "{{cost}} {{balance}}",
  "grading.quota.attemptCost": "This AI grading uses {{cost}}.",
  "grading.quota.balance": "{{balance}}.",
  "grading.quota.balanceUnavailable": "Your wallet balance is temporarily unavailable.",
  "grading.packet.contentsWithAnswer":
    "The packet includes {{count}} source code excerpts cited in this lesson{{omitted}}, plus the reference answer because you have already made several attempts.",
  "grading.packet.contentsWithoutAnswer":
    "The packet includes {{count}} source code excerpts cited in this lesson{{omitted}}, but no reference answer. Seeing the answer on your first attempt would defeat the purpose of the exercise.",
  "grading.packet.omitted": " ({{count}} more omitted)",
} satisfies Record<keyof typeof sourceMessages, string>;
