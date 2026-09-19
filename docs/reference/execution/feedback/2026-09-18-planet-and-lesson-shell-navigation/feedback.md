---
id: REF-FEEDBACK-PLANET-LESSON-SHELL-20260918
title: 浏览器反馈：学习星球与课程地图的导航、侧栏和头像状态
type: reference
status: active
canonical: false
owner: ai-assisted
created: 2026-09-18
last_reviewed: 2026-09-18
domain: execution
tags:
  - feedback
  - browser-evidence
  - planet
  - lesson-map
  - navigation
related: []
---

# 浏览器反馈：学习星球与课程地图的导航、侧栏和头像状态

## Packet context

- Captured: 2026-09-18，Asia/Singapore（具体时间未知）
- Scope: 反馈记录与证据整理；不是产品实现授权，也不是已批准的设计规格。
- Inputs: 0 条 global remark，9 条 individual browser note（N01–N09）。
- Evidence: 9 张带批注的浏览器图像在会话中可见，但当前工具没有暴露可读取的本地附件路径或导出接口；未保存原图、未创建替代图、未做 recapture。
- Intended handoff: evidence-only；如后续另有明确实现授权，接收方仍须按 00-AI-HANDOFF.md 做自己的复现和 provisional triage。
- Historical URLs: 127.0.0.1:9998 只记录批注发生时的本地页面，不是另一台 checkout 的通用启动方式。
- Locator rule: 先按页面状态、语义目标和视觉关系重新识别；批注坐标只服务于原始参考帧，不能直接当成跨视口点击指令。

## Read first for implementation handoff

请先读 [00-AI-HANDOFF.md](00-AI-HANDOFF.md)。它是接收方协议，不重复原始批注，也不改变本文件的反馈身份。它要求接收方读取完整证据、检查当前项目规则、自己判断优先级和依赖；本资料包本身不替接收方批准改动。

## Input index

| ID | 页面 | 目标 | 原始证据状态 |
| --- | --- | --- | --- |
| N01 | /planet?lang=zh-CN | 用户称为学习星球的面包屑导航 | 会话内图像不可本地导出；保留选区坐标 |
| N02 | /planet?lang=zh-CN | 选中的课程星球及其后续动作 | 会话内图像不可本地导出；保留选区坐标 |
| N03 | /planet?lang=zh-CN | 右侧 选课 面板 | 会话内图像不可本地导出；保留 selector 和 viewport 点位 |
| N04 | /planet?lang=zh-CN | 右上当前课程标题条 | 会话内图像不可本地导出；保留选区坐标 |
| N05 | /planet?lang=zh-CN | 整个右侧面板及其收起状态 | 会话内图像不可本地导出；保留选区坐标 |
| N06 | /?lang=zh-CN | 学习星球初始状态中的头像/云与岛屿关系 | 会话内图像不可本地导出；保留选区坐标 |
| N07 | /ai-literacy/understanding-ai?lang=zh-CN | 课程地图初始状态中的头像与第一节课 | 会话内图像不可本地导出；保留选区坐标 |
| N08 | /ai-literacy/understanding-ai?lang=zh-CN | 课程地图右侧信息栏与中央选课面板 | 会话内图像不可本地导出；保留选区坐标 |
| N09 | /ai-literacy/understanding-ai?lang=zh-CN | 点击小节课后的中央动作面板与背景遮罩 | 会话内图像不可本地导出；保留选区坐标 |

## Global remarks

本次没有独立的 global remark。N01 中“所有的面包学导航都应该统一行为，统一这个外观”是该条 individual note 的一部分，已原样保留，并在 interpretation 中标出其可能的跨页面范围。

## Note N01 — 学习星球面包屑导航的统一位置与视觉重量

**原图证据：不可用。** Comment 1 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有复制、重绘或将 recapture 冒充为原图。下方保留浏览器页面、选区和语义定位。

### User original

