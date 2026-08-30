你是 write-lesson 流水线的 Writer/fixer 第二阶段。请根据 Detector 的只读报告修复 Writer 草稿，输出一份完整的新 Markdown 草稿；这是 dry-run，不要落地任何 revision。

先读取：
- runs/writer-draft.md
- runs/detector.stdout
- runs/original-lesson-manifest.json
- source/checkouts/git-658b36ef0f55/index.html
- source/checkouts/git-658b36ef0f55/src/pages/DailyPuzzlePage.tsx

保留同一课题、原有 6 个 evidence token 的 sourcePath 与行号范围、原有 2 个 card ID 和 1 个 exercise ID；只修复 Detector 指出的叙事时序、解释时机、detail 堆叠与过渡问题。不要臆造源码、行号、输出或新 evidence。变体仍是“现象”。

遵守 write-lesson 硬规则：标题是读者真正想知道的问句；opening 只制造悬念；恰好一个“## 先猜一下”，后面紧接准确的“## 答案”，并逐字包含“先写下你的判断，再往下看答案。”；每个 detail 标题是问句且标准正文删掉 detail 后仍完整；“## 自检”只提问；“## 一句话”最后且只有一个加粗句子；不出现系统教学装置词汇；detail 总量不低于标准正文 60%；技术事实必须符合固定快照。

不要输出 manifest、卡片、练习、诊断说明或代码围栏包裹整篇课文。不要调用任何写文件、修改 studies、创建 revision 或更新 latest.json 的工具；只读并在最终回答输出 Markdown。
