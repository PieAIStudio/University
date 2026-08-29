---
id: REF-LEARNING-WORKFLOW-ISSUES-STICKY-LESSON-TOOLBARS-NEED-SCROLL-PADDING-BEFORE-PHONE-COMPLETION-BUTTONS
title: "Sticky lesson toolbars need scroll padding before phone completion buttons"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-29
last_reviewed: 2026-08-29
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

在 375×812 的真实浏览器中验证：手机 sticky lesson toolbar 换成两行后，练习提交触发的 scrollIntoViewIfNeeded 会把「完成本次更新」按钮放进工具条命中区域，报「真人指针点不中」。应在实际滚动容器上设置等于工具条高度加安全区的 scroll-padding-top，让 CTA 落到工具条下方；用 elementsFromPoint 和真实鼠标序列复核。不要只提高 z-index，因为工具条控件也必须保持可点击。

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