~~~~text
首先呢这个是应该叫面包屑导航吧，对吧？那面包屑导航的话，我觉得应该放在页面正中啊，就他一直都居中比较好一些。因为放在这的话，从构图上来说就觉得很奇怪，然后这个面包屑导航，能不能不要背后的那个叫什么来着呃背后的就是那个背景填充，但不要背景填充。这个如果只是文字的话，又担心看不明白，看不清晰，有什么办法能够解决。就是我觉得他不用背景填充，然后呢，只要能看近字就行，这样的话就不用太强调它。呃，你看到的就是这个截图的只是学习星球的面包学导航，就是所有的面包学导航都应该统一行为，统一这个外观啊，不是说只改这一个页面的这一个面包学导航。
~~~~

### Target and evidence

~~~yaml
note_id: N01
surface: "学习星球 / planet page"
captured_url: "http://127.0.0.1:9998/planet?lang=zh-CN"
page_state: "学习星球页面；用户指出顶部左侧存在被称为面包屑导航的紧凑条"
semantic_target: "顶部导航区域中显示学习星球名称的面包屑/路径条；用户要求的范围可能包含其他页面的同类导航"
visual_relationship: "位于左侧导航栏右边、3D 星球场景上方；与左右两侧面板及中央星球的构图关系是反馈重点"
selector: null
selector_provenance: null
dom_path: "browser region"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 276.69921875
  y: 15.890625
  width: 95.81640625
  height: 56.33984375
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot visible in conversation"
  file: null
  source_comment: N01
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: null
  missing_reason: "The inline annotated image was visible to the assistant but no local attachment path or export handle was available."
~~~

### AI interpretation

用户在讨论一个可能应作为共享组件处理的导航模式：希望它在页面构图中保持居中或至少不再固定在当前看起来突兀的位置；希望移除实心背景填充、降低强调度，同时用足够的文字对比度或其他轻量处理保证可读性。用户明确说不只改学习星球这一处，而是希望所有同类导航的行为和外观统一。这是反馈意图，不是已批准的具体定位、对比度方案或组件实现。

### Uncertainty / evidence limits

- “页面正中”可能指整个 viewport 的水平居中、主内容区居中或导航容器居中；原话没有选定其中一种。
- 用户同时提出“不要背景填充”和“文字要看得清”，但没有批准具体的描边、阴影、透明底或其他可读性方案。
- 静态图只能支持位置与视觉关系的观察，不能证明所有页面都使用同一实现。

## Note N02 — 选中星球后的简洁动作菜单

**原图证据：不可用。** Comment 2 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有创建替代图。

### User original

~~~~text
呃，当选中一个星球之后，是不是应该弹出简洁的菜单，是就是进入还是不进入什么的。这种简洁的菜单呢不要啰嗦，就是简单的命令就行。
~~~~

### Target and evidence

~~~yaml
note_id: N02
surface: "学习星球 / planet page"
captured_url: "http://127.0.0.1:9998/planet?lang=zh-CN"
page_state: "截图显示一个课程星球已选中；右侧同时显示与所选课程有关的信息"
semantic_target: "3D 学习星球场景中被选中的课程星球；截图标签显示 AI 与编程、已选"
visual_relationship: "选中星球位于星球场景中央偏右下；反馈关注选中动作之后是否出现轻量、短命令的入口面板"
selector: null
selector_provenance: null
dom_path: "browser region"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 699.31640625
  y: 416.38671875
  width: 367.328125
  height: 420.50390625
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot visible in conversation"
  file: null
  source_comment: N02
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: null
  missing_reason: "The inline annotated image was visible to the assistant but no local attachment path or export handle was available."
~~~

### AI interpretation

用户建议：当用户选中星球时，用一个简洁的、不过度遮挡场景的动作菜单承接“进入”或其他命令，而不是把所有操作和说明都堆在一个复杂面板里。具体要保留哪些命令、菜单出现的位置、显示多久以及是否只保留一个“进入”按钮，仍未确定。

### Uncertainty / evidence limits

- “是就是进入还是不进入什么的”没有给出完整的命令清单。
- 没有动态录制，不能从本条静态图判断菜单的出现、关闭、键盘焦点或动画行为。

