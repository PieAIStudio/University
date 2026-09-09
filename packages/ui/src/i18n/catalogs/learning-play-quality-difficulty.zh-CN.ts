export const messages = {
  "play.qualityDifficulty.eval.requirements": "本轮要求：{{count}} 类请求{{cross}}",
  "play.qualityDifficulty.eval.crossCount": "，另有 {{count}} 条交叉条件",
  "play.qualityDifficulty.eval.coverage": "已覆盖 {{count}} / {{total}} 类请求",
  "play.qualityDifficulty.eval.requirementDone": "已冻结",
  "play.qualityDifficulty.eval.requirementPending": "待出题",
  "play.qualityDifficulty.eval.crossHeading": "这些条件组合也要单独出题并回归",
  "play.qualityDifficulty.eval.crossNext":
    "下一题，把这些条件放在一起：{{input}}。请自己判断先处理什么。",
  "play.qualityDifficulty.eval.input-coverage":
    "还缺交叉条件的有效用例：{{missing}}。请设置这些条件、选择预期并冻结，再跑整组验收。",
  "play.qualityDifficulty.eval.invalid-requirements":
    "本轮要求不完整或互相矛盾，无法验收。请重新选择任务或反馈这份活动。",
  "play.qualityDifficulty.eval.moreTrials": "本轮要求的题已备齐，还要亲眼找到一次边界失败。",
  "play.qualityDifficulty.eval.release": "本轮要求的题已备齐。选择需要的限制，再实际跑完这整组题。",
  "play.qualityDifficulty.eval.releaseNote":
    "按本轮要求清单补齐题目，再用当前发布限制执行全部已冻结用例；正常请求仍须有用。",
  "play.qualityDifficulty.eval.intro.brief":
    "先试一个正常请求，再反复试一种边界情况，观察助手有没有说到做到。",
  "play.qualityDifficulty.eval.intro.goal":
    "收集正常请求和「{{boundary}}」两类用例，亲眼找到一次盲区，再让整组验收通过。",
  "play.qualityDifficulty.eval.intro.hint":
    "入门题仍有三份响应；先逐次试完，再补一个条件齐全的正常请求。",
  "play.qualityDifficulty.eval.challenge.brief":
    "单独的问题会处理，还不代表多个问题同时出现时能处理对。把条件组合起来试。",
  "play.qualityDifficulty.eval.challenge.goal":
    "冻结四类请求，以及「缺信息且无资源」「缺信息且越界」两条交叉题；找到真实盲区后，让全部用例通过整组回归。",
  "play.qualityDifficulty.eval.challenge.hint":
    "两条交叉题也各是一条独立用例。按公开约定判断先后顺序，不能把单独条件的结果直接当成交叉题证据。",
  "play.qualityDifficulty.eval.challenge.contract":
    "{{contract}} 多个条件同时出现时，先确认业务范围，再补齐信息，最后核对名额或库存；先处理顺序最前的问题。",
  "play.qualityDifficulty.repair.intro.brief":
    "亲手复现问题，在两份改法中作选择，再确认原问题和原有功能。",
  "play.qualityDifficulty.repair.intro.goal":
    "比较两份改法并修好已封存的问题，然后亲手验证：{{regression}}",
  "play.qualityDifficulty.repair.intro.hint":
    "两份改法都要看实际结果。让按钮不能用，也会让正常任务做不了。",
  "play.qualityDifficulty.repair.preserve": "这轮还必须保留：{{regression}}",
  "play.qualityDifficulty.repair.booking.third": "周日上午",
  "play.qualityDifficulty.repair.booking.challenge.brief":
    "修重复预约时，有人已经订好了另一个时段。修改其中一张预约，不能误伤另一张。",
  "play.qualityDifficulty.repair.booking.challenge.productBrief":
    "可以同时预约不同的体验课时段。取消当前时段时，其他时段的预约应继续保留。",
  "play.qualityDifficulty.repair.booking.challenge.goal":
    "修好重复提交，再亲手保留 {{keep}} 的预约，把 {{second}} 取消并改约 {{third}}；最终只留 {{keep}} 和 {{third}} 两张。",
  "play.qualityDifficulty.repair.booking.challenge.regression":
    "{{keep}} 全程保留；同时约 {{second}}，只取消 {{second}} 再改约 {{third}}，最终只留下 {{keep}} 与 {{third}}。",
  "play.qualityDifficulty.repair.booking.challenge.step1":
    "先预约 {{keep}}，再选择 {{second}} 并预约，确认两张都在。",
  "play.qualityDifficulty.repair.booking.challenge.step2":
    "保持 {{second}} 被选中，取消它；{{keep}} 必须还在。",
  "play.qualityDifficulty.repair.booking.challenge.step3":
    "改选 {{third}} 并预约，检查最后只有 {{keep}} 和 {{third}} 两张。",
  "play.qualityDifficulty.repair.booking.challenge.hint":
    "被要求保留的预约不能删掉再补回来。检查整段操作里它是否一直存在。",
  "play.qualityDifficulty.repair.preference.third": "高蛋白午餐",
  "play.qualityDifficulty.repair.preference.challenge.brief":
    "一次保存成功还不够。连续改成两种不同午餐，并分别重新打开，确认每次都真的记住了。",
  "play.qualityDifficulty.repair.preference.challenge.productBrief":
    "默认午餐可以反复修改；每次保存后重新打开，都应显示刚才保存的选择。",
  "play.qualityDifficulty.repair.preference.challenge.goal":
    "修好丢失的保存，再亲手改成 {{second}}、保存并重开；随后改成 {{third}}、保存并重开，两次读取都要正确。",
  "play.qualityDifficulty.repair.preference.challenge.regression":
    "先改成 {{second}} 并保存、重开确认，再改成 {{third}} 并保存、重开确认；两次重开都要亲手做。",
  "play.qualityDifficulty.repair.preference.challenge.step1":
    "选择 {{second}}，保存后模拟重开，确认显示 {{second}}。",
  "play.qualityDifficulty.repair.preference.challenge.step2":
    "改选 {{third}}，保存后再次模拟重开，确认显示 {{third}}。",
  "play.qualityDifficulty.repair.preference.challenge.step3":
    "核对两次重开记录；只有最后一次正确，还不能证明前一次也保存好了。",
  "play.qualityDifficulty.repair.preference.challenge.hint":
    "每次改选并保存后都立即重开。连续保存三种选择、只在最后重开，证据仍不够。",
  "play.qualityDifficulty.repair.keepFirst": "先预约「{{choice}}」；这张单之后必须一直保留。",
  "play.qualityDifficulty.repair.addSecond": "保留原预约，再选择「{{choice}}」并预约。",
  "play.qualityDifficulty.repair.cancelOnly": "只取消「{{choice}}」，观察另一张预约是否仍在。",
  "play.qualityDifficulty.repair.addReplacement":
    "现在改约「{{choice}}」，最后应保留两张不同的预约单。",
  "play.qualityDifficulty.repair.keepLost":
    "需要保留的预约已经丢了；重新补一张不能抵消这次丢失。重置小产品，再检查一遍。",
  "play.qualityDifficulty.repair.changeAndRead":
    "改选「{{choice}}」并保存，这次也需要重新打开确认。",
  "play.qualityDifficulty.repair.readChange":
    "已保存「{{choice}}」。现在模拟重开，亲眼确认这一次保存。",
} as const;
