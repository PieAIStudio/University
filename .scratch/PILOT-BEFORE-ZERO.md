# Pilot before zero：写课技能评估报告

日期：2026-08-31
分支：work/pilot-before-zero
范围：turing-pact / foundations-before-zero / 第一个单元 what-is-an-app
结论：本轮 7 节课已经按当前源码重写并完成取证，但写课技能还没有达到可以直接复制到其余 30 门课的标准。它能稳定地把来源钉在不可变 snapshot 上，也能发现若干严重卡点；但它不能可靠地保证“答案不提前泄露”“术语在第一次需要前已经解释”“类比没有代替字面事实”，并且 model runner 把 14 次本来有最终文本的 Grok 运行报成了失败。Detector 和最终人工核验目前仍不可省略。

## 1. 执行记录

### 刷新

按 brief 的要求，第一次 dirty 门槛拒绝后使用了：

    pnpm university -- refresh prepare --study turing-pact --acknowledge-dirty-excluded

这不是清理外部仓库。/Users/yuanfei/PieAI/TuringPact 没有被提交、stash、丢弃或 fetch；它的未提交改动全部排除在分析之外。生成的不可变输入为：

- snapshot：git-3b43f0a645e4
- sourceCommit：3b43f0a645e4b24067b20a9bd7cee4715b8611b1
- sourceTree：688bc81ff9e22f70cad659d47773cffe39300561
- dirtyChangesIncluded：false
- UA：ua-3b43f0a6-v2-9-4-zh-full-e98206c7358f1ff1-bb00529cf6d5
- graphHash：sha256:5bcf21520e7a5b70337dbcb5fc64e362a716dc1ad85292b5e3fd7d2575473cc1

UA 完成了 881 个文件、1,200 条 import 边的扫描；最终图有 2,042 个节点和 4,075 条边，validator issues 为 0（另有 313 条 orphan warning）。refresh finalize 和 audit 均完成；audit 将课程及目标单元标为 stale。按 brief 的范围，本轮没有擅自 re-activate 或发布它。

### 重写范围

只改了第一个单元的 7 节课，没有改课程小时数、catalog 数字、其他单元或其他课程。最终 revision 和配套件如下：

| lesson | 正文 revision | card / exercise 最新 revision |
| --- | ---: | --- |
| you-already-know-apps | r10 → r13 | app-means-application r12；readme-product-one-liner r12；product-name-from-readme r12 |
| app-is-a-pile-of-files | r14 → r17 | entry-file-name r10；title-tag-meaning r10；doctype-first-line r10 |
| empty-box-called-root | r5 → r6 | main-finds-root r4；root-id-value r4；root-div-line r4 |
| same-product-many-shells | r6 → r8 | cap-app-name r6；cap-webdir r6；cap-app-id r6 |
| product-sentence-and-gate | r4 → r5 | current-path-web r4；shells-not-in-gate r4；validation-path-word r4 |
| from-icon-to-files-journey | r8 → r10 | outdir-name r9；dev-script-value r9；build-script-name r9 |
| why-so-many-files-preview | r7 → r8 | index-css-imports r6；src-means-source r6；pkg-name-value r6 |

### 真实媒体

旧媒体来自旧 source commit，不能只改 metadata 对齐，所以重新取了像素：

| asset | 取证状态 | 文件 |
| --- | --- | --- |
| turing-pact-project-folder | 固定 checkout 的 Finder 图标视图；README.md、package.json、src、index.html 同屏可见；687×435；sha256:63a5dd7791516cda07c2a8e4239e96e1253ac90d60ea6860e6e060b4ef8a49ca | you-already-know-apps |
| turing-pact-daily-result | 固定 checkout 的 /daily；英文界面；第一名候选人已选；结果面板展开；2880×1800；sha256:a98a3fd17d13b33c59bb5365c662237a560f1cbf4ee2ce3ac983f9ea08cdbed4 | app-is-a-pile-of-files |
| turing-pact-daily-result-annotated-crop | 同一真实截图上按 DOM getBoundingClientRect 加三块标注；2880×1800；sha256:b23aceed249025ab75031160b650122864ba8b0959967468c4a2145df2742672 | app-is-a-pile-of-files |
| turing-pact-daily-button-focus | 对真实选中按钮做 selector screenshot；786×166；sha256:1130db92e323432a34ce446f53b1218456ab5e408ed4b3cc34cbe56240e1c19d | app-is-a-pile-of-files |