## Note N03 — 右侧选课面板应以说明为主

**原图证据：不可用。** Comment 3 的 marker screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；保留了评论提供的 selector、DOM path 和 viewport 点位。

### User original

~~~~text
这个面板现在觉得有点臃肿了，因为什么呢？就是首先啊这个进入这块就不应该在这儿有入口。因为我刚呃刚说了嘛，点中星球之后就应该有进入啊或者别的命临的东西了。这一块应该是讲解熟悉。然后呢，我希望你从UIUX的角度认真思考一下呃，应该怎么排版，现在是非常混乱。
~~~~

### Target and evidence

~~~yaml
note_id: N03
surface: "学习星球 / planet page"
captured_url: "http://127.0.0.1:9998/planet?lang=zh-CN"
page_state: "右侧选课面板展开；截图中 AI 与编程课程被选中，面板同时包含课程选择、说明和进入按钮"
semantic_target: "右侧 aside 中名为 选课 的面板；用户选中的 DOM 目标名称为 选课"
visual_relationship: "贴靠 viewport 右侧，与左侧导航栏相对；面板下方包含课程介绍、统计和进入学会用 AI 做应用按钮"
selector: "aside#app-shell-aside"
selector_provenance: "supplied browser comment"
dom_path: "div > header > div > aside"
geometry:
  provenance: "supplied browser comment node position"
  kind: "point"
  coordinate_space: "browser viewport CSS pixels"
  x: 1122
  y: 82
  width: null
  height: null
reference_frame:
  viewport_width_css: 1440
  viewport_height_css: 900
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry:
  x: 0.779167
  y: 0.091111
  provenance: "derived from the supplied 1440 by 900 viewport point"
evidence:
  kind: "user-supplied marker screenshot and DOM metadata visible in conversation"
  file: null
  source_comment: N03
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: null
  missing_reason: "The annotated image was visible but not locally exportable; selector, DOM path, nearby text and viewport point were supplied separately."
~~~

### AI interpretation

用户认为右侧选课面板过于臃肿，尤其不应在信息面板内部重复提供“进入”入口；选中星球后的简洁命令应由选中交互承接。右侧面板更接近课程说明和熟悉内容的区域，并需要从 UI/UX 角度重新组织信息层级。这里的“讲解熟悉”以及信息面板与动作面板的最终边界，需要接收方结合实际页面和其他批注复核。

### Uncertainty / evidence limits

- 这是一个真实 DOM 目标，有 supplied selector，但 selector 是否稳定、是否跨页面复用，没有在本次批注中验证。
- “进入”是要完全移出右侧面板，还是保留为其他语义动作，原话没有定义最终组件合同。

## Note N04 — 右上标题应随选中星球一致切换

**原图证据：不可用。** Comment 4 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有创建替代图。

### User original

~~~~text
这一块是有点问题，就是他的标题跟这个星球的名字呃不一致，这个是有问题的啊。如果这相当于是右右是我觉得这就只显示标题就行了，它跟着切换就行。
~~~~

### Target and evidence

~~~yaml
note_id: N04
surface: "学习星球 / planet page"
captured_url: "http://127.0.0.1:9998/planet?lang=zh-CN"
page_state: "截图显示某个星球已选中；右上紧凑状态条显示学会用 AI 做应用，用户认为它与星球名称不一致"
semantic_target: "右上角紧凑标题/状态条，包含当前课程名称和其他状态图标"
visual_relationship: "位于右侧面板上方、viewport 右上角；与下方选课面板标题及中央已选星球名称形成对照"
selector: null
selector_provenance: null
dom_path: "browser region"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 1065.22265625
  y: 7.73046875
  width: 361.4140625
  height: 69.6015625
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot visible in conversation"
  file: null
  source_comment: N04
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: null
  missing_reason: "The inline annotated image was visible to the assistant but no local attachment path or export handle was available."
~~~

### AI interpretation

