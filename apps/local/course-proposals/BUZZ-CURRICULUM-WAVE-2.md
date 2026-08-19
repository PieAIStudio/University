# Buzz 第二批课程：补上第一批漏掉的两条线

第一批 5 门课（60 节）已经落地并全部通过 lint。这份文件记录**它漏掉了什么、为什么漏、
第二批要补什么**。

---

## 1. 第一批的实际取材面（实测，不是估计）

```
引用的源文件            18 个
Buzz 实际源文件         686 个 .rs + 1537 个 .ts/.tsx + 371 个 .dart
碰到的 crate            3 个（buzz-core / buzz-relay / buzz-acp），共 28 个
证据条数                172 条，行号全部核对无误
其中指向散文档的        52 条（30%）—— VISION.md / ARCHITECTURE.md / README.md
配图                    0 张
```

**根因在我，不在写课的人。** 第一批大纲第 6 节给的素材落点只覆盖了这 18 个文件，
执行方严格照做了，行号一条没错。问题是大纲本身的射程。

### 具体漏掉了什么

读者说想学两样：**agent/harness 设计**、**这个项目的 UI 设计**。对照实际交付：

| 想学的 | 第一批实际教了 | 漏掉的 |
| --- | --- | --- |
| agent/harness | `buzz-acp` 的队列与连接池 | **`buzz-agent`、`buzz-persona`、`buzz-workflow` 三个 crate 一次都没碰** |
| UI 设计 | `theme.css` + `tailwind.config.js` 两个配置文件 | **574 个 `.tsx` 组件、整套 motion/scrollbar/markdown 样式层，零引用** |

`buzz-design-tokens` 那门课名副其实——它教的是**配色变量表**，不是界面是怎么搭起来的。
这不算错，但它不是读者要的那个东西。

---

## 2. 第二批：两门新课

不改第一批。第一批讲的是「一条消息如何流过 relay」，是对的，只是不完整。
第二批补的是它上面那一层。

### 课程 A：`buzz-agent-harness`《让 agent 待在频道里，需要哪些看不见的东西？》

普通层级（读者已读完 `buzz-orientation` 和 `buzz-reading-rust`，Nostr 词汇直接用）。

**单元 1 · 一个 agent 的身份是怎么定下来的**（persona）

| # | 这节讲什么 | 证据（已逐行核对） |
| --- | --- | --- |
| 1 | 为什么身份配置要分五层，而不是一份配置文件 | `crates/buzz-persona/src/merge.rs:1-8` |
| 2 | 「没设置」和「设置成空」为什么必须是两件事 | `crates/buzz-persona/src/merge.rs:26-33` |
| 3 | 合并规则本身：谁盖过谁 | `crates/buzz-persona/src/merge.rs:41-47` |
| 4 | 配置进来之前先被校验成什么样 | `crates/buzz-persona/src/validate.rs`（写课时定位具体行） |

第 2 节是这个单元的核心，也是整门课最该讲透的一节：

```rust
/// `None`       = absent (no persona or pack value) → caller uses its own default
/// `Some([])`   = intentional "subscribe to nothing"
/// `Some([..])` = explicit channel list
pub subscribe: Option<Vec<String>>,
```

读者有 TypeScript 底子，这就是 `undefined` / `[]` / `[...]` 三态在 Rust 里的样子。
把两者接起来讲，是这节课能给的最大价值。**变体建议：术语**（必须有「它不是什么」）。

**单元 2 · 上下文不够用的时候，agent 怎么办**（handoff）

| # | 这节讲什么 | 证据 |
| --- | --- | --- |
| 5 | 交接摘要的 token 上限为什么是拼出来的，不是写死的 | `crates/buzz-agent/src/handoff.rs:41-53` |
| 6 | 恢复阶梯只有三种结局：恢复 / 取消 / 弹尽 | `crates/buzz-agent/src/handoff.rs:27-37` |
| 7 | 预算用完为什么要把错误交还，而不是再试一次 | `crates/buzz-agent/src/handoff.rs:139-147` |
| 8 | 第一级为什么直接砍半，而不是原样重试 | `crates/buzz-agent/src/handoff.rs:146-147` 附近 |

第 7 节适合**决策**变体——「什么时候该反过来」写：什么情况下无限重试才是对的。

**单元 3 · agent 能用什么工具，从哪儿来**（skills / workflow）

