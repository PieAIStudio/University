---
id: REF-PUBLISH-LANE
title: Delivery Publish Lane
type: reference
status: active
canonical: true
owner: human
created: 2026-08-26
last_reviewed: 2026-08-26
domain: execution
tags:
  - delivery
  - publishing
  - reproducibility
  - content-pipeline
related:
  - ADR-0002
  - SPEC-0001
  - REF-CURRENT-WORK
---

# Delivery Publish Lane

这份报告记录发布流水线的实测现状、边界选择和可执行操作。它是第 7
项工作的详细证据；当前工作索引只保留指针，不复制下面的测量结果。

## 目标与范围

主泳道是**仓库拓扑**：让交付构建的输入、产物、校验和人工发布动作各有
一个清楚的入口。课程仍然只由 `apps/local` CLI 写出；本流水线只消费已
产出的 recovery package，做公开 DTO 转换、静态构建和产物打包。

本报告不实现课程生成、后端课程发布 API、支付或权益。ADR-0002 的实际
发布目标仍需产品决定，见文末。

## 现状：从干净 clone 实测

测量对象是 `work/publish-lane` 的干净 clone，不携带原工作树的
`node_modules`、忽略文件或外部符号链接。

### 输入分类

已在 Git 中、干净 clone 可取得的输入：

- `apps/local/course-proposals/recovery/`：5 个 study index，index 共引用 53
  个 recovery course package；目录实际有 61 个文件、约 17.99 MiB，其中 3
  个是未被 index 引用的历史 `.recovery.json`。每个被引用的 index/package
  都有 `sha256:` 账；index 是课程集合的权威住处，未引用包不会进入课程产物。
- `apps/local/data/vocabulary/en.json`：词典输入，约 92 KiB。
- `apps/university/` 的源码、静态 kit、workspace 清单和
  `pnpm-lock.yaml`。
- `apps/university/src/content/imported.json` 当前虽然被 Git 跟踪，实际
  是 `pnpm content` 写出的生成文件；它不是课程输入，也不应在本泳道的
  提交中更新。

干净 clone 没有的本机/忽略输入：

- `apps/university/content/`：`pnpm content` 生成的课程 JSON、shelf、
  manifest 和分离后的 asset/evidence 文件；根 `.gitignore` 忽略它。
- `apps/university/dist/`、各 package 的 `dist/`、`node_modules/` 和
  `.tsbuildinfo`：构建缓存或构建产物，均不入 Git。
- `apps/local/studies/`：目录本身只保留 `.gitignore` 和 README；其私有
  study 容器由目录内的 `*` 规则忽略。当前主工作树实际通过
  `apps/local/studies/studies` 指向 `/Users/yuanfei/PieAI/University/apps/local/studies`，
  该外部 shelf 实测约 1.1 GiB。干净 clone 不拥有它，也不应把它放进任何
  交付产物。
- `.env` / `.env.*`：被忽略。浏览器用的
  `VITE_SWIMMER_BACKEND_SUPABASE_URL` 和
  `VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY` 缺失时，backend assembly 按现有
  契约静默返回离线/null adapter；它们不是构建课程包的输入。真实环境若
  需要登录/同步，仍须由部署环境提供公开 publishable 配置。迁移期间仍兼容
  旧的 `VITE_SWIMMER_CORE_*` 名称，但新的本机文件和 Vercel 配置应使用
  `VITE_SWIMMER_BACKEND_*`。

工具链也有一个此前未钉死的输入：仓库根 `package.json` 没有声明
`packageManager` 或 Node engine；`.github/workflows/docs-check.yml` 才把
Node 24 和 pnpm 11.22.0 写死。测量机使用 Node 24.19.0、pnpm 11.22.0。

### 实测命令和结果

干净 clone 执行：

```bash
pnpm install --frozen-lockfile
pnpm --filter @pieai/university-core build \
  && pnpm content \
  && pnpm --filter @pieai/university-app... build
```

结果是**构建命令退出 0**，生成 5 个 study、53 门课和交付 dist；所以
“完全不能编译”已经不是当前分支的准确描述。准确的问题是输出依赖隐形
本机状态：

- 干净 clone 没有 studies 时，importer 打印 `baked 0 evidence snippets`，
  课程 JSON 约 3.8 MiB。