用户报告右上标题条与当前选中星球的名称不一致，希望它只显示当前标题，并随选择切换。具体“标题”应读取哪个课程字段、是否保留进度和图标、标题条与右侧说明是否共用名称来源，仍需接收方核对。

### Uncertainty / evidence limits

- 原话中“如果这相当于是右右”是口述不完整的句子，不能据此补写布局规则。
- 静态截图显示了一组名称，但不能证明切换后是否一直不更新，也不能证明是数据源不一致还是视觉文案重复。

## Note N05 — 右侧面板与左侧面板的对称及收起状态

**原图证据：不可用。** Comment 5 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有创建替代图。

### User original

~~~~text
而且这个面板我觉得这是右侧面板应该跟左侧面板对称吧。就是相当于右侧面板分了两个区，上面是标题，下面又是乱七八糟的，我觉得就像左侧面板一样，而且收起来也是像左侧面板一样变成居中，因为现在如果点那个三角收起来的话，它就很奇怪，那它应该是跟左侧面板一样，大小就是对齐嘛，收起来的时候，那收起来的时候，应该呈现什么样的信息呢？你看你然后呃反正相对来说整洁好看就行。就是点击那三角收起来的时候，首先要变成一个面板，跟左侧的基本上是叫做呃，对称，其次收起来的时候也是得跟左侧的那个对称。至于呈现什么样的信息，你可以收起来之后稍微大一点。这个你来判断。
~~~~

### Target and evidence

~~~yaml
note_id: N05
surface: "学习星球 / planet page"
captured_url: "http://127.0.0.1:9998/planet?lang=zh-CN"
page_state: "右侧包含上方紧凑标题条和下方选课面板；用户关注展开与点击三角后的收起状态"
semantic_target: "整个右侧 shell，包括上方标题条、下方选课信息面板和右侧收起控制"
visual_relationship: "与 viewport 左侧导航面板形成横向对称关系；反馈同时关注展开尺寸、分区、折叠后的居中位置和信息密度"
selector: null
selector_provenance: null
dom_path: "browser region"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 1086.546875
  y: 10.16015625
  width: 348.23828125
  height: 874.26171875
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot visible in conversation"
  file: null
  source_comment: N05
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: null
  missing_reason: "The inline annotated image was visible to the assistant but no local attachment path or export handle was available."
~~~

### AI interpretation

用户希望右侧面板成为一个与左侧面板在结构、尺寸和收起行为上相互呼应的整体，而不是“上面标题、下面另一套内容”的割裂组合。收起后希望仍是居中的、整洁且可辨认的面板；用户允许接收方判断收起态显示哪些信息，甚至可以略大一些。这条反馈明确保留了设计判断空间，没有指定最终收起文案或尺寸。

### Uncertainty / evidence limits

- “对称”可能是几何对称、层级对称、交互对称，或三者组合。
- 批注图只记录了当前面板的视觉状态；没有单独的收起态截图，因此收起后的实际问题需要复现。
- 用户要求“稍微大一点”是方向性建议，不是可直接落地的尺寸值。

## Note N06 — 学习星球未选择时头像/云不应默认落在岛上

**原图证据：不可用。** Comment 6 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有创建替代图。

### User original

~~~~text
呃，这是关于3D的这个平态的，就是关于这个云上的咱们的这个呃，头像呃，一进入的时候，他这个云呢，就在一个岛上了。我觉得不对，因为用户还没选的时候，就是用户没有点击任何一个岛屿的时候，这个云应该是在旁边的，就是不是在岛上的，只有当他点击任何一个岛的时候，云才过去，才跟着飞过去，不然的话好像就默认就从这儿开始了。你思考一下啊，这个跟进到岛里也一样，就是进到岛里，如果没有点刻之前，这个头像是不能在呃那个小节课的上面的，就是这个头像得在旁边，然后点了之后才能跳过去，。
~~~~

### Target and evidence

