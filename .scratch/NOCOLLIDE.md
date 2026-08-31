# Nocollide 交付报告

分支：`work/nocollide`
范围：`.scratch/BRIEF.md` 指定的四条体验发现。
状态：四条均已修复，并写入 `e2e/experience-ledger.json` 的 `guardedBy`。

## 结论

这次修复没有隐藏右栏、伪造空状态、增加触控豁免、修改已有 axe baseline，也没有改课程内容或 `apps/local/studies/**`。

四条最终状态：

| 台账 ID | 状态 | 守卫 |
| --- | --- | --- |
| `fb5cf55b5d72` | `fixed` | `e2e/N.nocollide.spec.ts::N1 desktop · follow card 绕开展开的右栏` |
| `481ba66a489a` | `fixed` | `e2e/N.nocollide.spec.ts::N2 desktop · course-island 右栏只说当前课程的下一节` |
| `4b00935a7f69` | `fixed` | `e2e/N.nocollide.spec.ts::N3 phone · 提意见不盖账号目标或课文正文` |
| `32e56e57ec05` | `fixed` | `e2e/N.nocollide.spec.ts::N4 phone · lesson toolbar 工具单行且没有悬空标签` |

## 1. 桌面 follow card 被右栏切掉

### 根因与改法

右栏是浮在 canvas 上的 chrome，不是会为 follow card 自动让路的独立分栏。`controls.tsx` 之前把整块 canvas 交给 `placeLabels`，所以 aside 卡片仍可能落入右栏的矩形。

`packages/world/src/labels/labels.ts` 现在接受独立的 `obstacles`；`packages/world/src/camera/controls.tsx` 把实时读取到的 `.nav-rail`、`.app-shell__aside`、`.nextup`、`.tab-bar`、`.hint` 矩形传给它。摆放器只让 overlay 卡片绕开不透明 chrome，不把 overlay 变成邻近名称的 reserved label。这样既保留原有“打开卡片不让其它岛名跳动”的语义，也让卡片在可读的另一侧提前翻边。

没有再走台账记录的死路：不隐藏 `todaySection`。隐藏它会连收起胶囊一起删除，使原有的“不与收起胶囊重叠”检查失去意义。

### 实测几何与截图

改前（1280×640）：右栏 `x=944, y=80, w=320, h=544`；follow card `x=736.743, y=8, w=320, h=612`，两者重叠。
改后：右栏不变；follow card 翻到 `x=512.743, y=8, w=320, h=612`，`right=832.743`，不再重叠。

- [改前：课程卡落在右栏下面](./nocollide/before-picked-with-rail-1280x640.png)
- [改后：课程卡翻到右栏左侧](./nocollide/after-picked-with-rail-1280x640.png)

N1 用真实指针打开课程卡，并对“进入这门课”执行中心点和四个内缩角点的命中检查；不是 `element.click()`。

## 2. 进入 A 课后右栏仍推销 B 课

### 根因与改法

旧逻辑把地图的暂时导航焦点带进了课程页。用户从 Buzz 的地图焦点进入 TuringPact 课程后，URL 已经明确是 TuringPact，但右栏仍读取 Buzz 的全局 next lesson。

`apps/university/src/app/world-model.ts` 现在把 `course`、`lesson`、`settled` URL 中的 `studyId` 作为当前项目的权威来源；只有世界地图保留 transient navigation focus。`apps/university/src/app/study-context.ts` 在课程岛上用同一份 `nodes` 和 `courseProgressForNode` 找当前 `courseId` 的下一节。因此右栏仍然有真实待办内容，但内容属于当前课程。

没有把 `nextLesson` 置为 `null`：那会渲染假的“课程这边暂时没有待办”，只是把错误内容换成错误空状态。

### 实测内容与截图

改前：从 Buzz 焦点进入 `/turing-pact/bilingual-by-design` 后，顶栏仍显示 Buzz，右栏标题是 Buzz 的“为什么打开一个 URL 就到了整个工作区？”。
改后：顶栏显示 TuringPact，右栏显示当前课“为什么文案要拆成四个命名空间，而不是一张大表？”，并包含“ 双语不是翻译表 ”这一当前课程上下文。

- [改前：URL 已进课程但右栏仍是 Buzz](./nocollide/before-course-after-buzz-focus-1280x640.png)
- [改后：右栏跟随当前 TuringPact 课程](./nocollide/after-course-current-context-1280x640.png)

