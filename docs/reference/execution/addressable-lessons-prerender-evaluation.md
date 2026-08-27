---
id: REF-ADDRESSABLE-LESSONS-PRERENDER
title: Addressable Lessons Pre-rendering Evaluation
type: reference
status: active
canonical: true
owner: human
created: 2026-08-27
last_reviewed: 2026-08-27
domain: execution
tags:
  - routing
  - seo
  - prerendering
  - publishing
related:
  - REF-PUBLISH-LANE
  - REF-CURRENT-WORK
---

# Addressable Lessons：预渲染评估

## 结论先说

本轮**不实现预渲染**，只把设计、成本和选型钉下来。当前的 pathname 路由、
`robots.txt` 和 `sitemap.xml` 已经可以作为后续预渲染的边界；真正需要产品
负责人决定的是：是否为 579 节课增加静态正文 HTML，以及愿意接受多大的构建
产物和构建时间。

推荐的后续方向是**保留现有客户端渲染，增加一个只负责 lesson 页面正文的
Vite/React 静态入口**。暂不引入第二套路由，也不在 importer 里再生产一份
课程清单。若愿意接受一次较大的框架接入，Vike 是可评估的现成方案；本项目
当前不应直接迁移到 React Router 的预渲染接口。

## 当前事实与基线

测量对象是本工作树在 2026-08-27 的 delivery 输入和构建产物，命令没有改动
受 Git 跟踪的生成文件：

| 项目 | 实测值 |
| --- | ---: |
| study / course / lesson | 5 / 53 / 579 |
| `manifest.json` 的 lesson 数 | 579 |
| `sitemap.xml` 的 `<url>` 数 | 579 |
| `robots.txt` | 113 B |
| `sitemap.xml` | 75,413 B |
| 53 个课程 JSON | 3,963,119 B |
| 579 节正文 Markdown 的 UTF-8 字节 | 2,471,807 B |
| 当前 `dist/delivery` 总大小 | 21,904,676 B |
| 当前 app 双模式 build 墙钟时间 | 11.928 s |

课程数的权威链路是：

```text
apps/local/course-proposals/recovery/
  → scripts/import-courses.mjs
  → content/manifest.json + content/shelf.json + per-course JSON
  → Vite delivery build
  → robots.txt + sitemap.xml
```

`checkShelfData(manifest, shelf)` 已经负责验证 manifest 与 shelf 的 study、
course、lesson 数及对应 id。站点索引现在复用这个结果，把发布 lesson 数传给
生成器；数量不相等时构建失败。因此 579 不是写进 sitemap 的第二份课程清单，
而是当前发布输入的一次构建事实。

这组数字给了预渲染的两个下限：正文本身至少要携带 2.47 MB 的原始 UTF-8
字节，579 个页面还要加上 HTML 标签、标题、canonical、结构化数据和每页的
共享 head。实际 HTML 大小和 gzip 大小尚未测量，因为本轮没有选择或实现
HTML renderer；不把 Markdown 字数冒充最终 HTML 大小。

11.928 s 是当前 `pnpm --filter @pieai/university-app build` 的一次基线，
不是预渲染的成本。新增成本必须在 renderer 选定后，用同一份输入做至少三次
冷构建，报告 median、最大值、579 个 HTML 的 raw/gzip 总大小以及增量
`Δbuild = prerender build - current build`。在此之前给出“会增加几秒”的数字
是不可靠的。

## 应该接在发布流水线哪里

当前发布入口是 `apps/university/scripts/build-delivery.mjs`：它先运行
`pnpm content`，再运行 app 的 delivery/authoring build，然后检查 authoring
未泄漏、写 release metadata、校验并封存 `dist/delivery`。

预渲染若获准，建议成为 delivery 专属的独立阶段：

```text
校验 recovery 输入
  → pnpm content
  → delivery client build（现有 client assets）
  → lesson static render（新增，读取同一 shelf/course JSON）
  → authoring build
  → authoring-exclusion check
  → release metadata / artifact validation / seal
```

接点应在 `pnpm content` 之后、artifact validation 之前。原因是：

- `shelf.json` 和课程 JSON 已经生成，预渲染可以消费真实发布数据；
- delivery 的 hashed CSS/asset 已经存在，静态 HTML 可以引用它们；
- 产物还没有封存，`validateDeliveryArtifact` 可以把 579 个页面纳入文件清单
  和 checksum；
- importer 继续只负责把 recovery package 变成 delivery package，不会变成
  第二个课程生产者；
- 不应放在部署后 hook：那会让 sitemap、release checksum 和实际正文脱钩。

目前 app 的 `build` 一次同时构建两种 mode。实现阶段应先把“delivery client
build”和“authoring build”的流水线边界显式化，或者让一个新增的 delivery
阶段只写 `dist/delivery`，不能把 authoring 的 HTML 混进发布包。

## 页面如何与客户端共存

预渲染不是把整套 App 在 Node 里跑一遍。当前 App 包含 WebGL、浏览器 API、
账号/进度订阅、AI grading、反馈面板和异步 port；这些都不应该成为首屏正文
HTML 的服务器依赖。

建议把共享 lesson reader 拆成一个 SSR-safe 的正文边界：

1. build 读取 `shelf.json` 得到 579 个 scoped lesson ref，并用 core 的
   `toPath` 生成目录；读取对应 course JSON 的 lesson 正文和可公开 metadata。
2. 静态入口只渲染 title、description、canonical、OG metadata 和
   `LessonReader` 的 DOM 正文；文本仍由 `packages/ui` 的同一套 reader/markdown
   组件产生，不复制一份 HTML 模板。
