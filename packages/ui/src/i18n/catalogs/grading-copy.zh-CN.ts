export const messages = {
  "grading.account.changedBeforeSave":
    "账号已切换。这次回答没有写入新账号，原来的输入仍保留在原账号中。",
  "grading.account.changedBeforeSend": "账号已切换。这次回答没有发送，请在原账号中继续。",
  "grading.result.correct": "答对了。",
  "grading.hint.tryAgain": "再想一下，答案就在上面这段里。",
  "grading.request.signIn":
    "这道题需要登录后才能使用 AI 语义批改。确定性判题仍然免费；请登录后再试。",
  "grading.request.notConfigured":
    "AI 语义批改服务尚未配置。确定性判题仍然免费；请联系产品管理员完成服务配置。",
  "grading.request.incomplete": "AI 语义批改服务返回了不完整的结果。",
  "grading.request.unavailable": "AI 语义批改服务暂时不可用，请稍后重试。",
  "grading.quota.exhaustedTitle": "今天的免费 AI 批改用完了",
  "grading.quota.whatItDoes": "它会在确定性判题无法判断的开放题上提供结构化 AI 评估。",
  "grading.quota.exhausted": "今天的免费 AI 批改用完了，明天恢复。",
  "grading.quota.exhaustedFuture": "免费额度明天恢复；如果现在需要继续批改，可以查看会员方案。",
  "grading.quota.viewPlans": "查看会员方案",
  "grading.quota.unavailableTitle": "今天的免费 AI 批改次数暂时读不到",
  "grading.quota.unavailableReason": "免费额度服务暂时没有返回结果，所以不会发起可能扣费的请求。",
  "grading.quota.unavailableFuture":
    "额度服务恢复后，重新提交这道题就会再次读取今天的免费 AI 批改次数。",
  "grading.offer.signInTitle": "AI 语义批改可以选择，但需要登录",
  "grading.offer.signInReason":
    "当前没有登录账号，服务端无法把这次 AI 批改绑定到你的钱包；免费提示仍然可用。",
  "grading.offer.signInFuture": "登录后，这里会读取同一个账号的 AI 批改余额，再由你决定是否使用。",
  "grading.offer.notConfiguredTitle": "AI 语义批改服务还没接通",
  "grading.offer.notConfiguredReason":
    "当前交付环境还没有配置线上批改服务；这不是你的答案有问题，免费提示仍然可用。",
  "grading.offer.notConfiguredFuture":
    "服务部署后，这里会先展示费用和余额，再让你明确选择是否使用。",
  "grading.offer.unavailableTitle": "AI 批改费用与次数暂时读不到",
  "grading.offer.unavailableReason":
    "这次没有读到服务端的每日免费批改次数或钱包余额，所以不会发起可能扣费的请求；免费提示仍然可用。",
  "grading.offer.unavailableFuture":
    "服务恢复后，重新提交这道题就会再次读取每日免费批改次数和付费余额。",
  "grading.hint.addReasons": "你可以补充更多理由，再试一次。",
  "grading.result.undecidedExplanation":
    "这次暂时无法判断对错。你的答案已经提交，但只靠字面比对不能可靠判断这类解释。",
  "grading.result.undecidedNext":
    "你可以补充或改写答案、查看下面的提示，或者自行选择页面提供的 AI 评估；也可以先继续下一节。",
  "grading.local.title": "这端使用本机 AI 宿主",
  "grading.local.whatItDoes": "在线学习里的 AI 语义批改会先展示费用和余额，再由你决定是否使用。",
  "grading.local.whyUnavailable":
    "当前是 authoring 工作台；开放题会交给本机 AI 宿主，不在这里连接线上 AI 批改服务。",
  "grading.local.futureSupport":
    "切到 delivery 学习端并登录后，页面会显示线上服务的费用、余额和选择。",
  "grading.offer.readFailureTitle": "AI 批改次数暂时读不到",
  "grading.offer.readFailureWhat": "它会在确定性判题无法判断的开放题上提供一次额外的结构化评估。",
  "grading.offer.readFailureReason":
    "这次没有读到费用或钱包余额，所以不会发起可能扣费的请求；下面的免费提示仍然可用。",
  "grading.offer.readFailureFuture": "服务恢复后，重新提交这道题就会再次读取费用和余额。",
  "grading.expression.unavailableTitle": "表达点评暂未接通",
  "grading.expression.whatItDoes": "它会让 AI 只点评你这段话怎样说得更清楚，不改变这道题的对错。",
  "grading.expression.whyUnavailable":
    "当前学习端还没有可用的表达点评包服务，所以不会假装已经发给 AI。",
  "grading.expression.futureSupport": "服务接通后，仍然会先检查账号方案，再把点评材料交给 AI。",
  "grading.expression.failed": "暂时无法生成点评包",
  "grading.answer.saveFailed":
    "这次评估已返回，但学习记录还没有保存成功。输入仍保留在这里，请不要关闭页面；恢复存储后可重试。",
  "grading.answer.submitFailed": "暂时无法提交练习",
  "grading.result.refreshFailed": "刷新失败",
  "grading.answer.label": "你的答案",
  "grading.answer.explainHost": "用自己的话完整解释；对错与点评由 AI 宿主完成。",
  "grading.answer.explain": "用自己的话完整解释。",
  "grading.answer.shortHost": "用自己的话回答；对错由 AI 宿主判定，不要求一字不差。",
  "grading.answer.short": "用自己的话回答。",
  "grading.answer.storageUnavailable": "此浏览器不能保存未提交答案；文字仍保留在当前页面。",
  "grading.answer.draftFailed": "未提交答案没能保存到本机；文字仍保留在当前页面，请先不要关闭。",
  "grading.answer.submitting": "正在提交…",
  "grading.answer.completed": "已完成",
  "grading.answer.resubmit": "重新提交",
  "grading.answer.submit": "提交",
  "grading.answer.cancelRetry": "放弃重答",
  "grading.answer.retry": "重新回答",
  "grading.answer.emptyHint": "写下你的答案后就能提交",
  "grading.result.awaitingTitle": "答案已记录 · 等 AI 评估",
  "grading.result.awaitingRefresh":
    "本页不自己判对错。把答疑包贴给任意 AI 宿主，它写回后这里会自动出现评估 —— 不用守着，回到这个页面时也会立刻刷新。",
  "grading.result.awaitingInstructions":
    "本页不自己判对错。请把答疑包贴到任意 AI 宿主，让它判分并写回。",
  "grading.quota.afterTitle": "AI 批改后的额度",
  "grading.result.extensions": "引申",
  "grading.expression.checking": "正在检查会员权益…",
  "grading.expression.copied": "已复制表达点评包",
  "grading.expression.ask": "让 AI 点评我这段表达",
  "grading.expression.instructions": "贴到任意 AI 宿主。它只评你怎么说，不改判对错。",
  "grading.quota.choices": "AI 语义批改选择",
  "grading.quota.loadingTitle": "正在读取 AI 批改费用与余额",
  "grading.quota.loading":
    "先把这次会使用多少、你的钱包还剩多少读清楚；读取完成前不会开始 AI 批改。",
  "grading.quota.freeTitle": "今天的免费 AI 批改还可用",
  "grading.quota.freeConsent":
    "只有点“使用今日免费 AI 批改”才会使用今天的一次免费 AI 批改；先看提示不占今天的免费次数。",
  "grading.quota.freeHintSelected": "已选择先看提示（不占今天的免费次数）。",
  "grading.quota.freeSelected": "已选择今天的免费 AI 批改。",
  "grading.quota.freeHint": "先看提示（不占今天的免费次数）",
  "grading.quota.walletTitle": "AI 语义批改会使用钱包余额",
  "grading.quota.walletConsent":
    "只有点“使用 AI 批改”才会从钱包扣除这次批改；先看提示不会使用钱包。",
  "grading.quota.walletHintSelected": "已选择先看提示（不使用钱包）。",
  "grading.quota.walletHint": "先看提示（不使用钱包）",
  "grading.quota.details": "查看 AI 批改说明",
  "grading.packet.region": "答疑包与粘贴步骤",
  "grading.packet.copied": "已复制「练习答疑包」到剪贴板",
  "grading.packet.copyFailed": "自动复制失败，请点下面按钮手动复制",
  "grading.packet.copyInstructions": "复制答疑包 → 任意 AI 宿主判分并写回",
  "grading.packet.openAssistant":
    "打开 AI 助手（Grok Build、Claude Code、Antigravity、Codex 等）。",
  "grading.packet.paste": "新开一条对话，粘贴（⌘V / Ctrl+V）→ 发送。",
  "grading.packet.writeBack":
    "让 AI 按包内说明写 `/tmp/ul-host-grade.json` 并执行 host-grade 命令。",
  "grading.packet.return": "回到本页，评估写回后会自动出现。",
  "grading.packet.copyAgain": "已复制，可再复制",
  "grading.packet.copy": "复制答疑包",
  "grading.result.waitAndRefresh": "正在等评估 · 手动刷新",
  "grading.result.refresh": "刷新评估",
  "grading.result.pass": "通过",
  "grading.result.fail": "未通过",
  "grading.result.undecided": "暂时无法判断",
  "grading.request.failed": "请求失败（{{status}}）",
  "grading.offer.whatItDoes":
    "它会在确定性判题无法判断的开放题上提供一次结构化 AI 评估，本次会使用 {{cost}}。",
  "grading.hint.source": "\n\n出自真实项目：{{path}} 第 {{start}}–{{end}} 行",
  "grading.hint.quote": "再看一眼你刚才读过的这句：\n\n> {{quote}}{{source}}",
  "grading.answer.submittedAt": "这是你 {{date}} 已提交的答案。",
  "grading.quota.usedFree": "本次使用今天的免费 AI 批改；{{remaining}}，免费额度明天恢复。",
  "grading.quota.usedWallet": "本次使用钱包完成 AI 批改；{{balance}}。",
  "grading.result.region": "{{grader}}结果",
  "grading.quota.freeOffer": "这次用掉今天免费 AI 批改里的 {{cost}}；{{remaining}}，不会扣钱包。",
  "grading.quota.useFree": "使用今日免费 AI 批改（使用 {{cost}}）",
  "grading.quota.exhaustedWalletOffer":
    "今天的免费 AI 批改用完了，明天恢复。现在使用会从钱包扣除 {{cost}}；{{balance}}。",
  "grading.quota.walletOffer": "这次会使用 {{cost}}；{{balance}}。",
  "grading.quota.useWallet": "使用 AI 批改（使用 {{cost}}）",
  "grading.quota.unavailableOffer": "{{cost}} {{balance}}",
  "grading.quota.attemptCost": "本次 AI 批改会使用 {{cost}}。",
  "grading.quota.balance": "{{balance}}。",
  "grading.quota.balanceUnavailable": "钱包余额暂时读不到。",
  "grading.packet.contentsWithAnswer":
    "包里带了 {{count}} 段本课引用的真实源码{{omitted}}，以及参考答案 —— 你已经答过多次了。",
  "grading.packet.contentsWithoutAnswer":
    "包里带了 {{count}} 段本课引用的真实源码{{omitted}}，但不含参考答案 —— 第一次尝试时提前给答案会让这道题白做。",
  "grading.packet.omitted": "（另有 {{count}} 段略过）",
} as const;