- 同一个 clone 显式指向本机 1.1 GiB studies shelf 时，打印
  `baked 1597/1697 evidence snippets into 1454 files`，课程 JSON 约
  4.0 MiB；例如 `buzz-orientation` 的 `servedBytes` 从 48,449 变成
  51,699。两次的 `apps/university/src/content/imported.json` 也不同。
- 因此当前 Vercel 机器构出的“交付包”和干净 clone 构出的包不是同一
  产物，虽然两者都能启动。

还有两个会掩盖缺输入的现象：

- 在没有生成 `content/` 的全新 clone 直接执行 `pnpm verify`，会在
  `apps/university/src/catalog/listing.test.ts` 导入缺失的
  `../../content/shelf.json` 处退出 1；`verify` 不是当前的 content
  bootstrap 命令。
- 把 `UNIVERSITY_UPSTREAM_RECOVERY` 指向不存在目录时，`pnpm content`
  仍退出 0 并打印 `nothing to import`；随后构建才以缺失 `shelf.json`
  退出 1。这个早期步骤是 fail-open 的。

### `vercel.json` 当前行为

当前配置是：

- `installCommand`: `pnpm install --frozen-lockfile`；
- `buildCommand`：先构建 core，再 `pnpm content`，再执行
  `pnpm --filter @pieai/university-app... build`；这会从相对默认路径
  `../local/course-proposals/recovery` 和 `../local/studies` 取输入，并且
  同时构建 delivery 和 authoring 两个 mode；
- `outputDirectory`: `apps/university/dist/delivery`；
- `framework: null`，并把 `/content/` 当公开静态文件缓存；
- `git.deploymentEnabled: false`：GitHub push 不触发部署。配置注释要求
  持有本地状态的机器执行 `vercel build && vercel deploy --prebuilt`。

所以 Vercel 现在既没有显式传入课程输入，也没有固定 evidence mode；它
实际上依赖运行它的那台机器是否有 `apps/local/studies`。

### ADR-0002 的闸门在哪里

目前存在的闸门是三种不同性质的检查，不能混称为一个“发布审批”：

1. `apps/university/scripts/public-course.mjs` 用显式字段表生成 learner
   DTO；`no-answers-shipped.test.ts` 递归检查 answer/rubric 等 author-only
   字段和值。
2. `apps/university/vite.config.ts` 在 delivery `writeBundle` 时要求
   `content/` 存在；`scripts/check-authoring-excluded.mjs` 读取真正的
   delivery JS/CSS 产物，并在产物不存在或 CSS 过期时失败，而不是对空目录
   放行。
3. `vercel.json` 的 `deploymentEnabled: false` 把“从 Git 提交自动上线”
   关掉，人工 `vercel deploy --prebuilt` 是当前实际的操作闸。

尚不存在的闸门：没有记录“某个版本的某个 course hash 已 reviewed，现可
published”的 tracked release record；recovery index 的 `active` 是内容
状态，不是 ADR-0002 所说的人审记录。代码中也没有把课程 JSON 推到
SwimmerBackend 的 publish API。ADR-0002 写的是后端 entitlement，运行时却
是 Vercel public static files，这个矛盾不能由本构建脚本擅自裁决。

## 选择的边界形状

### 交付命令

引入一个唯一的交付入口，要求把关键输入写在命令行上：

```bash
pnpm delivery:build -- \
  --version 0.1.0 \
  --recovery-root apps/local/course-proposals/recovery \
  --lexicon apps/local/data/vocabulary/en.json \
  --evidence none
```

它会：

1. 校验 recovery index、每个被引用文件和 `sha256:`，并计算输入指纹；当前
   3 个未引用的历史 `.recovery.json` 会列在元数据中，其它未登记文件直接
   失败；
2. 用显式 recovery root 和 lexicon 执行现有 importer；
3. 把 evidence mode 固定为 `none`，不读取 `apps/local/studies`；
4. 构建 delivery，读取产物验证 authoring 未泄漏；
5. 在 `apps/university/dist/delivery/` 写入版本元数据，并复制一份不可
   覆盖的版本目录 `.artifacts/delivery/<version>/`；
