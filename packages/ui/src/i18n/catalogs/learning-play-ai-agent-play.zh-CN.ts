export const messages = {
  "play.ai.agent.play.intro":
    "你来掌舵：看 Agent 要读写哪份文件，直接在文件旁改权限，再让它推进。草稿会真的写出来；范围过大，也会真的改坏这里的原资料。",
  "play.ai.agent.play.filesTitle": "这一步的文件与权限",
  "play.ai.agent.play.usingTool": "本步使用：{{tool}}",
  "play.ai.agent.play.filesHint":
    "这里的开关会同步修改上方工具的实际范围，并保留到后续行动。拟改内容还没有执行。",
  "play.ai.agent.play.readTarget": "读取",
  "play.ai.agent.play.writeTarget": "改写",
  "play.ai.agent.play.readWriteTarget": "读取并改写",
  "play.ai.agent.play.allowTarget": "允许「{{tool}}」触达「{{file}}」",
  "play.ai.agent.play.targetAllowed": "当前工具可触达。",
  "play.ai.agent.play.targetRequiredBlocked": "缺少这个必要文件的权限，整步会停住。",
  "play.ai.agent.play.targetOptionalBlocked": "当前工具触达不了这个目标。",
  "play.ai.agent.play.before": "现在的内容",
  "play.ai.agent.play.readContent": "准备读取的现有内容",
  "play.ai.agent.play.proposed": "计划写成 · 尚未执行",
  "play.ai.agent.play.effectPrevented": "这次改写已被当前范围挡住，现有内容会保留。",
  "play.ai.agent.play.protectedReachable": "当前范围允许这次改写，执行后将改变本应保留的资料。",
  "play.ai.agent.play.engineReady": "按当前权限可以执行。上面能看见哪些内容会保留、哪些会改写。",
  "play.ai.agent.play.engineBlocked":
    "当前条件下整步不会执行。检查必要文件的开关，或退回材料带来的额外指令。",
  "play.ai.agent.play.requiredPause":
    "已停在这里，没有执行。你可以在文件旁收回不想要的改写，留下任务需要的产物，再继续。",
  "play.ai.agent.play.requiredPauseSimple":
    "已停在这里，没有执行。任务仍需要这一步的输入或产物；可以先修改文件范围，再继续。",
  "play.ai.agent.play.adjustHere": "就在这里修改文件范围",
  "play.ai.agent.play.scopeChanged": "「{{tool}}」的实际权限已更新，上方授权和本步文件开关已同步。",
  "play.ai.agent.play.run": "推进到需要我判断处",
  "play.ai.agent.play.stop": "停在这里",
  "play.ai.agent.play.runHelp":
    "推进会依次执行已授权的用户任务。遇材料指令、缺权限或将改动保留资料时停下；你也能随时叫停。没有手速要求。",
  "play.ai.agent.play.running": "正在按当前授权推进，文件结果会逐步出现。",
  "play.ai.agent.play.stopped": "已停下，尚未执行下一步。可以检查文件、修改权限，再继续。",
  "play.ai.agent.play.backgroundStopped": "页面切到后台，推进已停止。回来后由你决定何时继续。",
  "play.ai.agent.play.pause.document-action":
    "停在材料带来的额外指令前。这不是用户的新授权；请检查来源与目标，再亲自决定这一步。",
  "play.ai.agent.play.pause.protected-change":
    "已停住，还没有改动 {{paths}}。当前权限会让这一步改写应保留的文件，你可以就在文件旁收回范围。",
  "play.ai.agent.play.pause.workspace-damaged":
    "已停止推进：{{paths}} 已被改动。这里可以恢复检查点，再修范围重放。",
  "play.ai.agent.play.pause.scope-denied":
    "已停在「{{tool}}」：本步需要的文件尚未授权。检查文件旁的开关后再继续。",
  "play.ai.agent.play.pause.round-ended": "计划已走完。实际产物保留在工作区，可以开始验收。",
  "play.ai.agent.play.resultTitle": "刚才的实际结果",
  "play.ai.agent.play.resultRead": "已读取 {{paths}}",
  "play.ai.agent.play.resultChanged": "已改写 {{paths}}",
  "play.ai.agent.play.resultBlocked": "范围挡住了 {{paths}}",
  "play.ai.agent.play.stepExecuted": "已执行「{{title}}」，实际结果就在这里。",
} as const;
