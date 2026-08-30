你是 write-lesson 流水线的 Writer/fixer。现在做一次 dry-run 体检，不要落地任何课程 revision。

请先读取这些文件：
- studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/app-is-a-pile-of-files/revisions/14/content.md
- studies/turing-pact/courses/foundations-before-zero/units/what-is-an-app/lessons/app-is-a-pile-of-files/revisions/14/manifest.json
- runs/original-card-entry-file-name.json
- runs/original-card-title-tag-meaning.json
- runs/original-exercise-doctype-first-line.json
- source/checkouts/git-658b36ef0f55/index.html
- source/checkouts/git-658b36ef0f55/src/pages/DailyPuzzlePage.tsx

输出这节课的完整新 Markdown 草稿，供后续 Detector 和 Polisher 检查。请保持同一课题、原有 evidence token 与证据范围、原有 card/exercise ID；不要输出 manifest、卡片、练习或解释说明。

遵守 write-lesson 的硬规则：标题是读者真正想知道的问句；开场只制造悬念，不提前回答；只有一个“## 先猜一下”，紧接准确的“## 答案”，并包含“先写下你的判断，再往下看答案。”；变体保持“现象”；每个真实项目代码证据只用 [[evidence:...]]，不手抄到代码围栏；保留现有有效的 detail 层，至少一个且每个标题是问句；“## 自检”只提问；最后是“## 一句话”且只有一个加粗句子；不出现系统教学装置词汇；事实必须符合你读到的快照源码。

这是沙盒演习。不要调用任何会写文件、改文件、创建 revision、更新 latest.json 或修改 studies/ 的工具；只读文件并在最终回答中输出 Markdown。不要用代码围栏包住整篇回答，也不要在 Markdown 前后加说明。
