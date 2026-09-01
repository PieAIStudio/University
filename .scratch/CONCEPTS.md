# 概念正文架构事实修订记录

## 范围与结果

本次只改了以下三个学习者正文文件；没有改测试、`packages/ui`、`packages/world`、`apps` 或 `apps/local/studies`：

- `packages/core/src/concepts/data/technology.ts`
- `packages/core/src/concepts/data/backend.ts`
- `packages/core/src/concepts/data/frontend.ts`

基线中 `apps/online` 在这三个文件里共有 12 个命中（technology 7、backend 3、frontend 2）；修订后 `rg -n "apps/online" packages/core/src/concepts/data/` 为 0。没有新增教学例子，也没有改变比喻、练习节奏或互动结构。

## 12 个架构事实命中

以下“改前/改后”是对应字段的完整正文字符串。12 项都属于针对原句的语义重写；其中标出的“例子结构调整”只说明为了让原有比喻继续成立而改了例子的对应物，不是新增教学法。

### technology.ts（7 项）

1. `technology.ts:352`，npm 概念 `plain[1]`。完整段落重写；例子从“两套应用”改为“一个浏览器应用的两种模式”。

改前：

```text
University 是一个用 pnpm 管起来的大项目：apps/local 给老师离线写课，apps/online 给学生用、带 3D 世界地图，共用 packages/core 里不管长什么样的规则，和 packages/ui 里的界面零件（用 React 搭，React 是一套把界面拆成可复用零件来写的方法）。音效来自 npm 上的 uisfx，不往项目里塞 mp3。界面、颜色、问 AI 分别走 SwimmerUIKit、SwimmerRenderKit、SwimmerAIKit 三个共用包，不在这个项目里重写——这和「能用现成的就不要手拷一份」是同一条原则。
```

改后：

```text
University 是一个用 pnpm 管起来的大项目：浏览器应用 apps/university 有 authoring 和 delivery 两种模式，前者给老师在本机写课，后者给学生用、带 3D 世界地图；两种模式共用 packages/core 里不管长什么样的规则，和 packages/ui 里的界面零件（用 React 搭，React 是一套把界面拆成可复用零件来写的方法）。音效来自 npm 上的 uisfx，不往项目里塞 mp3。界面、颜色、问 AI 分别走 SwimmerUIKit、SwimmerRenderKit、SwimmerAIKit 三个共用包，不在这个项目里重写——这和「能用现成的就不要手拷一份」是同一条原则。
```

2. `technology.ts:512`，build 概念 `plain[1]`。完整段落重写；保留“文件夹不能双击当网站”的原有例子。

改前：

```text
University 有两个要打开的界面：apps/local 给老师离线写课，apps/online 给学生用。两边都得变成浏览器能打开的东西，才能在自己电脑上预览。他们具体用哪一种构建程序，公开事实没写，这里不编。你自己的报名页也一样：不要假设「文件夹在，双击就能当网站」。
```

改后：

```text
University 的 apps/university 是一个浏览器应用，分别用 authoring 和 delivery 两种模式构建；authoring 给老师在本机写课，delivery 给学生用。apps/local 只是读磁盘的 Node 服务，不是要构建成页面的第二个应用。你自己的报名页也一样：不要假设「文件夹在，双击就能当网站」。
```

3. `technology.ts:1858`，regression 概念 `plain[1]`。完整段落重写；把“改一处、两边都可能坏”准确落到同一应用的两个模式。

改前：

```text
跟 AI 做东西，这是高频事故。它为了导出名单，改了八个文件，提交报名的那一段被顺手写坏。University 已交付 52 门课、560 节课文，论断还挂着 1815 处出处；改 packages/core 里的规则时，老师端 apps/local 和学生端 apps/online 两边都会吃到。公开事实没写他们的回归测试长什么样，这里不编。但「改一处、两边都可能坏」是真的。
```

改后：