6. 用 fail-closed checker 校验版本、内容 manifest、公开 DTO、禁止路径、
   每个文件的 SHA-256 和总字节数。

`release.json` 只记录相对输入名、Git commit、输入指纹、evidence mode 和
payload 文件清单；另外会记录未引用的历史包名。`SHA256SUMS` 覆盖 payload
与 `release.json` 自身，但不包含自身，避免自引用。构建会从 `HEAD` commit date 得到稳定的 import
   date，也允许显式传 `--import-date`。命令会保留调用前的生成 source
   manifest，不把 `imported.json` 的变化带进提交。

版本化 artifact 只复制 `dist/delivery`，不复制 workspace、源 recovery
目录或 `apps/local/studies`。检查器遇到缺失 artifact、缺失 manifest、缺失
课程、symlink、路径穿越、studies 路径、checksum 不匹配或 author-only DTO
时均退出 1；它不会像当前 `pnpm content` 那样在“没有输入”时退出 0。

### Vercel 和 CI

`vercel.json` 应改为调用上述入口，并显式传 tracked recovery root、词典和
`--evidence none`；`outputDirectory` 保持不变，`deploymentEnabled: false`
保留。命名版本由 `DELIVERY_VERSION` 提供；未提供时 Vercel commit SHA
只作为 `0.0.0+<sha>` 的可追溯构建版本，不把 Git push 变成发布动作。

不新增自动发布 CI。发布和部署是昂贵且有外部状态的手工 release lane；
现有 docs-only CI 继续负责文档检查，开发者在发布前运行本地构建、artifact
checker 和 `pnpm verify`。若以后要自动发布，应另建手动触发、最小权限、可
取消旧运行的 workflow，并先解决 ADR-0002 的目标存储。

## 否掉的替代方案

- **把 `apps/university/content/` 整棵提交**：它是派生物，含私有课程摘录
  和按机器状态变化的 evidence；会让 Git 与 recovery input 形成第二份真相，
  也没有解决 `apps/local/studies` 的来源/审查问题。
- **让 Vercel 继续读取 `apps/local/studies`**：不能从 clean clone 复现，
  并且违反“私有 study checkout 不得进入任何产物”的边界。
- **在 pipeline 里重新生成课程**：会产生第二个课程生产者，违反
  `AGENTS.md` 和 SPEC-0001；pipeline 只做 DTO 转换与打包。
- **用一个“删除黑名单”代替公开 DTO 和产物校验**：已有的递归白名单是
  发布边界；本 lane 继续复用它，并在最终产物上递归检查，避免新字段或
  camelCase author 字段漏网。
- **现在添加后端 publish API 或新的 port**：缺少后端 owner 提供的表、
  RLS、API 合同和“published”语义，且这会越过本任务的拓扑边界。

## 需要产品负责人拍板

本实现选择的是**可从 clean clone 得出的 package-only release**：课程正文、
cards、exercise fingerprint、evidence locator 和静态资源可复现；来自
私有 source checkout 的 windowed code snippet 不进入该 lane。现有 reader
已经把无 snippet 作为合法的 locator-only 路径。

如果产品要求每个已发布版本必须保留 1,597 个可打开的 source snippet，产品
负责人需要先决定：

1. 是否接受 locator-only 的 clean-clone release；若不接受，必须指定一个
   可版本化、可提交/可下载的 evidence transport，并让 `apps/local` 这个
   唯一生产侧生成它；
2. 发布包的权威落点到底是 ADR-0002 写的 SwimmerBackend gated package，
   还是当前实际的 Vercel public static artifact。两者需要新的决策记录
   对齐，不能在本任务里默默选择一个。

在这两项未决定前，本 lane 可以完成并校验 package-only artifact，但不声称
已经完成后端意义上的“published course”或 source-snippet parity。

## 实现后复测

在实现提交后，用同一条命令分别在主工作树和一个没有 `node_modules/`、
`content/`、`dist/` 或忽略状态的独立 clone 执行 `0.1.0` 构建。两边都得到
5 studies、53 courses、579 lessons、`evidence:none`；对两个版本目录执行
`diff -rq` 没有差异，主工作树的 `git status` 也保持 clean。独立的
`sha256sum -c SHA256SUMS` 全部通过。
