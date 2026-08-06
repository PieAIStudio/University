---
id: REF-WHAT-LIVES-WHERE
title: What Lives Where
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-08-07
last_reviewed: 2026-08-07
domain: operations
tags:
  - airlock
  - topology
  - self-study
---

# 磁盘上这几个目录分别是什么

四个名字长得像，作用完全不同。按「它存的是什么」分，一眼就清楚：

| 目录 | 它是什么 | 会变吗 |
| --- | --- | --- |
| `PieAI/UniversityLocal` | **产品本身**。应用的源码，我们干活的地方。 | 一直在变 |
| `PieAI/UniversityLocal/studies/` | **成绩册**。课程、卡片、复习进度、词汇记忆。不进 git。 | 一直在变 |
| `PieAI/.ul-airlock` | **产品代码的冻结副本**，钉在某个确切提交上。 | 只有 `airlock promote` 时才变 |
| `PieAI/UniversityLocal-SpecialStudies` | **已废弃的第一次尝试**（见下） | 不再变 |

## 为什么需要 airlock

UniversityLocal 想学自己的代码时会撞上一条守卫：`assertSeparatedRoots` 不允许「被学的源码」和
「学习数据根」互相包含。而 `studies/` 就在产品仓里——源和成绩册叠在同一棵树上，守卫直接拒绝。

这条守卫不能放松，它守的是真实的数据边界：分析跑过的源码不能和成绩册、笔记缠在一起，缠在一起
之后刷新、归档、误删都会波及另一边。

所以做了 airlock：**在仓外放一份封存的、只读的、钉死在某个提交上的副本**。产品去学那份副本，
边界就不冲突了。

打个比方：你不能一边改一本书一边照着它出考卷——考卷印到一半书就变了。airlock 是把书**复印一份
锁进柜子**，考卷照着复印件出。书继续改，考卷不会错乱；等你想让考卷跟上新版，就重新复印一次
（`airlock promote`）。

**airlock 落后于产品是特性不是缺陷。** 教材讲的永远是「上一次提升的那个提交」。

## SpecialStudies 和 ul-meta 是什么

它们是 **airlock 出现之前的第一次尝试**，现在已被取代。

当时的问题是「产品学不了自己」，当时的解法是：既然读不了自己的代码，那就**手写**一批讲
UniversityLocal 的教程，放在仓外一个独立 git 仓（`UniversityLocal-SpecialStudies`），
再注册成一个 study（`ul-meta`）。

两小时后 airlock 做出来了，`university-local` study 建立，可以直接学**真代码**。同一门课
（《AI 时代的四层工作台》）被重写了一遍——新版多出「loopback 与请求 token 如何自保护」
「页面如何拦外部图片」这类**只有读真代码才写得出来**的内容。

时间线（可查证）：

- `ul-meta` study 建于 `2026-08-06T05:44:44Z`
- `university-local` study 建于 `2026-08-06T07:39:01Z`

SpecialStudies 里真正写完的只有 **1 节课**（`01-four-layers-names-and-auth.md`，253 行），
其余都是 README、大纲和占位符；Course B 从未动笔。而那 1 节课的主题，已经由
`university-local` 里有真代码背书的版本覆盖。

`ul-meta` 目前状态是 `archived`，书架上看不到它。

## 结论

- **保留**：`UniversityLocal`（产品）、`studies/`（成绩册）、`.ul-airlock`（自学用的冻结副本）。
- **可以删**：`UniversityLocal-SpecialStudies` 与 `ul-meta` study。它们唯一的产出已被更好的
  版本取代，留着只增加「这四个名字有什么区别」的困惑。

删除是不可逆操作，由人来做：

```bash
rm -rf /Users/yuanfei/PieAI/UniversityLocal-SpecialStudies
```

删之前知道后果：`studies/ul-meta/source/registration.json` 会指向一个不存在的路径。这个 study
已经 archived、不在书架上，所以不影响日常使用；将来若要彻底清理，连同 `studies/ul-meta/`
一起删即可。
