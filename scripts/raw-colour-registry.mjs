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
    "line": 2770,
    "column": 10,
    "literal": "#e5c49a",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2779,
    "column": 15,
    "literal": "#0d1117",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 2780,
    "column": 10,
    "literal": "#e6edf3",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3116,
    "column": 10,
    "literal": "#e6edf3",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3117,
    "column": 15,
    "literal": "#0d1117",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3163,
    "column": 10,
    "literal": "rgb(230 237 243 / 64%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3188,
    "column": 10,
    "literal": "#e5c49a",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 3769,
    "column": 15,
    "literal": "rgb(0 0 0 / 30%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 4019,
    "column": 15,
    "literal": "rgb(0 0 0 / 22%)",
    "reason": "这是 GitHub 风格的代码阅读面材料，必须保留固定代码对比度，不随 HUD 主题重映射。"
  },
  {
    "path": "apps/university/src/styles.css",
    "line": 4024,
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
 * Pending migration ledger: these 8 exact occurrences are known debt.
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
    "line": 1371,
    "column": 15,
    "literal": "rgba(116, 128, 154, 0.15)"
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
  }
];

export const PENDING_MIGRATION_COUNT = 8;

export const PENDING_MIGRATION_START_COUNT = 213;