N2 的切换、选岛、进课均使用真实指针；随后断言 URL、系列触发器和右栏文案一致。

## 3. 手机“提意见”浮钮遮挡账号和课文

### 根因与改法

旧的右下角浮钮在 375×812 的账号表单和课文正文上仍占用内容空间。改前实测已配置账号的密码框为 `x=29, y=708.875, w=317, right=346`；浮钮为 `x=276.4375, y=695, w=86.5625, right=363`，确实重叠。

`packages/ui/src/feedback/FeedbackNote.tsx` 增加 `account` / `lesson` surface 标记和无障碍 `aria-label`。`packages/ui/src/feedback/feedback-note.css` 在手机上对这两个 surface 使用 44×44 的 icon-only 浮钮，并给账号表单、课文正文预留匹配的 `56px` 右侧安全区；会员页原有位置和入口不改变。改后账号密码框宽度收缩到 `261px`、right 为 `290`，浮钮为 `x=319, w=44, right=363`，不再重叠；课文可见文字块也没有与浮钮相交。

这不是把按钮隐藏或移出产品：反馈入口仍可见、五点可命中；只是对两个内容密集 surface 使用紧凑形态，并让内容知道固定控件占的安全区。

### 实测几何与截图

- [改前：账号密码框与浮钮重叠](./nocollide/before-account-configured-phone-375x812.png)
- [改后：账号密码框保留安全区](./nocollide/after-account-phone-375x812-configured.png)
- [改前：课文页浮钮覆盖正文区域](./nocollide/before-lesson-phone-375x812.png)
- [改后：课文正文与浮钮分离](./nocollide/after-lesson-phone-375x812-configured.png)

N3 对账号页和课文页的反馈浮钮分别执行五点命中；账号目标严格要求真实可见的 `input[name=password]`，再检查矩形不重叠；课文检查所有当前可见的段落、标题、列表和强调文字。

## 4. 手机 lesson toolbar 换行、标签悬空

### 根因与改法

375px 宽度下，工具区仍携带不必要的“讲解层级”文字；可见标签和分段控件共同参与布局，造成标签悬空及工具行被挤开。

保留 `packages/ui/src/lesson/lesson-toolbar.css` 已有的触控下限：标准/详细分段选项仍是 `min-width: 44px`。手机端隐藏冗余 `.lesson-toolbar__label`，工具区保持 `nowrap`，因此控件仍是可触控的一行，不靠压缩触控目标来换排版。

改后在 375×812 实测：标签宽度为 `0`；工具控件中心线最大 y 差不超过 `1px`；控件没有越出 tools；分段选项宽度均不小于 `44px`。N4 对每一个可见工具按钮执行五点命中。

- [改前：顶栏工具区出现两排/悬空标签](./nocollide/before-lesson-phone-375x812.png)
- [改后：工具区保持单行](./nocollide/after-lesson-phone-375x812-configured.png)

## 五点命中与浏览器实测输出

`e2e/N.nocollide.spec.ts` 直接复用了 `e2e/harness/experience.ts::assertHittableAtFivePoints`。它用真实指针坐标检查中心和四个内缩角点，并通过 `document.elementsFromPoint` 确认最上层命中的是控件本身或其后代。

针对 N1–N4 的真实 Chrome 运行结果：

```text
Running 4 tests using 1 worker
✓ N1 desktop · follow card 绕开展开的右栏
✓ N2 desktop · course-island 右栏只说当前课程的下一节
✓ N3 phone · 提意见不盖账号目标或课文正文
✓ N4 phone · lesson toolbar 工具单行且没有悬空标签
4 passed
```

相关原始浏览器截图均为 dev server 实拍，尺寸写在文件名中；没有用 DOM 的 `element.click()` 代替指针证据。

## 攻击测试：每个改动先红、还原后绿

每个临时缺陷都只在本地工作树中制造，确认红灯后立即还原，再运行同一守卫确认绿灯；临时缺陷没有进入 commit。

