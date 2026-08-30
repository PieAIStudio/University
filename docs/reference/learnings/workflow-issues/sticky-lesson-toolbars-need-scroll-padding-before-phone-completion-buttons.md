---
id: REF-LEARNING-WORKFLOW-ISSUES-STICKY-LESSON-TOOLBARS-NEED-SCROLL-PADDING-BEFORE-PHONE-COMPLETION-BUTTONS
title: "Sticky lesson toolbars need scroll padding before phone completion buttons"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-29
last_reviewed: 2026-08-30
domain: learning
tags:
  - learning-recall
  - workflow-issues
pinned: false
related: []
category: workflow-issues
module: "PGS learning capture"
capture_mode: pgs-native
---

# Sticky lesson toolbars need scroll padding before phone completion buttons

## Guidance

在真实浏览器中验证：sticky lesson toolbar 换成两行或改变布局后，练习提交触发的 scrollIntoViewIfNeeded 会把课文区里的交互控件（输入框、提交按钮或完成按钮）放进工具条命中区域，报「真人指针点不中」。这个问题不只发生在 375×812 手机宽度，桌面窄窗口也会复现。

应在实际滚动容器上设置等于工具条实时高度的 scroll-padding-top，让任何被滚动到视口的 reader action 落到工具条下方；用 ResizeObserver 跟随换行和视口变化更新，而不是为某一个设备写固定高度。用 elementsFromPoint 和从真实底部位置开始的真实鼠标序列复核；不要只提高 z-index，因为工具条控件也必须保持可点击。

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
