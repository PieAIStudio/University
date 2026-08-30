# 国际化 Phase 1 完成报告

日期：2026-08-31  
分支：`work/i18n`

## 1. 范围与结论

本期只建立国际化基础设施，不翻译任何文案。已完成：

- 中文源文案 catalog 与 locale 注册机制；
- 中文 UI 文案抽取与静态完整度闸门；
- 正向完整 locale 测试和反向“缺 key 不可用”测试；
- `navigator.language` 的匿名语言需求测量；
- learner UI 与 authoring UI CSS 的 RTL 逻辑属性改造；
- 主页地图、课程阅读器、Plans 三屏 before/after 浏览器证据；
- 最终 `pnpm verify`，结果通过。

以下内容明确没有改动：课程正文、`apps/local/studies/`、`packages/ui/src/language/`，以及 AI grading 的语言切换。英文 catalog 保持空 scaffold，因此本期没有产生任何英文翻译。

## 2. 机制

核心实现位于 `packages/ui/src/i18n/`：

- `catalogs/zh-CN.ts` 是源 catalog；`catalogs/en.ts` 是空的未来翻译 scaffold；
- `MessageKey` 从中文源 catalog 推导，避免调用点与源 catalog 脱节；
- `LOCALE_REGISTRY` 保存 locale 的方向、显示名 key 和 messages；
- `localeCompleteness` / `isLocaleComplete` 做精确 key 集比较，既检查缺 key，也检查多余 key；
- `availableLocales` 只返回完整 locale；当前 `zh-CN` 可用，`en` 已注册但因为空而不可用；
- `I18nProvider`、`useI18n`、`translate`、`number`、`date`、`plural` 使用原生 `Intl`，没有增加 i18n 依赖；
- provider 会同步 `document.documentElement.lang` 与 `dir`，方向来自 locale 元数据。

加入新语言的最小步骤是：复制源 catalog 的完整 key 集建立 `packages/ui/src/i18n/catalogs/<locale>.ts`，把它注册到 `LOCALE_REGISTRY`，通过 `MessageCatalog` 类型与 `isLocaleComplete` 测试，然后运行 `pnpm boundaries` 和 `pnpm verify`。不完整 locale 会自动留在注册表中但不会出现在可选语言列表。

由于 University 是一个 app、两种 mode，源 catalog 包含共享的 learner 与 authoring UI 文案。delivery bundle 中共享 catalog 数据存在是预期的；`scripts/check-authoring-excluded.mjs` 现在把这些共享数据与实际 authoring 模块指纹分开检查，仍会阻断 authoring 代码泄漏。

## 3. 中文源文案抽取

`zh-CN` 共 1,105 个 key：

- 1,103 个实际 UI copy key；
- 2 个 locale 名称 key：`locale.zhCN.name`、`locale.en.name`。

所有 value 保持中文源文案，没有翻译或改写。`scripts/check-i18n.mjs` 已接入 `pnpm boundaries`，当前输出为：

```json
{
  "sourceCatalogKeys": 1105,
  "englishCatalogKeys": 0,
  "unextractedChinese": 0,
  "physicalCssDeclarations": 0
}
```

静态扫描覆盖 `packages/ui/src` 与 `apps/university/src` 的实现文案，并明确排除：

- `packages/ui/src/language/`：语言学习专用的文字层，按 brief 留给后续阶段；
- `packages/ui/src/markdown/lesson-sections.ts`：课程 section 数据；
- `apps/university/src/ports/local/grading.ts`、`apps/university/src/ports/online/grading.ts`、`packages/ui/src/review/ExerciseBlock.tsx`：AI grading 语言切换按 brief 延后；
- 测试、课程内容和 `apps/local/studies/`。

受保护目录与 AI grading 文件均无 diff；没有新增依赖。

## 4. locale 完整度闸门

`packages/ui/src/i18n/index.test.ts` 覆盖：

- 完整的 `zh-CN` 被列入 `availableLocales`；
- 伪造的缺 key locale 不会被列入可用列表；
- 请求 `en` 时会安全回退到完整的 `zh-CN`；
- `Intl.NumberFormat` 与复数选择路径可用。

`scripts/check-i18n.mjs` 另外检查源/英文 catalog 的重复 key、实现代码中的未抽取中文和目标 CSS 中的物理方向声明。

## 5. RTL 逻辑属性

改造前共审计到 222 个物理方向声明：`packages/ui` 164 个、`apps/university` 58 个。其中 `packages/ui/src/language/` 的 4 个声明受 brief 保护。

本期改造了目标范围内的 218 个声明：共享 UI 160 个、University app 58 个。目标范围目前为 0 个物理方向声明；受保护目录的 4 个声明保持原样。另有 15 个非对称 padding shorthand 和 20 个多角 border-radius shorthand 被拆成逻辑属性。

安全区变量也改为逻辑语义：LTR 使用 left/right，`[dir="rtl"]` 时交换 inline start/end。未做单独 RTL 截图，因为本期没有完整的 RTL locale；方向 metadata、provider 和 CSS 闸门已就位。

## 6. locale 需求测量

`apps/university/src/analytics/locale-demand.ts` 提供 `LocaleDemandPort` 与 console adapter。启动时只读取 `navigator.language` 的语言子标签，例如 `ar-EG` 记录为：

```json
{
  "event": "university.locale.requested",
  "schemaVersion": 1,
  "languageCode": "ar"
}
```

不记录用户、会话、URL、设备、时间戳、原始 locale，也没有接入 PostHog。单元测试覆盖语言子标签提取、非法值忽略和结构化日志字段。

同时扫描了 SwimmerUIKit 的源/运行时相关文件：唯一命中的中文是开发期 `swimmer-ui-check.mjs` 的错误提示“主题化配方”，不是运行时 UI 文案；本期没有改 kit。

## 7. 浏览器证据

基线来自 HEAD 的临时 detached worktree，after 来自本分支；六张截图均为 1280×633，同一 delivery server 与无登录浏览器上下文。`lang` 为 `zh-CN`，`dir` 为 `ltr`。

- 主页 3D 地图： [before](./i18n/before-homepage-map.png) / [after](./i18n/after-homepage-map.png)
- 课程阅读器： [before](./i18n/before-lesson-reader.png) / [after](./i18n/after-lesson-reader.png)
- Plans： [before](./i18n/before-plans.png) / [after](./i18n/after-plans.png)

逐屏复核结论：三屏没有 screenshot-visible regression。screenwalk owner brief 在 [`i18n/owner-review-brief.md`](./i18n/owner-review-brief.md)，问题证据包为空（[`i18n/evidence-packets.json`](./i18n/evidence-packets.json)）。

## 8. 验证与后续

最终 `pnpm verify` 通过，包含全仓 typecheck、lint、format、tests、module/kit/contrast/raw-colour/shared-style/i18n/canvas/review-card 闸门、delivery/authoring 构建、内容检查、作者工作台排除检查和 doc-gov 检查。

仅有两类非阻塞提示：构建存在既有的大 chunk warning；本机没有初始化 study source，因此 export freshness 只能报告“本次未证明 source freshness”。两者均未导致失败。

后续阶段需要：补齐真正的翻译 catalog、决定语言选择器与持久化策略、补充至少一个完整 RTL locale 后做 RTL 浏览器走查，并按既有成本分层单独设计 AI grading 的语言切换。
