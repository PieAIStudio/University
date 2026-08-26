// Raw-colour ratchet registry for the nine R5 source files.
// packages/ui/src/entry/style-sample.css is intentionally outside this scope.

export const RAW_COLOUR_SOURCE_FILES = [
  "apps/university/src/styles.css",
  "packages/ui/src/evidence/evidence-inline-source.css",
  "packages/ui/src/lesson/mark-list.css",
  "packages/ui/src/review/host-grade.css",
  "packages/ui/src/evidence/evidence-item.css",
  "packages/ui/src/lesson/margin-note.css",
  "packages/ui/src/markdown/markdown-body.css",
  "packages/ui/src/lesson/word-list.css",
  "packages/ui/src/evidence/source-sheet.css"
];

/**
 * Permanent fixed material: these 29 occurrences are deliberate decisions,
 * not a category exemption. Each occurrence carries its human-written reason.
 *
 * 一条债目要转进固定表，必须有人手写一句理由；不许自动迁移，也不许因为迁不动就默默挪过来。
 */
export const FIXED_MATERIAL = [
  {
    "path": "apps/university/src/styles.css",
    "line": 177,
    "column": 47,
    "literal": "#ffb072",
    "reason": "这是说明 accent-contrast 语义的注释示例，不会被浏览器绘制。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 180,
    "column": 6,
    "literal": "#241609",
    "reason": "这是说明 accent-contrast 语义的注释示例，不会被浏览器绘制。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 971,
    "column": 33,
    "literal": "rgb(8 16 22 / 55%)",
    "reason": "这是 gloss-avatar lab 标签图标的固定阴影材料，随 donor studio 一起保持视觉一致。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 976,
    "column": 63,
    "literal": "rgb(8 16 22 / 40%)",
    "reason": "这是 gloss-avatar lab 标签图标的固定阴影材料，随 donor studio 一起保持视觉一致。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1449,
    "column": 15,
    "literal": "#d6cfc3",
    "reason": "这是 gloss-avatar lab donor 的 cream studio 固定底材，不属于产品 HUD 主题。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1650,
    "column": 10,
    "literal": "#20130c",
    "reason": "这是产品 brand mark 的固定品牌图形与阴影，不随学习面主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1651,
    "column": 39,
    "literal": "#f6c177",
    "reason": "这是产品 brand mark 的固定品牌图形与阴影，不随学习面主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1651,
    "column": 48,
    "literal": "#df663d",
    "reason": "这是产品 brand mark 的固定品牌图形与阴影，不随学习面主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1653,
    "column": 19,
    "literal": "rgb(255 255 255 / 45%)",
    "reason": "这是产品 brand mark 的固定品牌图形与阴影，不随学习面主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1654,
    "column": 17,
    "literal": "rgb(0 0 0 / 28%)",
    "reason": "这是产品 brand mark 的固定品牌图形与阴影，不随学习面主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2762,
    "column": 10,
    "literal": "#e5c49a",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2771,
    "column": 15,
    "literal": "#0d1117",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2772,
    "column": 10,
    "literal": "#e6edf3",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3108,
    "column": 10,
    "literal": "#e6edf3",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3109,
    "column": 15,
    "literal": "#0d1117",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3155,
    "column": 10,
    "literal": "rgb(230 237 243 / 64%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3180,
    "column": 10,
    "literal": "#e5c49a",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3761,
    "column": 15,
    "literal": "rgb(0 0 0 / 30%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 4011,
    "column": 15,
    "literal": "rgb(0 0 0 / 22%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 4016,
    "column": 10,
    "literal": "#e5c49a",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 7,
    "column": 15,
    "literal": "#161b22",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 8,
    "column": 10,
    "literal": "#e6edf3",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 41,
    "column": 10,
    "literal": "#f0d2a8",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 84,
    "column": 15,
    "literal": "#0d1117",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 92,
    "column": 15,
    "literal": "#0d1117",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 101,
    "column": 5,
    "literal": "rgb(225 228 232 / 8%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 102,
    "column": 5,
    "literal": "rgb(225 228 232 / 16%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 103,
    "column": 5,
    "literal": "rgb(225 228 232 / 8%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 122,
    "column": 10,
    "literal": "#f0d2a8",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  }
];

/**
 * Pending migration ledger: these 213 exact occurrences are known debt.
 * This list is an explicit occurrence ledger, not a category exemption. Its
 * count may only decrease when a raw colour is migrated and this entry is
 * removed by hand.
 */