所有最终媒体的 sourceCommit 都是上面的固定 commit。页面取证用了 agent-browser；项目文件夹取证用了 Computer Use；没有用绘图或手工合成替代真实画面。

## 2. 四阶段管线的实际表现

执行顺序是 Grok 写 → Gemini Flash 检测 → Grok 修 → Gemini Flash 润色。写手和检测者是不同模型家族，符合 brief 的盲测约束。

### 一次运行情况

| 阶段 | 模型 | runner 报成功 | 实际结果 |
| --- | --- | ---: | --- |
| writer | grok-4.6，high | 0/7 | 7/7 子进程都有可用最终课文，但全部因 stdout 中进度文本和 H1 粘连，被 runner 的 H1 解析器报 failed |
| detector | gemini-3.7-flash-high，high | 7/7 | 7/7 有检测报告 |
| fixer | grok-4.6，high | 0/7 | 7/7 子进程都有可用修订文本，但同一个 H1 解析问题再次造成假阴性 |
| polisher | gemini-3.7-flash-high，high | 7/7 | 7/7 有润色文本；其中 2 份未通过 hedge gate，被丢弃 |

app-is-a-pile-of-files 的 writer 第一次还到达 900,029 ms 超时，随后重试 778,190 ms；receipt 的总耗时是 1,678,221 ms。其余 writer 没有第二次尝试。这里的失败不是模型没有产出，而是 runner 没能从混有进度日志的 stdout 解析最终 H1。这个区别必须进入技能的真实 pass rate，不能把它掩盖成 7/7 成功。

### 每节课的耗时

receipt durationMs 换算为分钟，app 的 writer 包含 timeout + retry：

| lesson | writer | detector | fixer | polisher |
| --- | ---: | ---: | ---: | ---: |
| you-already-know-apps | 12.34m | 1.14m | 8.14m | 0.81m |
| app-is-a-pile-of-files | 27.97m | 1.07m | 13.35m | 0.74m |
| empty-box-called-root | 9.31m | 1.06m | 7.87m | 1.32m |
| same-product-many-shells | 10.80m | 1.15m | 10.50m | 0.75m |
| product-sentence-and-gate | 12.60m | 1.07m | 11.18m | 0.75m |
| from-icon-to-files-journey | 14.51m | 1.07m | 7.72m | 2.20m |
| why-so-many-files-preview | 14.00m | 1.25m | 12.28m | 0.82m |

### hedge gate

5/7 份润色被采用，2/7 份被丢弃：

- you-already-know-apps：让步词 3 → 4，但绝对词 0 → 1，并产生不成对的“只要……才”；丢弃。
- app-is-a-pile-of-files：让步词 3 → 3，但产生同样的“只要……才”；丢弃。
- empty-box-called-root：通过，1 → 1。
- same-product-many-shells：通过，3 → 3；最后仍按人工核对移除了泄漏和不受证据支持的句子。
- product-sentence-and-gate：通过，1 → 1。
- from-icon-to-files-journey：通过，12 → 12；人工把“千万别”收成“别”。
- why-so-many-files-preview：通过，7 → 7；人工删除了超出允许源码范围的 product.css 细节。

hedge gate 实际挡住了两个有风险的结果，但它只看让步词和绝对词，不能判断答案泄漏、术语时序或代码事实。

## 3. 七节课的改前 / 改后对照

这里的“同一段”指同一个“先猜一下 → 答案”位置，而不是保留旧题目。改前版本来自刷新前的最新 revision，改后是最终提交 revision。

### you-already-know-apps：r10 → r13

改前：

> 如果你只会在屏幕上点开图灵密约，却不知道控制某个按钮文字的文件在哪里，你能不能自己把这个按钮改掉？为什么？
>
> 不能。因为你不知道控制按钮文字的文件在哪里，就没有可以下手修改的入口；只会在屏幕上点 App，不会让你找到并改动项目里的文件。要自己改掉它，至少要进入项目文件夹，找到负责这个按钮的文字或代码，改完再运行看结果。

改后：