```text
跟 AI 做东西，这是高频事故。它为了导出名单，改了八个文件，提交报名的那一段被顺手写坏。University 已交付 52 门课、560 节课文，论断还挂着 1815 处出处；改 packages/core 里的规则时，apps/university 的 authoring 和 delivery 两种模式都会吃到。公开事实没写他们的回归测试长什么样，这里不编。但「改一处、两种模式都可能坏」是真的。
```

4. `technology.ts:2541`，tech-stack 概念 `plain[1]`。完整段落重写；保留“真清单”与“能共用的不写两遍”的例子。

改前：

```text
University 自己的组合很具体，可以当一份真清单看。同一个项目里放两个要打开的界面：apps/local 给老师离线写课、完全不联网；apps/online 给学生用，主界面是一张 3D 世界地图，每座岛一门课。两边共用 packages/core 里只负责规则、不管长什么样的代码，和 packages/ui 里的 React 零件。问 AI 走 SwimmerAIKit，音效用 npm 上的 uisfx。你从这张清单里能读出一条原则：能共用的不写两遍，能用现成包的不在这个项目里重写。
```

改后：

```text
University 自己的组合很具体，可以当一份真清单看。同一个项目里放一个浏览器应用 apps/university，按两种模式工作：authoring 给老师在本机写课，delivery 给学生用，delivery 的主界面是一张 3D 世界地图，每座岛一门课。两种模式共用 packages/core 里只负责规则、不管长什么样的代码，和 packages/ui 里的 React 零件。问 AI 走 SwimmerAIKit，音效用 npm 上的 uisfx。你从这张清单里能读出一条原则：能共用的不写两遍，能用现成包的不在这个项目里重写。
```

5. `technology.ts:3044`，React 概念 `variants[0].when`。单句事实重写；“两个应用共用”改成“一个应用的两个模式共用”。

改前：

```text
University 的做法：apps/local 和 apps/online 都从 packages/ui 引用 React 组件。
```

改后：

```text
University 的做法：apps/university 的 authoring 和 delivery 两种模式都从 packages/ui 引用 React 组件。
```

6. `technology.ts:3084`，React 概念 `plain[1]`。完整段落重写；保留组件共用、React Three Fiber、相机和 DOM 文字的原有教学内容。

改前：

```text
University 把这套用满了。packages/ui 里是 React 组件，离线的老师工具 apps/local、带 3D 课岛的 apps/online 共用这一份。学生端那张世界地图用 React Three Fiber 画——用写 React 的方式去画 3D。相机从斜上方往下看，角度锁死：世界地图 54°、课程地图 50°，能看到的范围 34°，禁止旋转，双指是平移不是缩放，照的是地图软件的习惯，不是游戏的习惯。
```

改后：

```text
University 把这套用满了。packages/ui 里是 React 组件，apps/university 的 authoring 和 delivery 两种模式共用这一份。delivery 模式的世界地图用 React Three Fiber 画——用写 React 的方式去画 3D。相机从斜上方往下看，角度锁死：世界地图 54°、课程地图 50°，能看到的范围 34°，禁止旋转，双指是平移不是缩放，照的是地图软件的习惯，不是游戏的习惯。
```

7. `technology.ts:3092`，React 概念 `prompt`。完整提示词重写；任务仍是做一个共用 React 组件，只有架构边界改为一个应用的两种模式。

改前：

```text
University 有两个界面：apps/local（老师离线写课）和 apps/online（学生用，有 3D 课岛）。请把「复制为 Markdown」做成一个 React 组件，放进 packages/ui，两个应用都引用这一份。词义索引的搜索框把当前输入放在组件自己记住的值里，输入变化时列表同时匹配英文、中文、使用场景、初学者说法，不要整页刷新。3D 地图继续用 React Three Fiber；所有能读的字用普通网页元素，不要画进 3D。不要引入 Vue。
```

改后：