~~~yaml
note_id: N06
surface: "学习地图根页面"
captured_url: "http://127.0.0.1:9998/?lang=zh-CN"
page_state: "用户描述为首次进入且没有点击任何岛屿；静态图中头像与云位于岛屿上方，用户要求初始状态在岛旁边"
semantic_target: "3D 场景中的头像与承载头像的云；目标是它和岛屿/课程节点之间的初始与选中后关系"
visual_relationship: "选区覆盖中央 3D 地图和头像所在岛屿附近；这是 canvas/scene 对象，不是 DOM 控件"
selector: null
selector_provenance: null
dom_path: "canvas scene; no DOM selector supplied"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 451.87109375
  y: 300.4765625
  width: 435.51953125
  height: 428.19921875
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot plus reported transition behavior"
  file: null
  source_comment: N06
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: "The initial placement is shown; the requested fly-to transition is described by the user and not supplied as a recording."
  missing_reason: "The inline annotated image was visible but no local attachment path or export handle was available."
~~~

### AI interpretation

用户报告：在没有选择任何岛屿的初始状态，头像/云不应站在某个岛上，避免制造“默认已经从这里开始”的暗示；初始时可以在旁边玩耍或移动，点击岛屿后再飞到被选中的岛。用户还希望同一原则适用于进入课程地图后、点击小节课之前的状态。这里的“飞过去”是交互方向描述，不是已批准的动画时长或路径。

### Uncertainty / evidence limits

- 截图只能支持某一时刻的空间关系，不能证明进入时序、点击后的飞行、取消选择或回访状态。
- 用户说“跟进到岛里也一样”可能指课程地图的共同状态规则，也可能只是类比；与 N07 一起复核。
- 未提供摄像机状态、节点布局或动画录制。

## Note N07 — 课程地图未点击小节课时头像应在外部玩耍

**原图证据：不可用。** Comment 7 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有创建替代图。

### User original

~~~~text
对，就是你看这儿就是一开始他就在第一个上面了。不行，这个头像呢可能应该在旁边他可以在旁边跳来跳去呀，什么玩耍呀什么之类的都行。但是他不能说是直接就在第一节课上。因为得用户点完第一节课，点这个动作才会导致他这个头像跳到那个格子上，假如点的第二节，他就跳到第二节上，有这样一个互动。如果没点之前进入到这里面，那他就是一个默认在外面蹦跶玩玩耍的一个状态，你自己判断研究，看怎么完成这事。
~~~~

### Target and evidence

~~~yaml
note_id: N07
surface: "AI literacy course map"
captured_url: "http://127.0.0.1:9998/ai-literacy/understanding-ai?lang=zh-CN"
page_state: "用户描述为进入课程地图但未点击小节课；截图中头像处于第一个节点附近，节点标记为开始"
semantic_target: "课程地图中头像/云与第一节课节点的关系；目标是默认外部玩耍态和点击具体节点后的落点"
visual_relationship: "选区覆盖课程地图中央的头像、第一节课附近节点和周边路径；这是 canvas/scene 对象，不是 DOM 控件"
selector: null
selector_provenance: null
dom_path: "canvas scene; no DOM selector supplied"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 463.76171875
  y: 409.6328125
  width: 338.49609375
  height: 259.3125
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot plus reported transition behavior"
  file: null
  source_comment: N07
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: "The initial placement is shown; the requested click-to-node movement is described by the user and not supplied as a recording."
  missing_reason: "The inline annotated image was visible but no local attachment path or export handle was available."
~~~

### AI interpretation

用户要求课程地图不要默认把头像放在第一节课上。未点课时，头像可以在地图边缘或节点外部做轻微玩耍；用户点第一节或第二节后，头像再跳到对应格子，形成明确的“点击导致到达”的互动。N07 与 N06 共同指向一种“未选择状态”和“选择后目标状态”的区别，但具体待机区域、可达节点、动画和回访规则尚未确定。

### Uncertainty / evidence limits