> 有人改了项目文件夹里 README.md 的字，你只是重新点开手机或电脑上的图灵密约图标。屏幕上某个按钮上的字，会不会变成 README.md 里新写的那些字？为什么？
>
> 不会。你点图标打开的是已经做好的界面，而 README.md 是写给做的人看的说明；改这份说明，不会让屏幕上的按钮字跟着变。

变化：把“找不到文件所以不能改”的抽象题，换成 README 与已做成界面的直接对照；最终只保留一个可由前文事实推理出的区别。

### app-is-a-pile-of-files：r14 → r17

改前：

> 如果做的人手上没有这些能打开、能改的文字文件，他还能不能把标签页上那个名字改掉，然后自己先看一眼改得对不对？
>
> 不能。他手上就只剩下你手机上那个已经做好的成品了，而成品是不给改的。要改那个名字，必须回到 index.html 这份文字文件里，改完再重新打开页面看一眼。

改后：

> 打开 src/pages/DailyPuzzlePage.tsx 第 396 到 499 行，你会看到文字对话和候选人按钮都挤在这一大段里。如果有人把这一整段都说成放大图里那一个候选人按钮的对应代码，他找对了吗？
>
> 不是。那一个候选人按钮的定义，大约在 src/pages/DailyPuzzlePage.tsx 第 476 到 513 行附近；第 396 到 499 行只是让你打开查看的更大一段，里面还装着对话和其他界面。

变化：让预测题兑现标题“按钮对应哪几行”，并让答案区别“可核对的大范围”与“真正要改的小范围”。

### empty-box-called-root：r5 → r6

改前：

> 满屏界面，是从哪一步被「填」进这个空盒子里的？
>
> 浏览器加载 src/main.tsx 之后，程序按名字找到这个空盒子，再把整棵界面画进去。

改后：

> 满屏界面，究竟是从哪一步被「填」进这个空盒子的？
>
> 浏览器执行 src/main.tsx 之后，那份文件会按名字找到这个空盒子，再把你看到的整页界面填进去。

变化：先解释 id="root" 与 #root 的关系，再解释 ReactDOM.createRoot 和 App；答案不再引入“整棵界面”这个没有字面说明的表达。

### same-product-many-shells：r6 → r8

改前：

> 你猜：把打开方式从浏览器换成手机壳，而壳仍去同一个打包好的网页目录取内容——你玩到的按钮、聊天和玩法，会变成另一整套产品，还是大体仍是同一套？
>
> 大体仍是同一套：同一份产品内容，套了不同的外壳。配置把手机壳指到打包好的网页目录；README 则说明当前主推的是网页这条路。

改后：

> 打开方式从浏览器换成手机壳，而壳依然去配置里写的网页文件夹拿内容——点开之后，里面的按钮、聊天和玩法会怎么变？
>
> 大体仍是同一套。壳换掉的是打开方式，并不是另做了一套按钮、聊天和玩法。

变化：去掉答案里提前给出的 README / 主推路线信息，题目只让读者预测“换壳是否等于换产品”。

### product-sentence-and-gate：r4 → r5

改前：

> 在「仓库里装了不少东西」的前提下，你会把第一段学习时间压在「先打包进 iOS / Android」上，还是压在别的地方？你凭什么这么选？
>
> README 已经替项目选好了：当前商业验证主路径是公开网页试点（public Web pilot）；Capacitor 与 Electron 壳仍在仓库里，但不是当前发布门禁的一部分。先跟 Web。

改后：

> 仓库里网页、手机、桌面的配置都在。你会把头一阵时间压在「先把游戏装进 iPhone / Android」上，还是别的地方？凭什么这么选？
>
> README 已经替项目选好了：当前主路径是公开网页。先跟着网页走。

变化：答案从一整段路线术语压缩成先做的选择；public Web pilot、Capacitor、Electron、release Gate 放到答案之后再逐个解释。

### from-icon-to-files-journey：r8 → r10

改前：

> 用户最终打开的那份界面，更像是你正在编辑的源文件「原样送出去」，还是中间还要经过一道「加工成可分发形态」的步骤？如果有那一步，这个项目里产物目录叫什么名字？
>
> 中间要经过构建：源文件被加工成可分发的形态，这个项目的输出目录叫 dist。开发时另有一条 dev 路径，用 Vite 做即时预览，但那仍然不是「把源文件原样当成最终交付」。