| 守卫 | 制造的缺陷 | 红灯原文 | 还原后的绿灯 |
| --- | --- | --- | --- |
| labels 单测 | 移除 `controls.tsx` 传入的 `obstacles: [...chromeBoxesRef.current]` | `AssertionError: expected 590 to be less than 400`（`src/labels/labels.test.ts:301:20`） | labels 目标测试通过，22/22 |
| world-model 单测 | 恢复旧的 navigation focus 优先逻辑，让课程 URL 继续接收 Buzz 焦点 | `AssertionError: expected 'buzz' to be 'turing-pact'`；Expected `turing-pact`, Received `buzz`（`src/app/world-model.test.ts:12:7`） | world-model + study-context，2/2 |
| N3 浏览器守卫 | 把账号/课文的 `padding-inline-end: 56px` 改为 `0` | `Error: 提意见浮钮盖住密码框`；Expected `false`, Received `true`（`e2e/N.nocollide.spec.ts:103:7`） | N3，1 passed |
| N4 浏览器守卫 | 把手机 `.lesson-toolbar__label` 的 `display: none` 改为 `display: block` | `Error: 手机上仍显示悬空的讲解层级标签`；Expected `0`, Received `48.640625`（`e2e/N.nocollide.spec.ts:193:51`） | N4，1 passed |

## 检查结果

通过的相关检查：

- `pnpm check:experience`：`experience ledger: ok (24 findings — 15 fixed, 9 open)`。
- world labels 相关测试：22/22；app 的 world-model/study-context：2/2。
- UI 反馈/lesson toolbar 相关测试：3 个文件、9/9。
- world 与 university typecheck：通过。
- `oxfmt --check` 与 `pnpm format:check`：通过。
- N1–N4 真实浏览器守卫：4/4。

### `pnpm verify`

已运行完整命令。typecheck、lint、format、各 package 测试和双模式 build 均通过；最终在既有的 `check-export-freshness` 阶段停止，原文为：

```text
check-export-freshness: the export no longer matches the courses.

  turing-pact — re-export failed: Study default course is not active: foundations-before-zero
    fix: node scripts/university-local.mjs course recovery export --study turing-pact --out course-proposals/recovery/turing-pact
```

这不是本次 UI/布局改动产生的文件差异：课程目录是工作区外共享生成状态，且 BRIEF 明确禁止改课程内容和 `apps/local/studies/**`。按提示运行 recovery export 会违反任务范围，所以没有执行；也没有伪造 verify 绿灯。

### `pnpm e2e`

已运行完整 e2e，最终输出为 `31 passed`、`7 failed`。N1–N4 全部通过；其余失败来自本次范围之外的课程数据、共享基线与既有性能门槛：

- D、F、G 的本地端三条流程拿到的都是“书架上还没有课”：当前 worktree 可见的 `apps/local/studies/` 只有其保护说明文件，没有可供 authoring server 读取的课程包，因此没有开始按钮、canvas 或导航栏；没有补写该目录。
- M X2/X6 的在线课文在共享生成课程的 `evidence-inline-source` 上出现新的 color-contrast 违规；没有重采集 `e2e/axe-baseline.json`。
- M X3/X5 的在线桌面课文 CTA 实测 342ms，超过 300ms；现有 `KNOWN_RESPONSE_ISSUES` 没有该桌面项，没有新增 known map。
- 早先使用 fake public 配置时另有 Supabase `signInAnonymously` 的 `Failed to fetch`；本次完整运行使用中央 public 配置，该网络噪声不再出现。

因此本次完整 e2e 的可归因结果是：四条新增守卫全绿；没有通过削弱既有测试来掩盖环境性失败。`TOUCH_TARGET_EXEMPTIONS` 仍为空，`KNOWN_DIALOG_ISSUES` / `KNOWN_RESPONSE_ISSUES` 未增加，axe baseline 未改。

## 来源交叉验证

- [MDN：Document.elementsFromPoint()](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint)：用于说明视口坐标下实际位于点上的元素，支持五点命中证据。
- [MDN：CSS position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)：固定/绝对定位控件脱离普通流，必须检查其是否遮挡内容。
- [MDN：CSS flex-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/flex-wrap)：`nowrap` 保持单行，`wrap` 才允许换行；N4 因此验证实际控件中心线而不是只看 DOM 顺序。
- [MDN：CSS scroll-padding](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-padding)：固定工具条或侧栏需要为可视区域留出安全空间；本次两个密集 surface 采用等价的内容右侧 padding，并同时做矩形相交检查。