- 这是动态状态反馈；当前材料没有录屏或时间线，不能证明头像在进入、刷新、点击和返回时的真实状态机。
- “跳到那个格子上”没有说明是视觉跟随、摄像机移动还是课程进度改变。
- 用户将“第一节课”作为示例，但没有说明已学习课程、锁定课程或再次进入时是否采用同样规则。

## Note N08 — 课程地图右侧只提供信息，中央弹出只保留简单命令

**原图证据：不可用。** Comment 8 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有创建替代图。

### User original

~~~~text
这儿呢也是出现了跟星球那个页面一样的问题。右侧的侧边栏应该是右侧的侧边栏，现在也分为两个的，就是右侧侧边栏就是提供信息，而且不应该有入口，而且应该是合并为一个跟左侧的对称，然后包括就是在星球那边的模式一模一样，然后呢，你看截图中中间的，相当于我中间的那个呃penel，是我点了其中一个导之后出现的。你看这个里面东西太复杂了，其实它就应该简单的命令，要么就是进入这节课和别的，而且都不要太遮挡。呃，然后这个panel里面的信息都应该放在右侧的侧边栏里。因为右侧的侧边栏相当于是提供详细信息，而入口的话，应该是通过点击来提供弹出，而入口呢是按钮或者是对，就应该是按钮，就应该简单的按钮，如果你觉得比如说后面咱们再加一个按钮，它可以弹出两个。现在的话只用一个。
~~~~

### Target and evidence

~~~yaml
note_id: N08
surface: "AI literacy course map"
captured_url: "http://127.0.0.1:9998/ai-literacy/understanding-ai?lang=zh-CN"
page_state: "课程地图中点击一个小节课后，中央出现课程详情/动作面板；右侧已有课程信息面板"
semantic_target: "课程地图右侧侧栏、中央由选中课程触发的 panel，以及二者之间的信息与入口分工"
visual_relationship: "选区覆盖中间地图、中央 panel 和右上状态栏附近；反馈要求中央尽量不遮挡，详细说明靠右侧承载"
selector: null
selector_provenance: null
dom_path: "browser region; canvas scene and DOM side panel"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 563.65234375
  y: 9.46484375
  width: 873.99609375
  height: 849.828125
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot visible in conversation"
  file: null
  source_comment: N08
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: null
  missing_reason: "The inline annotated image was visible to the assistant but no local attachment path or export handle was available."
~~~

### AI interpretation

用户希望课程地图与星球页采用同一套 shell 关系：右侧合并成一个与左侧对称的信息侧栏，侧栏只提供详细说明，不承载进入入口；点击地图对象后，中央只出现少量、短命令的按钮式动作，目前先有一个入口即可，未来若有多个动作再扩展。中央 panel 的详细信息应移到右侧，避免遮挡场景。这是跨页面的一致性诉求，不是对具体组件层级的批准。

### Uncertainty / evidence limits

- 用户说“点了其中一个导”中的“导”是口述原文，无法确认具体对象是小节课、节点还是其他地图元素。
- “只用一个”可能是当前阶段的按钮数量建议，也可能是对最终入口能力的范围限制；需要在实现授权后复核。
- 静态图不能证明面板是否阻止底层点击、焦点是否正确或遮挡面积在不同 viewport 是否稳定。

## Note N09 — 小节课动作面板不应压暗环境或重复入口信息

**原图证据：不可用。** Comment 9 的 annotated screenshot 在会话中可见，但没有提供可读取的本地附件路径或导出接口；没有创建替代图。

### User original

~~~~text
这儿出现的问题跟那个呃刚才提的那个一样，就星球页和非导群页也会有这样的问题，就是点这是我点完某一个小节克弹出的。首先呢他是让周围环境黑了，这个不用啊，就是不用凸显。呃，其次呢是这个就应该出现简单的按钮然后右侧的侧边栏也应该是跟飞导群和星球页要改的一模一样。他只提供信息。他不是入口。不用提供入口相应的信息，而且这个信息还得简明扼要。
~~~~

### Target and evidence

