# StrictMode 学习者面 smoke 审计

日期：2026-08-29

这次保护的不是“组件没有抛异常”，而是生产入口用的 React `StrictMode` 下，学习者仍然能看到这条路径真正需要的内容。审计把 `createRoot` 挂到 jsdom 后的 DOM 断言算作渲染测试；源码扫描、纯函数测试和 `renderToStaticMarkup` 都不算这层保护。

## 审计出的基线

按 `packages/ui/src/index.ts` 的共享学习者面、实际 learner route host，以及 lesson reader 直接组合的可见组件核对，原来没有专门的客户端 DOM 挂载测试，或只有不能触发 StrictMode effect 生命周期的测试，名单如下：

- `LessonReader`：`LessonReader.port.test.ts` 只读源码，确认没有写死 authoring API；`apps/university/src/screens/LessonScreen.test.tsx` 虽然有 host-level DOM 测试，但没有 `StrictMode` smoke。
- `VocabularyReview`：没有渲染测试。
- `TodaySection`：`apps/university/src/app/TodayCard.test.tsx` 只有 `renderToStaticMarkup`。
- `PracticeSurface`、`CatalogSurface`、`FavouritesScreen`：没有自己的客户端 DOM 挂载测试；它们的子组件或存储函数有测试，不能证明组合面出现。
- `LibrarySurface`、`ConceptIndex`、`KnowledgeNotes`、`CourseRouteQuiz`：现有覆盖是静态输出或子索引覆盖，不是 StrictMode 客户端挂载。
- `EvidenceRail`、`LayerCoverage`、`CapabilityExplanation`、`ForeignSettingsPanel`、`SoundToggle`、`FavouritesEmpty`：没有专门的共享组件 StrictMode smoke；其中部分只在更大的页面或某条交互分支中间接出现。
- 其它已有普通 DOM/SSR 测试但没有 StrictMode 专项的面包括 `RecapPrompt`、`PracticeStream`、`PracticeOverview`、`EntryPage`、路径卡片、提醒设置和导航屏幕。

这份清单的边界是用户可见的共享面，不把 `CollectionIndex`、`LessonMargin` 这类内部装配件冒充成独立学习页面。优先级按“缺失就无法读、答、复习或知道今天做什么”排序。

## 本轮覆盖

新增 `packages/ui/src/learner-surfaces.strictmode.test.tsx`，所有下列挂载都包在 `<StrictMode>` 中：

| 面 | 断言的学习者可见内容 |
| --- | --- |
| `LessonReader` | 课文标题、正文，以及练习答案输入框 |
| `ExerciseBlock` | 题目标题、题干、答案输入框、提交按钮 |
| `ReviewCard` | 复习标题、卡片问题、答案输入框、揭示答案按钮 |
| `VocabularyReview` | 异步加载后的单词标题、待复习数量、看释义按钮 |
| `TodaySection` | 今天的下一节标题、课程上下文、开始学习按钮 |

同时把 `packages/ui/src/review/ChoiceBlock.test.tsx` 改为 StrictMode 挂载。正确提交后的断言仍然检查学习者会说出的“答对了”和解释，并额外检查：

```ts
const blob = container.querySelector<SVGPathElement>(
  ".choice-block__correct-merge [data-liquid-gooey-blob]",
);
expect(blob).not.toBeNull();
expect(blob?.getAttribute("d")?.trim()).toBeTruthy();
```

当前安装的是 `@pieai/swimmer-ui-kit@1.11.1`。它在 `LiquidGroup.register()` 中会唤醒 StrictMode 第一次 cleanup 后复用的 engine；jsdom 中通过一次带重入保护的同步 `requestAnimationFrame` 和 `ResizeObserver` stub 让这条 SVG path 可观察。零布局尺寸仍会得到 kit 的最小几何路径，因此这里检查到的是实际非空 `d`，不是“节点存在”或测试自己伪造的字符串。没有引入浏览器、WebGL、截图或像素 baseline。

## 临时破坏证明

至少三个最关键的测试都亲眼见过失败，之后已恢复产品文件：

| 面 | 临时破坏 | 实际失败形状 |
| --- | --- | --- |
| 读课文 | 让 `LessonReader` 在返回正文前直接 `return null` | `expected undefined to be "读懂一个真实的学习页面"` |
| 选择题 | 让 `ChoiceBlock` 在正确反馈状态直接 `return null` | `expected "" to contain "答对了"` |
| 复习卡 | 让 `ReviewCard` 在渲染前直接 `return null` | 标题查询得到 `undefined`，无法满足“通过答题复习”断言 |

恢复后 focused suite 为 11/11 通过。临时破坏没有保留在提交中，也没有修任何产品行为。

## 刻意未覆盖的面

本轮没有把所有已有普通测试都改成 StrictMode，也没有把所有低优先级页面塞进一个大 smoke：

- `PracticeSurface`：`PracticeStream` 和 `PracticeOverview` 已有客户端测试；组合面仍盲，但它不阻断读课、答题、复习和今日入口。
- `CatalogSurface`、`FavouritesScreen` / `FavouritesEmpty`：属于目录和收藏查找，已有相邻的统计、存储或星标契约测试；本轮让位给主学习路径。
- `LibrarySurface`、`ConceptIndex`、`KnowledgeNotes`、`CourseRouteQuiz`：目前主要是静态输出或子组件覆盖，尚未获得 StrictMode client smoke。
- `EvidenceRail`、`LayerCoverage`、`CapabilityExplanation`、`ForeignSettingsPanel`、`SoundToggle`：是证据、能力解释、语言设置和声音等次级/端口相关面；部分会从父页面或交互分支间接出现，但没有独立 StrictMode 保护。
- `RecapPrompt`、路径卡、EntryPage、PracticeStream、提醒设置和导航屏幕：已有普通 DOM 或 SSR 测试，但本轮没有把“普通挂载”升级成 StrictMode smoke。

在本轮实际尝试加入保护的面里，没有发现因为 jsdom、WebGL 或动画无法观察而不得不放弃的 surface。唯一需要特别处理的是同步 rAF 的重入保护；如果以后给自调度动画面加 StrictMode 测试，必须保留同样的 guard。

## 验证结果

- `pnpm install --prefer-offline`：通过。
- `pnpm --filter @pieai/university-core build`：通过，为新 worktree 补齐可解析的 workspace 包。
- StrictMode smoke + ChoiceBlock：11/11 通过。
- `@pieai/university-ui` typecheck、lint、format check：通过。
- `pnpm verify`：在 `apps/university` typecheck 阶段停止，因为 worktree 缺少 gitignore 的生成文件 `apps/university/content/shelf.json`：

  ```text
  src/catalog/listing.test.ts(6,19): error TS2307:
  Cannot find module '../../content/shelf.json'
  ```

这是项目文档所述的 fresh-worktree generated delivery content 前置条件，不是本次测试回归。按要求没有运行 `pnpm content`；也没有用它改写课程 manifest 来让验证变绿。