改后：

> 你只改了源文件，还没跑构建——已经交给壳或浏览器的那份成品，会不会自己变成你刚改的样子？为什么？
>
> 不会自己变。已经交给壳或浏览器的那份成品，是上次构建写出去的，并不是你手头正在改的源文件。

变化：预测题先问“已交付成品会不会自己更新”，把构建、dist、dev 的定义移到推理之后。

### why-so-many-files-preview：r7 → r8

改前：

> 为什么不把这些全塞进同一个文件，而要拆成上面这样？
>
> 拆开是为了各司其职：入口、启动、样式、项目身份分开放，方便你查找和单独修改——不是项目坏了。

改后：

> 把这四处全塞进同一个文件，明天你只改其中一件事——比如只改项目登记名——会更好找，还是更难找？为什么？
>
> 更难找。挤在一份里，改个登记名也得在不相干的行里翻；分开放，打开清单那一份就行。

变化：把“为什么拆开”的结论，改成“明天只改一件事时会怎样”的可想象后果；删除了没有必要的“不是项目坏了”安抚。

## 4. 写课技能实际生效的地方

### 4.1 不可变来源与证据门槛是真正有效的规则

refresh 的 snapshot、UA、graphHash 和 sourceCommit 被沿用到正文、card、exercise。最终人工/脚本核对结果是：

- 正文 manifest：19/19 条 evidence 的 snapshot、commit、analysis、graphHash、路径和行号都有效。
- card / exercise：21/21 条 evidence 都有效。
- 合计：40/40 条 artifact evidence 解析到固定 snapshot；0 条最终源码路径或行号编造。
- 正文里的 evidence 标记：22 次出现，18 个唯一锚点，0 次与本节 manifest 不匹配。
- 最终媒体：4/4 个文件的 sha256 与 bytes 与 manifest 相符。

这条规则还实际暴露了旧媒体问题：旧截图来自旧 commit，不能靠改描述解决，于是重跑了 /daily 和 Finder 取证。没有 sourceCommit + 像素 hash，这个问题会被“看起来一样”的 metadata 掩盖。

### 4.2 双模型家族让检测者发现了写手不会自检的问题

app-is-a-pile-of-files 的 Detector 明确指出两类具体问题：

- detail 标题“页面身体”在正文还没有使用这个词前就出现；
- evidence 396-499 在真实源码中截断了候选按钮，完整按钮实际延伸到约 476-515；544-581 也从桥接区开始，不能完整覆盖结果卡。

这两条都不是单纯的错别字检查。最终课文去掉“页面身体”这个提前的标题，改成先解释入口文件；预测题改为大范围和按钮小范围的区别；同时人工读了真实的 476-515，而不是只相信旧证据描述。不同家族的检测确实产生了增量。

### 4.3 结构规则能守住基本教学骨架

最终 7 节都保留了一个明确的“先猜一下”与“答案”顺序、练习邀请、一个“一句话”收束；detail 标题都用问题形式。尤其是 app-is-a-pile-of-files，原来的题目与标题不一致，Detector 找到后被改成直接围绕候选人按钮的行号。

但这只是骨架通过，不等于内容自然。same-product-many-shells 和 product-sentence-and-gate 的答案泄漏，正是在骨架仍然正确时发生的。

### 4.4 hedge gate 有可观察的保护作用

本次它准确挡住了 you 和 app 两个润色结果。若只看润色后的口语流畅度，这两份可能会被直接采用；但“只要……才”把必要条件写成了不成对的句子，且 you 还新增了绝对词。这个 gate 值得保留，但它只能作为窄门，不能被当成完整质量检查。

## 5. 写了但没有可靠生效的规则

### 5.1 “答案不得在猜测前泄露”目前只是意图，不是闸门

Detector 找到 same-product-many-shells 的正文已经说“这些壳虽然留在了项目里，但不在当前发布门禁里”，也找到 product-sentence-and-gate 的正文已经说“能看到手机和桌面配置……你时间有限”。这些话虽然没有逐字写最终答案，却把预测应该发现的路线优先级先说完了。

