---
id: REF-LEARNING-WORKFLOW-ISSUES-BACKDROP-FILTER-OVER-A-LIVE-WEBGL-CANVAS-GREYS-OUT-WIDE-HUD-PANELS
title: "backdrop-filter over a live WebGL canvas greys out wide HUD panels"
type: reference
status: stable
canonical: true
owner: ai-assisted
created: 2026-08-22
last_reviewed: 2026-08-22
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

# backdrop-filter over a live WebGL canvas greys out wide HUD panels

## Guidance

backdrop-filter: blur() on a DOM panel that sits on a live WebGL canvas samples wrongly once the panel is wider than about 260px. At 375 viewport .picked is 347px full-bleed and the course header — title, remaining-count, and 「← 回到世界地图」 — becomes an unread grey brick. Desktop at 260px sat under the threshold so the bug shipped. A moving 3D scene also makes the blur a per-frame GPU tax for an 8px frost that 85% opacity already hides. Do not frost HUD that covers the map; paint --game-ui-panel-strong with backdrop-filter: none. Narrow labels (~90px) over the canvas and blur over a DOM reader are a different class — judge each by whether the element is both wide and over canvas, in a browser, not by inference.

## Applies When

- The work is complete and verified.
- The lesson is non-obvious, reusable, and not already documented.