```text
University 的 apps/university 有 authoring 和 delivery 两种模式。请把「复制为 Markdown」做成一个 React 组件，放进 packages/ui，两个模式都用这一份。词义索引的搜索框把当前输入放在组件自己记住的值里，输入变化时列表同时匹配英文、中文、使用场景、初学者说法，不要整页刷新。3D 地图继续用 React Three Fiber；所有能读的字用普通网页元素，不要画进 3D。不要引入 Vue。
```

### backend.ts（3 项）

8. `backend.ts:1160`，port 概念 `plain[2]`。完整段落重写；这是唯一调整例子结构的地方：把旧的“两套页面”改成真实的浏览器应用与 4317 Node 服务两扇门，保留端口“几号铺/门”的比喻。

改前：

```text
University 项目里有两套页面：老师离线写课的 `apps/local`，学生用的 `apps/online`。在你电脑上同时跑的时候，一定是两扇不同的门。别把老师端的地址发给要看 3D 世界地图的人。
```

改后：

```text
University 项目里只有一个浏览器应用 `apps/university`，用 authoring 和 delivery 两种模式构建；`apps/local` 现在只是读磁盘、跑在 4317 端口的 Node 服务，不是老师要打开的页面。你在电脑上同时跑应用和服务时，两个地址仍是两扇不同的门。别把服务地址发给要看 3D 世界地图的人。
```

9. `backend.ts:3101`，authorization 概念 `plain[1]`。完整段落重写；保留“报名者/组织者权限”这个练习例子。

改前：

```text
University 老师写课用完全离线的 apps/local，学生用带 3D 世界地图的 apps/online，这是两套程序，不是「同一个账号里分了老师权限和学生权限」。公开事实没写他们怎么做角色，这里不编。你做报名后台时，报名者和组织者一定是两种权限，不要共用一个「登录了就能干所有事」。
```

改后：

```text
University 的 apps/university 是一个应用，按 authoring 和 delivery 两种模式构建；这两个模式不是「同一个账号里分了老师权限和学生权限」。apps/local 只是读磁盘的 Node 服务，不是老师页面。公开事实没写他们怎么做角色，这里不编。你做报名后台时，报名者和组织者一定是两种权限，不要共用一个「登录了就能干所有事」。
```

10. `backend.ts:4162`，deployment 概念 `plain[1]`。完整段落重写；保留“自家厨房/饭店出餐”和“本机能开不等于网上能开”的原有节奏。

改前：

```text
University 老师端 apps/local 完全离线，写课在自己电脑上完成，谈不上部署给全世界。学生要用的 apps/online 才需要放到网上。他们具体发到哪一家托管，公开事实没写，这里不编。你自己的报名页，记住：本机能开，只说明这一台机器能开。
```

改后：

```text
University 的浏览器应用是 apps/university：authoring 模式给老师在自己电脑上写课，delivery 模式给学生使用。要让学生在网上打开，部署的是 delivery 构建；apps/local 只是读磁盘的 Node 服务，不是学生页面。他们具体发到哪一家托管，公开事实没写，这里不编。你自己的报名页，记住：本机能开，只说明这一台机器能开。
```

### frontend.ts（2 项）

11. `frontend.ts:89`，frontend 概念 `variants[1].when`（并同步改了该变体名称）。完整句子重写；仍然用 3D 世界地图说明 delivery 的前端。

改前：

```text
apps/online。打开是一张 3D 世界地图，每座岛一门课，相机锁死俯角，禁止旋转。
```

改后：

```text
University 的 apps/university 用 delivery 模式构建。打开是一张 3D 世界地图，每座岛一门课，相机锁死俯角，禁止旋转。
```

12. `frontend.ts:115`，frontend 概念 `plain[0]`。完整段落重写；保留前端可见内容、uisfx 和声音配方的原有解释。

改前：

```text
University 其实有两层给人看的界面。老师写课用的那一版在 apps/local，完全离线，不联网也能改课文；学生上课用的那一版在 apps/online，打开是一张 3D 世界地图，每座岛一门课。你看见的字、按钮、地图、点击时的声音，都属于前端。声音还不是下载来的音频文件，是用 npm（一种安装别人写好的小包的工具）上的 uisfx，按一份声音配方在这台设备上当场做出来的。
```