export const PENDING_MIGRATIONS = [
  {
    "path": "apps/university/src/styles.css",
    "line": 30,
    "column": 20,
    "literal": "rgb(247 211 160 / 32%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 30,
    "column": 43,
    "literal": "rgb(255 245 232 / 6%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 39,
    "column": 20,
    "literal": "rgb(247 211 160 / 52%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 39,
    "column": 43,
    "literal": "rgb(255 245 232 / 6%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 54,
    "column": 22,
    "literal": "rgb(246 193 119 / 72%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 896,
    "column": 10,
    "literal": "#f4f7fb"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 897,
    "column": 15,
    "literal": "rgba(14, 24, 32, 0.62)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 899,
    "column": 25,
    "literal": "rgba(6, 16, 22, 0.35)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 948,
    "column": 15,
    "literal": "rgba(14, 24, 32, 0.85)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 953,
    "column": 22,
    "literal": "#ffd479"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 987,
    "column": 10,
    "literal": "rgb(244 247 251 / 78%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 988,
    "column": 26,
    "literal": "rgb(8 16 22 / 75%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1001,
    "column": 15,
    "literal": "rgba(10, 20, 28, 0.72)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1080,
    "column": 15,
    "literal": "rgba(255, 179, 71, 0.1)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1356,
    "column": 15,
    "literal": "rgba(75, 185, 138, 0.15)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1357,
    "column": 10,
    "literal": "#4bb98a"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1361,
    "column": 15,
    "literal": "rgba(94, 200, 192, 0.15)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1366,
    "column": 15,
    "literal": "rgba(255, 212, 121, 0.12)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1367,
    "column": 10,
    "literal": "#ffd479"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1371,
    "column": 15,
    "literal": "rgba(116, 128, 154, 0.15)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1381,
    "column": 60,
    "literal": "#0c1018"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1577,
    "column": 18,
    "literal": "rgb(246 231 211 / 14%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1578,
    "column": 21,
    "literal": "rgb(53 39 29 / 80%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1630,
    "column": 15,
    "literal": "#17110d"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1728,
    "column": 10,
    "literal": "#ffb4a4"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1775,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.62)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1784,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.38)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1793,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.55)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1805,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1872,
    "column": 15,
    "literal": "rgb(42 30 22 / 60%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1876,
    "column": 10,
    "literal": "#fff2dc"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1912,
    "column": 10,
    "literal": "#fff3e0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1930,
    "column": 21,
    "literal": "rgb(246 231 211 / 20%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1933,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1934,
    "column": 15,
    "literal": "rgb(20 14 10 / 72%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1939,
    "column": 10,
    "literal": "rgb(247 234 214 / 38%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1944,
    "column": 10,
    "literal": "rgb(255 245 232 / 72%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1945,
    "column": 15,
    "literal": "rgb(20 14 10 / 45%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1954,
    "column": 21,
    "literal": "rgb(246 231 211 / 20%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1957,
    "column": 15,
    "literal": "rgb(20 14 10 / 45%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 1976,
    "column": 10,
    "literal": "#fff0dc"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2043,
    "column": 15,
    "literal": "#0d1019"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2144,
    "column": 15,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2154,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2182,
    "column": 10,
    "literal": "#ffb4a3"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2218,
    "column": 15,
    "literal": "rgb(43 31 23 / 52%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2222,
    "column": 10,
    "literal": "#fff2dc"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2253,
    "column": 39,
    "literal": "rgb(42 31 24 / 68%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2253,
    "column": 60,
    "literal": "rgb(24 37 35 / 44%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2277,
    "column": 10,
    "literal": "#fff2dc"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2292,
    "column": 10,
    "literal": "#7ad9c9"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2300,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2401,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2488,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2526,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2536,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2561,
    "column": 39,
    "literal": "rgb(58 42 31 / 78%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2561,
    "column": 60,
    "literal": "rgb(39 28 21 / 72%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2567,
    "column": 10,
    "literal": "rgb(246 193 119 / 74%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2601,
    "column": 15,
    "literal": "rgb(20 14 10 / 40%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2605,
    "column": 17,
    "literal": "rgb(246 193 119 / 42%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2750,
    "column": 26,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2751,
    "column": 15,
    "literal": "rgb(246 193 119 / 6%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2854,
    "column": 21,
    "literal": "rgb(246 193 119 / 30%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2855,
    "column": 26,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2856,
    "column": 15,
    "literal": "rgb(246 193 119 / 7%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2861,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2874,
    "column": 21,
    "literal": "rgb(246 193 119 / 48%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2876,
    "column": 15,
    "literal": "rgb(246 193 119 / 13%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2877,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2887,
    "column": 17,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2888,
    "column": 15,
    "literal": "rgb(246 193 119 / 22%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2925,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2948,
    "column": 21,
    "literal": "rgb(246 193 119 / 26%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2949,
    "column": 26,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2950,
    "column": 15,
    "literal": "rgb(246 193 119 / 6%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2954,
    "column": 10,
    "literal": "#fff0dc"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2966,
    "column": 21,
    "literal": "rgba(247, 211, 160, 0.28)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2968,
    "column": 15,
    "literal": "rgba(247, 211, 160, 0.07)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2973,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2980,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.72)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2988,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.88)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2999,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.62)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3023,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3033,
    "column": 15,
    "literal": "rgb(39 28 21 / 60%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3059,
    "column": 21,
    "literal": "rgb(247 211 160 / 28%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3060,
    "column": 10,
    "literal": "rgb(247 211 160 / 72%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3070,
    "column": 17,
    "literal": "rgb(246 193 119 / 65%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3071,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3105,
    "column": 21,
    "literal": "rgb(246 231 211 / 12%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3146,
    "column": 15,
    "literal": "rgb(246 193 119 / 8%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3147,
    "column": 27,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3165,
    "column": 22,
    "literal": "rgb(80 200 185 / 66%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3198,
    "column": 10,
    "literal": "rgb(225 228 232 / 78%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3205,
    "column": 10,
    "literal": "rgb(225 228 232 / 62%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3213,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3218,
    "column": 26,
    "literal": "rgb(247 211 160 / 40%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3224,
    "column": 10,
    "literal": "#ffe3b5"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3225,
    "column": 26,
    "literal": "#ffe3b5"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3229,
    "column": 22,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3236,
    "column": 10,
    "literal": "#ffb4a3"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3251,
    "column": 21,
    "literal": "rgb(246 193 119 / 32%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3254,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3439,
    "column": 21,
    "literal": "rgba(247, 211, 160, 0.18)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3441,
    "column": 15,
    "literal": "rgba(247, 211, 160, 0.04)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3455,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.55)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3461,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.9)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3467,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.6)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3473,
    "column": 10,
    "literal": "#f7b2a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3591,
    "column": 10,
    "literal": "rgb(246 193 119 / 78%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3596,
    "column": 10,
    "literal": "rgb(255 245 232 / 45%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3648,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3711,
    "column": 15,
    "literal": "#2a1e16"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3712,
    "column": 27,
    "literal": "rgb(0 0 0 / 45%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3719,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3727,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3744,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3785,
    "column": 15,
    "literal": "rgb(240 168 104 / 12%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3786,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3795,
    "column": 17,
    "literal": "rgb(240 168 104 / 40%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3796,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3825,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3857,
    "column": 21,
    "literal": "rgb(247 211 160 / 30%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3859,
    "column": 15,
    "literal": "#1a1512"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3860,
    "column": 27,
    "literal": "rgb(0 0 0 / 50%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3868,
    "column": 10,
    "literal": "#f7ead6"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3875,
    "column": 15,
    "literal": "rgb(247 211 160 / 14%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3886,
    "column": 10,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3903,
    "column": 15,
    "literal": "rgb(43 31 23 / 42%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3915,
    "column": 10,
    "literal": "#f7ead6"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3954,
    "column": 10,
    "literal": "#f7ead6"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3959,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3975,
    "column": 15,
    "literal": "rgb(255 245 232 / 7%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3982,
    "column": 38,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3982,
    "column": 47,
    "literal": "#f6c177"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3991,
    "column": 15,
    "literal": "rgb(240 168 104 / 45%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3995,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 4000,
    "column": 10,
    "literal": "rgb(255 245 232 / 42%)"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 4031,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 5,
    "column": 21,
    "literal": "rgb(246 231 211 / 14%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 18,
    "column": 28,
    "literal": "rgb(246 231 211 / 10%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 19,
    "column": 15,
    "literal": "rgb(0 0 0 / 22%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 20,
    "column": 10,
    "literal": "rgb(225 228 232 / 78%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 27,
    "column": 28,
    "literal": "rgb(246 231 211 / 10%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 28,
    "column": 15,
    "literal": "rgb(0 0 0 / 14%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 47,
    "column": 10,
    "literal": "rgb(225 228 232 / 62%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 59,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 64,
    "column": 26,
    "literal": "rgb(247 211 160 / 40%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 70,
    "column": 10,
    "literal": "#ffe3b5"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 71,
    "column": 26,
    "literal": "#ffe3b5"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 75,
    "column": 22,
    "literal": "#f0a868"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 116,
    "column": 10,
    "literal": "rgb(225 228 232 / 78%)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-inline-source.css",
    "line": 129,
    "column": 10,
    "literal": "rgb(225 228 232 / 52%)"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 20,
    "column": 15,
    "literal": "rgb(255 245 232 / 4%)"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 24,
    "column": 26,
    "literal": "rgb(246 193 119 / 70%)"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 40,
    "column": 10,
    "literal": "rgb(255 245 232 / 45%)"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 55,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 67,
    "column": 10,
    "literal": "rgb(255 245 232 / 45%)"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 73,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 78,
    "column": 10,
    "literal": "#f0a878"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 86,
    "column": 21,
    "literal": "rgb(247 211 160 / 34%)"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 88,
    "column": 15,
    "literal": "rgb(247 211 160 / 10%)"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 89,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/lesson/mark-list.css",
    "line": 95,
    "column": 15,
    "literal": "rgb(247 211 160 / 18%)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 5,
    "column": 21,
    "literal": "rgba(247, 211, 160, 0.28)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 6,
    "column": 15,
    "literal": "rgba(247, 211, 160, 0.08)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 10,
    "column": 17,
    "literal": "rgba(120, 200, 140, 0.45)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 11,
    "column": 15,
    "literal": "rgba(80, 160, 100, 0.12)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 15,
    "column": 17,
    "literal": "rgba(230, 150, 100, 0.4)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 16,
    "column": 15,
    "literal": "rgba(160, 90, 50, 0.12)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 21,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 29,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.9)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 41,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.82)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 61,
    "column": 26,
    "literal": "rgba(247, 211, 160, 0.18)"
  },
  {
    "path": "packages/ui/src/review/host-grade.css",
    "line": 65,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.6)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 13,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.7)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 28,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.55)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 38,
    "column": 17,
    "literal": "rgba(255, 245, 232, 0.4)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 39,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.9)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 45,
    "column": 21,
    "literal": "rgba(247, 211, 160, 0.22)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 47,
    "column": 15,
    "literal": "rgba(247, 211, 160, 0.06)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 48,
    "column": 10,
    "literal": "rgba(255, 245, 232, 0.78)"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 62,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/evidence/evidence-item.css",
    "line": 83,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 22,
    "column": 26,
    "literal": "rgb(246 193 119 / 55%)"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 24,
    "column": 15,
    "literal": "rgb(255 245 232 / 4%)"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 29,
    "column": 22,
    "literal": "rgb(255 245 232 / 22%)"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 34,
    "column": 22,
    "literal": "rgb(240 168 104 / 50%)"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 40,
    "column": 15,
    "literal": "rgb(247 211 160 / 12%)"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 56,
    "column": 10,
    "literal": "rgb(255 245 232 / 42%)"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 61,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 92,
    "column": 10,
    "literal": "rgb(255 245 232 / 45%)"
  },
  {
    "path": "packages/ui/src/lesson/margin-note.css",
    "line": 98,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 2,
    "column": 10,
    "literal": "#eee0ca"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 11,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 56,
    "column": 10,
    "literal": "#f6c177"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 70,
    "column": 15,
    "literal": "#f6c177"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 83,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 98,
    "column": 10,
    "literal": "#f7c889"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 99,
    "column": 15,
    "literal": "rgb(12 8 6 / 65%)"
  },
  {
    "path": "packages/ui/src/markdown/markdown-body.css",
    "line": 107,
    "column": 15,
    "literal": "rgb(12 8 6 / 72%)"
  },
  {
    "path": "packages/ui/src/lesson/word-list.css",
    "line": 20,
    "column": 25,
    "literal": "rgb(247 211 160 / 16%)"
  },
  {
    "path": "packages/ui/src/lesson/word-list.css",
    "line": 46,
    "column": 10,
    "literal": "#f0a868"
  },
  {
    "path": "packages/ui/src/lesson/word-list.css",
    "line": 71,
    "column": 15,
    "literal": "#1a1512"
  },
  {
    "path": "packages/ui/src/lesson/word-list.css",
    "line": 72,
    "column": 10,
    "literal": "#f7ead6"
  },
  {
    "path": "packages/ui/src/lesson/word-list.css",
    "line": 107,
    "column": 15,
    "literal": "rgb(247 211 160 / 10%)"
  },
  {
    "path": "packages/ui/src/lesson/word-list.css",
    "line": 111,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/evidence/source-sheet.css",
    "line": 4,
    "column": 21,
    "literal": "rgb(246 231 211 / 14%)"
  },
  {
    "path": "packages/ui/src/evidence/source-sheet.css",
    "line": 6,
    "column": 15,
    "literal": "rgb(0 0 0 / 18%)"
  },
  {
    "path": "packages/ui/src/evidence/source-sheet.css",
    "line": 34,
    "column": 10,
    "literal": "#f7d3a0"
  },
  {
    "path": "packages/ui/src/evidence/source-sheet.css",
    "line": 57,
    "column": 10,
    "literal": "#fff5e8"
  },
  {
    "path": "packages/ui/src/evidence/source-sheet.css",
    "line": 58,
    "column": 15,
    "literal": "#1a1512"
  },
  {
    "path": "packages/ui/src/evidence/source-sheet.css",
    "line": 70,
    "column": 10,
    "literal": "#f7d3a0"
  }
];

export const PENDING_MIGRATION_COUNT = 213;
export const PENDING_MIGRATION_START_COUNT = 213;