更严重的是，Grok fixer 仍然留下过“看见壳的配置……不证明今天该先跟它”这一类答案提示。最终是人工删除了泄漏，而不是规则自动阻止了它。检测规则太像关键词检查，模型也能用换一种说法继续泄漏。

### 5.2 “字面事实先于类比”没有阻止新术语和隐喻抢跑

实际输出里出现过这些顺序问题：

- you 的“项目文件里的四类文件”把 src 说成四类文件之一，但 src 是文件夹；README 还被前后重复定义。
- app 的“页面身体”在正文没有先引入；标签页、HTML 标签和尖括号记号的关系讲得太晚。
- empty 的 #root 没有先解释井号只是习惯写法；答案用了“整棵界面”；ReactDOM、React、App、<App /> 的关系不完整；type="module" 又引入了未展开的 module。
- from 的旧稿在解释前就把 dist 当成读者已知答案；shell / 外壳的物理比喻也可能把“打开方式”混成手机保护套。
- why 的版本曾把 import、ReactDOM、App 混在同一个 detail 里。

Detector 能把这些问题列出来，但 fixer 没有稳定地把“首次出现点”与“第一次需要点”重排好。最后的 #root、ReactDOM、按钮范围等修复依靠人工阅读，不是技能中的确定性规则。

### 5.3 “证据存在”不等于“证据范围足够支撑这句话”

app 的最终正文说按钮约在 476-513，但为了保留 brief 和既有 evidence 结构，正文标记仍是较宽的 396-499。这个范围能证明“这一带包含候选按钮”，却不能单独证明完整按钮的闭合与文字内容。人工查看 476-515 才补上了这个差距。

why 的 product.css 也是真实源码里的第 7 行，但允许的 evidence 只有 src/index.css:1-6；把它写进正文就是超出本课证据范围，虽然不是捏造路径。最终删除了这句。当前技能能检查“路径和行号存在”，却不会自动判断“作者声称的粒度是否比引用更细”。

### 5.4 runner 的 H1 解析器造成系统性假阴性

7 个 writer 和 7 个 fixer 的 Grok 子进程都退出 0，并保留了最终 markdown；但 runner 看到进度文本和 H1 在 stdout 粘在一起，就报“model stdout did not contain a Markdown H1 final answer”。因此报告必须同时保留：

- runner pass rate：writer 0/7，fixer 0/7；
- 子进程有最终文本：writer 7/7，fixer 7/7。

这是可以避免的工程缺陷，不是内容质量的证据。若下一轮不先修 runner，所有课程的统计都会被污染，技能会被误判为“写不出来”或被迫手动恢复输出。

## 6. 技能没有管到、但本轮暴露出来的问题

### 6.1 初学者会在哪里停下来，没有被结构化记录

最终课文已经改善了主要停顿，但流程没有输出每节课的“第一处未解释术语”。本轮人工能指出：

- empty 在 type="module" 处仍然选择“先不用纠结”，这是一种有意延期，但没有记录读者下一步何时再得到 module 的字面解释。
- app 的文件路径和“更大范围 / 按钮小范围”的差异需要读者回看 476-515；旧引用的 396-499 不足以独立完成核对。
- same 的 webDir、壳、发布门禁虽已补 detail，但它们都在同一短段集中出现，仍需要读者把配置字段和产品路线分开记忆。

技能现在记录“有没有 detail”，没有记录“读者第一次遇到这个词时能不能用前一句理解它”。

### 6.2 语义事实的支持范围不是自动审计对象

最终没有留下代码事实编造，但中间出现过两个应当被单独计数的问题：

1. same 的润色稿写过“新的 dist 还没打包出来时，壳拿到的依然是上一份成品”。这句话有工程上的可能性，但当时没有被相邻 evidence 直接支持，后来删除。
2. why 的 product.css 真实存在，但不在本课允许的 1-6 行证据范围，后来删除。

这说明“路径存在”与“这句话被当前引用直接支持”是两项不同检查。当前技能只稳定做到了第一项。

### 6.3 课程状态与发布边界不属于写课技能的自检

本轮 audit 后课程保持 stale，正是因为内容已更新但还没有走 release / re-activate 门禁。write-lesson 只负责课文和配件，不负责决定何时发布；这是正确的边界，但报告与 pipeline 需要把它显式显示出来，否则下游会把 stale 误读成“课文生成失败”。