改后：

```text
University 其实只有一个浏览器应用 apps/university，但它有两个模式：authoring 给老师在本机写课，delivery 给学生上课，打开是一张 3D 世界地图，每座岛一门课。你看见的字、按钮、地图、点击时的声音，都属于前端。声音还不是下载来的音频文件，是用 npm（一种安装别人写好的小包的工具）上的 uisfx，按一份声音配方在这台设备上当场做出来的。
```

## 同一示例中的联动修订

这些不是额外的架构命中，而是为了避免残留的“两套界面/两边”措辞造成病句或概念漂移而同步修订的同一教学字段：

- `technology.ts`：npm 变体说明改为“一个浏览器应用、多个共用包”；React 的口语引入、变体名称、3D 变体、`use`、React/Vue 对照，以及 React 练习的问题、选项和错误解释，都统一改成“authoring/delivery 两种模式共用”。
- `frontend.ts`：定义句改为“delivery 模式里的 3D 世界地图”，authoring 变体改为 `apps/university` 的 authoring 模式；这些调整只消除与旧双应用结构绑定的指代。

没有把某个外部系统、托管商、角色模型或回归测试实现写进正文；凡仓库查不到的事实仍保留“不编”的边界。

## 架构证据

修订依据来自仓库当前实现，而不是旧课文：

- `apps/university/package.json:5,8-14,28-33`：一个浏览器应用、authoring/delivery 脚本和共享包依赖。
- `apps/university/src/mode.ts:5-13,26`：通过 Vite mode 区分 `authoring` 与 `delivery`，导出 `AUTHORING`。
- `apps/university/src/ports/index.ts:4-16,36-66`：学习者界面只有一份；差异收敛在 AI 来源、课程材料来源、仓库访问三个 port 边界。
- `apps/local/package.json:5`：`apps/local` 是 authoring server，课程由 CLI 写入并从磁盘读取，浏览器在 `apps/university`。
- `apps/local/scripts/dev.mjs:5-13`：本地服务使用 4317 端口，浏览器半部在 `apps/university`。
- `packages/world/package.json:5,13`：3D 场景由共享 world 包提供给两个 shell 使用。
- `pnpm-workspace.yaml:4-6`：workspace 管理 `apps/*` 与 `packages/*`。
- 仓库中不存在 `apps/online`：`test -d apps/online` 与 `git ls-files 'apps/online/**'` 均无结果。

## 验证与技能记录

- `rg -n "apps/online" packages/core/src/concepts/data/`：0 命中。
- `git diff --check`：通过。
- core 的 typecheck、lint、format check、测试和 build：通过；测试为 49 个文件、421 个测试。
- delivery 模式真实浏览器检查：通过；React 概念页面显示新的 `apps/university`、`authoring`、`delivery`、`packages/ui` 文案，无旧路径。截图：[React 概念页面](/tmp/university-concepts-react-plain.png)。
- `pnpm check:lesson-links`、`pnpm bundle`、`pnpm docs:check`：通过。
- `pnpm verify`：执行到已知的 `check:export-freshness` 基线失败；原因是当前 export 仍包含已不 active 的 `turing-pact - structured-output-repair` 与 `platform-capabilities`，与本次概念正文无关。
- `pnpm check:catalog`：独立检查仍因当前 export 会取消发布 28 门已有课程而失败；没有执行它建议的 `--accept-removals`，以免扩大本次范围。

已按 `write-concept-entry` 的约束执行：Grok 与 Gemini 模型 preflight 均通过；本次是有仓库证据的窄范围架构事实修订，因此没有派发外部 Writer/Detector/Polisher，也没有运行只针对 hedge/polish/教学重写的 hedge gate。浏览器门和 core/schema 相关检查已通过。
