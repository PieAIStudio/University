---
name: University Learning Play
description: University 的 V3 步骤课与三种保留原生玩法的设计约束。
colors:
  primary: "var(--game-ui-accent)"
  secondary: "var(--game-ui-secondary)"
  neutral-panel: "var(--game-ui-panel)"
  neutral-panel-strong: "var(--game-ui-panel-strong)"
  neutral-text: "var(--game-ui-text)"
  neutral-text-muted: "var(--game-ui-text-muted)"
typography:
  display:
    fontFamily: "var(--game-ui-font-display)"
  body:
    fontFamily: "var(--game-ui-font-body)"
  mono:
    fontFamily: "var(--game-ui-font-mono)"
rounded:
  feedback: "12px"
  board: "16px"
spacing:
  compact: "8px"
  region: "16px"
  workspace: "24px"
---

# University Learning Play

运行时与代码归属见 [README](README.md)；动作登记与编写合同只在 [组件表](../../../../apps/local/.agents/skills/write-lesson/references/components.md) 维护。

- 每屏有当前动作和就近反馈。课文、任务、结果与来源用 DOM 文本；老师的讲解在学习者动作之后出现。
- 同一响应式组件树适应手机与电脑。窄屏保留材料、控件和结果的关系，按组件宽度排版；键盘不依赖拖拽。
- 控件使用 UIKit 的 `GameButton`、`GamePanel`、输入、滑块与开关；颜色与字体使用品牌 token。每屏只有前进 CTA 使用液体表面。
- 接线的信号路径、归类的材料理由、调参的可观察对象来自同一份规则。调参的图片细节与队列是明确标注的教学模型。
- 三档任务具有独立身份和实际约束；换难度清本轮，换帮助保留现场。跳过、完成、提示与尝试分别记录，不据此声称长期掌握。
- 真跑模型与确定性教学示例分开。失败明确可见，保留输入，不用示例冒充实际运行。Make 使用共享原生判分与进度。
- 结果到达后，反馈和下一步可见。重开、修改与删除保持键盘焦点可达。减少动效时保留同一结果与完整文字路径。
- 来源、图片替代文字与署名可查看；中英文共用规则和 ID。剪贴板失败时保留可选择的实际文本。

原始画面与退役设计的历史证据保留在 [截图相册](../../../../docs/reference/interaction-components/album.html) 和各完成计划。截图只证明采集版本下的可见状态；不能代替真实试学或学习效果证据。