| # | 这节讲什么 | 证据 |
| --- | --- | --- |
| 9 | 它去哪三个目录找 skill，为什么是这三个 | `crates/buzz-agent/src/hints.rs:6-8` |
| 10 | 为什么在发现时就把文件列全，而不是用时再翻盘 | `crates/buzz-agent/src/hints.rs:19-23` |
| 11 | workflow 的触发器为什么用 serde 内部标签 | `crates/buzz-workflow/src/schema.rs:33-38` |
| 12 | 模板占位符查不到字段时，为什么返回 None 而不是空串 | `crates/buzz-workflow/src/executor.rs:45-50` + `62-68` |

第 9 节对这位读者格外有共鸣：`.agents/skills` / `.claude/skills` 正是他自己项目里那套。
**写这节时可以点破这个联系——但只能点一句，不能跑题。**

### 课程 B：`buzz-desktop-ui`《这套界面好看，是靠什么撑住的？》

普通层级。这门课**必须配真实截图**——读者天天在用 Buzz，界面就在眼前，
一门讲 UI 的课不给图是浪费。截图由用户本机 Buzz 采集，走 `assetFiles` 通道。

**单元 1 · 颜色不是挑出来的**

| # | 这节讲什么 | 证据 |
| --- | --- | --- |
| 1 | 这套配色是现成的（Catppuccin），不是设计师调的 | `desktop/src/shared/styles/globals/theme.css:1-14` |
| 2 | 为什么变量存的是 `220 23.08% 94.9%` 而不是 `#eff1f5` | 同上 |
| 3 | 深浅两套主题怎么共用一份组件代码 | `theme.css` 下半部分 |

第 1 节是**溯源**变体的好题材：一个自托管产品为什么不自己造调色板。

**单元 2 · 动效是被测试锁住的**

| # | 这节讲什么 | 证据 |
| --- | --- | --- |
| 4 | 时长、缓动、位移全部是 token，不许就地写数字 | `desktop/src/shared/styles/globals/motion.css:8-22` |
| 5 | 有一个测试专门盯着这些 token 有没有被绕开 | `desktop/src/shared/styles/globals/motion.test.mjs:10-18` |
| 6 | 还有一个测试盯着「关闭动效」这件事有没有被忘 | `desktop/src/shared/styles/globals/motion.test.mjs:20-25` |

第 5、6 节是这门课**最值得写**的两节。绝大多数项目的设计规范写在文档里，
靠人自觉；Buzz 把它写成了测试。这是「规范」和「约束」的区别，
是读者作为单人创始人最该带走的一课。**变体：对比**（文档 vs 测试）。

**单元 3 · 克制是怎么落到代码里的**

| # | 这节讲什么 | 证据 |
| --- | --- | --- |
| 7 | 滚动条默认完全透明，鼠标进来才出现 | `desktop/src/shared/styles/globals/scrollbars.css:1-11` |
| 8 | 为什么同时写了标准属性和 `::-webkit-` 两套 | `scrollbars.css:13-27` |
| 9 | 574 个组件是怎么按 feature 分目录的 | `desktop/src/features/` 目录结构 |

第 8 节要讲清一个时间差：`scrollbar-color` 直到 **2025 年 12 月**（Safari 18.2）
才进入 Baseline，Buzz 这段代码写在那之前，所以两套都写是对的。
**这节不要写成「Buzz 做得冗余」——它做得对，只是时代不同。**

---

## 3. 交给执行方时必须带上的三条

1. **本文件里的行号已经逐条打开文件核对过**，可以直接用。但**新增的锚点仍要自己核对**，
   不许照抄本文件的格式去猜别的行号。
2. **`buzz-desktop-ui` 必须有截图**。没有截图的 UI 课不算完成——
   资产走 `assetFiles`，注意 MIME 必须和字节一致（`sips -s format png`，别信扩展名）。
3. **落地流程**和第一批相同：`course create --dry-run` → 去掉 `--dry-run` → `pnpm lint:lessons`。
   一门课完整落地了才开下一门。

## 4. 已知仍未覆盖的（留给第三批，不在本批范围）

- Flutter 移动端（371 个 `.dart`）——完全没碰
- `buzz-relay-mesh`、`buzz-search`、`buzz-voice`、`buzz-media` 等 20 多个 crate
- `buzz-conformance`（协议一致性测试）——对「怎么保证互操作」是好题材