3. 每个页面输出到对应 pathname 的 `index.html`，并把必要的初始 lesson 数据
   放在安全的、可校验的 bootstrap 边界中；不要把 answer key、author-only
   evidence 或账号数据塞进 HTML。
4. 浏览器加载后由相同的 lesson 组件接管。若 server markup 与第一帧 client
   markup 一致，用 `hydrateRoot`；账号、progress、presence、grading、3D
   map 和反馈等仍在 client-only 边界中启动。
5. 没有预渲染的 world、studio、account 等地址继续落到现有 SPA shell。
   已有静态 lesson 文件必须优先于 fallback；Vercel 的 `/api/*` 排除和
   crawler 文件排除保持不变。

React 官方的 `renderToString` 会立即返回 HTML，不会等待数据；遇到 Suspense
时也可能输出 fallback。同步读取已经生成的课程 JSON 时它可以做候选实现，
但需要异步数据或流式静态输出时应评估 React 官方的 `prerender`/
`prerenderToNodeStream` 接口。[React server rendering API](https://react.dev/reference/react-dom/server/renderToString)

Vite 自己支持“已知路由和数据时在 build 时预渲染”的 SSR/SSG 形状，并建议
client/server 两个 entry；这和本项目的 custom `View` parser、现有 port
边界以及只渲染 lesson 正文的需求最相容。[Vite SSR guide](https://vite.dev/guide/ssr)

## 现成开源方案比较

| 方案 | 能力 | 与当前仓库的关系 | 结论 |
| --- | --- | --- | --- |
| Vite 原生 SSR/SSG + React DOM server | 自己控制 client/server entry、数据读取和静态文件输出 | 不要求换掉现有 `View` parser；需要抽出 SSR-safe lesson 边界 | 首选评估基线 |
| Vike + `vike-react` | 参数化预渲染、部分页面预渲染、SPA 共存；可以渐进接入已有 Vite | 会引入 page/onRender/路由框架边界；需要确认与现有 custom router 和 Vite scripts 的接法 | 可做第二候选，不在本轮接入 |
| React Router v7 pre-rendering | 官方支持动态路径列表/函数、并发预渲染和 SPA fallback | 当前产品没有 React Router；直接采用会把一个小的 SSG 需求变成全 app 路由迁移 | 否掉直接采用 |
| `vite-react-ssg` | Vite + React 的 SSG 工具，带动态 `getStaticPaths` 等能力 | README 要求 `react-router-dom`，且已把 React Router v7 官方方案列为新项目建议；不匹配 custom `View` | 不作为当前方案 |
| `prerender-spa-plugin` | 用浏览器快照生成 history API 页面 | 文档明确 hash 路由不工作，方案以旧的 webpack/browser snapshot 思路为中心；没有解决 data/markup/hydration 边界 | 否掉 |

具体依据：Vike 支持在已有 Vite 项目中渐进接入并混合预渲染和 SPA，见其
[pre-rendering](https://vike.dev/pre-rendering) 和
[add to existing Vite app](https://vike.dev/add) 文档；React Router 的
[pre-rendering guide](https://reactrouter.com/how-to/pre-rendering) 说明了
动态路径、并发和 SPA fallback，但前提是采用它的 route modules；
`vite-react-ssg` 的 [README](https://github.com/Daydreamer-riri/vite-react-ssg)
要求 React Router，并建议新项目查看 React Router v7；旧的
[`prerender-spa-plugin`](https://github.com/chrisvfritz/prerender-spa-plugin)
则明确记录 hash 路由不适用。

## 验收和成本闸门

产品决定实现后，先做两课 pilot（最短正文和最长正文），再扩到全量。pilot
必须先证明：

- 不运行 JavaScript，直接请求两个 lesson URL 的 HTTP body，就能看到不同的
  `title`、`og:title`、canonical 和真实正文；
- hydrate 后没有 hydration mismatch，交互、进度记录和 lesson link 仍走同一
  个客户端实现；
- `sitemap.xml` 条目数仍等于 `checkShelfData(...).lessons`，当前应为 579；
- 静态 lesson 目录不被 SPA fallback 吞掉，`/api/*` 仍进入 author server；
- 记录两个 pilot 页和全量 579 页的 raw/gzip bytes、生成墙钟、内存峰值和
  失败页；
- release metadata/checksum 覆盖新增 HTML，`pnpm verify` 继续通过。

如果 pilot 只是为了搜索引擎 metadata，不能顺手把整个 interactive App 预渲染：
那会把账号、WebGL、port 和 hydration 风险带进一个本来可以是静态正文的任务。
如果产品要求社交登录态、实时进度或个性化回答出现在首次 HTML 中，则这已是
SSR 产品架构，而不是本报告所评估的 lesson SSG，应另立设计和成本决策。

## 本轮决策记录

- **保留**：现有 pathname 路由、core `toPath`、共享 lesson reader、发布
  importer、manifest/shelf parity gate、SPA fallback。
- **选择**：预渲染只作为 delivery pipeline 的后置、lesson-only 静态阶段；
  先以 Vite 原生 SSR/SSG 作为技术基线。
- **否掉**：另建课程清单、在 importer 之外生产正文、部署后生成 HTML、
  现在直接迁移 React Router、在 Node 里运行整套含 WebGL 的 App。
- **不做**：本轮不新增预渲染脚本、依赖、静态页面或 Vercel 规则。

因此这是一份设计与调研记录，不是实施承诺。产品负责人只需在决定页数、
首屏正文范围、允许的构建增量和是否接受 Vike 的框架边界后，再开实现单元。