## 7. 哪一步最弱，哪一步可以省

### 最弱的工程步骤：model runner 的最终文本解析

它造成 14/14 的 wrapper 假阴性，且 app 还触发一次 15 分钟 timeout。应优先修复 stdout / final answer 的分帧和 receipt 语义；在此之前，任何“首次通过率”都不可信。

### 最弱的内容步骤：writer 的第一稿，而不是 Detector

第一稿反复带来答案泄漏、术语滞后、过宽或过细的证据叙述，以及把心理安抚做成 detail 的问题。Detector 在 7 节中给出了可操作的差异；它是本轮价值最高的一步。Fixer 能减少问题，但没有可靠地完成所有语义重排，最后仍需人工。

### 可以省掉或降级为可选的步骤：polisher

本轮 polisher 很快，5/7 份确实让口语更顺；但它没有增加证据真实性，且 2/7 份带来了 hedge gate 拒绝，另外几份仍需要人工删除泄漏或超范围句子。若下一轮目标是安全的 first pilot，polisher 不应作为自动采用步骤：应在 Detector/Fixer/人工 evidence gate 通过后再可选运行，或者直接省略。Detector、源码核对和最终结构检查不能省。

## 8. 编造代码事实与证据核对

最终产物中：

- 0 条最终 path/line code-fact fabrication。
- 40/40 条正文、card、exercise evidence 的 snapshot、commit、analysis、graphHash、path、range 均通过。
- 22 次正文内引用全部映射到本节 manifest，0 次 mismatch；按 path + range 去重后 18 个唯一锚点。
- 人工特别核对了 app 的 DailyPuzzlePage.tsx 476-515：按钮从候选列表生成，实际 button 在约 488 行开始；396-499 只是更大的可读范围，不能冒充完整按钮范围。
- 旧稿或中间稿的 2 个问题被删除，而不是带进最终版本：无相邻证据的 stale dist 句子，以及超出允许 1-6 行引用范围的 product.css 句子。

“0 条最终编造”不能被解释成“模型自己已经可靠核对”。它是人工源码核验、固定 snapshot 和最后一次 evidence reconciliation 共同得到的结果。

## 9. 验证结果

### 目标范围检查

- 7/7 目标 lesson 通过 scoped lesson lint。
- 目标 lesson 的 hedge check：7/7 通过。
- 全库 lesson lint 仍有 1 个与本轮无关的存量问题：turing-pact / hooks-catch-before-history 的 detail 正文 1,108 字、标准正文 1,852 字，占 60%，触及下限；目标 7 节不在该失败项中。
- 全库 anchor check 扫过 362 节课、479 个 anchored code blocks；9 个问题全部在其他课程/单元，另有 9 条 informational added comments；目标单元没有 mismatch。

### pnpm verify

已从仓库根目录运行 pnpm verify。以下阶段通过：

- typecheck
- lint
- format:check
- generated-format
- 全 workspace tests
- module boundaries、kit portability、contrast、raw colours、shared styles、i18n
- canvas registry、review card registry、experience ledger
- 双模式 delivery / authoring build
- shelf
- content revisions

verify 在 check-export-freshness 停止，唯一阻断是：

    turing-pact — re-export failed: Study default course is not active: foundations-before-zero

这不是本轮意外写坏了 export；它是 refresh audit 后保持 stale、尚未发布的直接结果。为了让 verify 变绿而 re-activate 会违反 brief 的“重写第一个单元，然后停下来交报告”，所以没有这样做。verify 尚未到达的尾部检查已单独执行并通过：

- check:lesson-links：PASS
- bundle：PASS
- docs:check：PASS，86 docs、88 current files、14 local links、0 warning

## 10. 交付与边界

报告文件是本文件 .scratch/PILOT-BEFORE-ZERO.md；7 节正文、card、exercise 和 4 个最终媒体与它一起提交。没有修改写课技能本身，没有触碰其他课程或单元，没有修改 course-hour 数字，没有部署，也没有 push。

仓库在本任务开始前已经存在的 island-art-reference 删除与 v1/v2 未跟踪目录被原样保留，没有暂存。最终提交只包含本报告和本轮第一个单元的明确产物；commit SHA 以本次 git 提交记录为准。
