export const messages = {
  "play.ai.context.difficulty.intro.title": "先答清{{name}}的一个问题",
  "play.ai.context.difficulty.intro.brief":
    "虚构案例：这次只修「{{work}}」里的一个回答。两份材料说法不一致，你来决定哪些内容可以交给 AI。",
  "play.ai.context.difficulty.intro.goal":
    "让{{name}}在本轮材料下得到有依据的回答：「{{question}}」修好材料后重新生成，再亲自试问并交付。",
  "play.ai.context.difficulty.intro.authority":
    "本轮只核对「{{slot}}」，以「{{source}}」中已经确认的安排为准。「{{trial}}」仍是未确认的想法。",
  "play.ai.context.difficulty.intro.hint":
    "先让顾客试问，再对照两份材料的来源，移出不适用于本轮的说法。生成新页面后还要请顾客重试。",
  "play.ai.context.difficulty.challenge.title": "在{{capacity}}格里答好顾客的问题",
  "play.ai.context.difficulty.challenge.brief":
    "{{brief}}这次给 AI 的材料只有{{capacity}}格，整份照搬装不下；需要保留能回答顾客的段落及其来源。",
  "play.ai.context.difficulty.challenge.goal":
    "用不超过{{capacity}}格材料，答清{{labels}}。重新生成后，让每位顾客实际试用这一版。",
  "play.ai.context.difficulty.challenge.authority":
    "{{authority}}本轮容量为{{capacity}}格，可按段摘取；不同来源对同一事实的适用性仍按上面的约定判断。",
  "play.ai.context.difficulty.challenge.hint":
    "{{hint}}预算只有{{capacity}}格。对照已经确认的副本，保留必要事实和来源，暂不装入后续故事或其他安排。",
  "play.ai.context.difficulty.serviceSuccess":
    "本轮{{count}}位顾客的问题都已在当前材料下实际验证。来源、材料包和试用记录已留下。",
  "play.ai.agent.difficulty.intro.title": "读材料，写一份{{draft}}",
  "play.ai.agent.difficulty.intro.brief":
    "虚构案例：让 Agent 读取「{{source}}」，再产出一份「{{draft}}」。这轮练习只负责读取和写草稿两个动作。",
  "play.ai.agent.difficulty.intro.authorization":
    "允许读取「{{source}}」并写出「{{draft}}」；原始材料保持原样。本轮到草稿为止，材料附注不增加授权。",
  "play.ai.agent.difficulty.intro.goal":
    "实际写出「{{draft}}」，同时保留「{{source}}」原样；工具只开放完成这两步需要的文件。",
  "play.ai.agent.difficulty.intro.hint":
    "先明确允许读取哪份材料。写草稿时再单独打开草稿的权限，读取许可不会自动变成写入许可。",
  "play.ai.agent.difficulty.intro.readTitle": "先读{{source}}",
  "play.ai.agent.difficulty.intro.readIntent": "确认「{{source}}」里的事实，再准备「{{draft}}」。",
  "play.ai.agent.difficulty.intro.writeTitle": "写出{{draft}}",
  "play.ai.agent.difficulty.intro.writeIntent":
    "在「{{draft}}」中写入本轮内容，「{{source}}」保持原样。",
  "play.ai.agent.difficulty.intro.writeTool":
    "能够覆盖被授权的文件。任务只需要写入「{{draft}}」，原始材料仍须保留。",
  "play.ai.agent.difficulty.challenge.title": "写好草稿，连续守住两处资料",
  "play.ai.agent.difficulty.challenge.brief":
    "{{brief}}这次有用的草稿步骤也夹带了一次对「{{public}}」的改写，前面处理过的范围不能代替这次检查。",
  "play.ai.agent.difficulty.challenge.goal":
    "{{goal}}本轮两次有用的写入分别混入对原始材料和公开区的修改；最后的预览必须来自实际生成的草稿。",
  "play.ai.agent.difficulty.challenge.authorization":
    "{{authorization}}每次写入都要单独核对目标，完成草稿不需要覆盖「{{public}}」。",
  "play.ai.agent.difficulty.challenge.hint":
    "{{hint}}后面的「{{draft}}」步骤还会尝试改动「{{public}}」。保留有用草稿，收回任务外目标，再用真实草稿生成预览。",
  "play.ai.agent.difficulty.challenge.writeTitle": "写好{{draft}}，并更新公开区",
  "play.ai.agent.difficulty.challenge.writeIntent":
    "这一步计划写好「{{draft}}」，同时把导入附注的内容写进「{{public}}」。检查两个目标，保留任务需要的部分。",
  "play.ai.agent.difficulty.success":
    "已完成本轮产物：{{outputs}}。{{protected}}保持原样，工具只保留任务范围，实际执行记录已留下。",
} as const;