~~~yaml
note_id: N09
surface: "AI literacy course map"
captured_url: "http://127.0.0.1:9998/ai-literacy/understanding-ai?lang=zh-CN"
page_state: "用户描述为点击某个小节课后；中央出现原话变成文字的动作面板，周围地图被压暗"
semantic_target: "中央小节课动作面板及其周围环境遮罩；右侧信息侧栏的入口/信息边界"
visual_relationship: "选区覆盖中央地图与右侧侧栏之间的大区域；反馈重点是中央 panel 的轻量程度、背景是否变暗以及右侧内容是否简明"
selector: null
selector_provenance: null
dom_path: "browser region; canvas scene and DOM side panel"
geometry:
  provenance: "supplied browser comment metadata"
  kind: "rectangle"
  coordinate_space: "browser comment selected-region coordinates; viewport dimensions not supplied"
  x: 541.8203125
  y: 28.80859375
  width: 882.27734375
  height: 819.9609375
reference_frame:
  viewport_width_css: null
  viewport_height_css: null
  dpr: null
  zoom: null
  scroll_x: null
  scroll_y: null
normalized_geometry: null
evidence:
  kind: "user-supplied annotated browser screenshot visible in conversation"
  file: null
  source_comment: N09
  captured_at: null
  image_width_px: null
  image_height_px: null
  crop_origin: null
  state_differences: null
  missing_reason: "The inline annotated image was visible to the assistant but no local attachment path or export handle was available."
~~~

### AI interpretation

用户认为小节课动作面板不应通过压暗周围环境来强调自己；它应只呈现简单按钮。右侧栏应与星球页和课程地图的统一模式一致：只提供简明信息，不提供进入入口，也不重复入口对应的复杂详情。用户使用了“非导群页”“飞导群”等口述词，实际页面范围需要接收方按 URL 和视觉目标确认。

### Uncertainty / evidence limits

- 用户明确报告了背景变暗，但没有录制或复现记录来判断这是遮罩层、焦点模式还是其他视觉效果。
- “不用凸显”可能针对整个遮罩，也可能只针对强度；未指定透明度或无障碍焦点策略。
- “入口相应的信息”没有列出具体字段，不能从原话推断应删除哪些课程数据。

## Evidence gaps and verification notes

- 9 条 individual note 均已保留原始顺序、N01–N09 ID、原始文字、页面 URL、目标语义和 supplied 几何信息。
- N03 是唯一明确提供 viewport 尺寸（1440×900）和 DOM selector 的条目，因此只为 N03 计算了 derived normalized point；其余选区没有推断 viewport 尺寸，也没有计算归一化坐标。
- 所有 9 张 annotated screenshot 都只能在本次会话的 inline evidence 中看到；工具未提供本地附件路径，因此本资料包没有声称保存这些图，也没有制作合成图或 recapture。
- N06、N07 涉及飞行、跳转、待机和“点击后才到达”等动态行为；静态图只能记录初始空间关系，动态部分保留为 user-reported，不能视为已复现。
- N01、N03、N04、N05、N08、N09 的布局和文案问题可由 supplied screenshot/DOM 描述支持，但具体根因和跨页面共用实现没有在本轮验证。
- 未修改产品代码、产品数据、课程内容、浏览器页面或当前工作索引。

## Handoff check

- [x] 输入计数已核对：0 条 global remark，9 条 individual browser note；未重新编号。
- [x] 原始引语与本次用户输入逐条比对，保留了口述中的错词、重复和不完整表达。
- [x] 每条 note 都有页面状态、语义目标、视觉关系、原始 locator/geometry（若提供）以及明确的本地图片缺口说明。
- [x] N03 的 selector、DOM path、viewport point 和 derived normalized point 已标明 provenance；其他条目没有被推断成固定 DOM 定位。
- [x] 00-AI-HANDOFF.md 已创建并与原始反馈分离。
- [x] 本轮没有 recapture，没有产品代码或数据变更。
- [ ] 原始 PNG 未能从当前会话导出；如实施方需要像素级对照，请重新上传原图或提供安全的本地路径后再补入，不要用重绘或当前页面截图替代。
