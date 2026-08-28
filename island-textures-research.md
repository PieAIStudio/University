# 程序化课程岛贴图研究与验证记录

日期：2026-08-28
范围：只研究和验证独立的地形贴图模块；本轮不接入课程岛现有渲染管线。

## 先看最终画面：本轮的像素预算

我先打开了 `docs/reference/island-art-reference/target-island-wide.png`、
`target-island-tall.png` 和 `target-island-alt.png`。看到的不是“底盘构造”本身，
而是三段很清楚的明度关系：亮黄绿色的顶面、中灰到暖棕的岩壁、深色的底部；
奶油色路线承担大块的方向信息，青蓝科技光只作为少量亮点。参考图里的树和灌木
沿外圈密集，中间给路线留空。这套关系适合贴图，但参考图的几何和植被预算远高于
本项目，不能照抄。

本项目当前的远景假设下，一座岛约 40 px 宽、底盘约 8 px 高，底盘只能读出剪影、
明暗对比和一个亮点；贴图的主要投资回报必须来自已经拍板的低镜头、近距离视角。
因此下面的纹理特征会做成近景可辨、远处经过 mip 后只留下柔和色块的尺度。

## 1. 投影方式

### 候选

| 方案 | UV 要求 | 典型 fragment 采样 | 结论 |
| --- | --- | ---: | --- |
| 平面 UV 展开 | 需要稳定、可维护的 UV | 1 | 不适合当前程序化几何；崖壁会拉伸或需要额外展开 |
| 全 triplanar | 无 UV；世界空间投影 | 3 个方向 | 视觉稳，但顶面为省预算付出了不必要的采样 |
| hybrid triplanar | 无 UV；顶面 XZ，陡面三向 | 顶面 1，陡面 3 | 首选；与课程岛的“多数是缓坡、边缘才是崖壁”相符 |

我的结论是采用 hybrid，而不是把“所有地方都三向”当成默认。具体规则是：

1. 把法线变到世界空间，使用 `abs(worldNormal.y)` 判断顶面程度。
2. 顶面区域使用世界空间 XZ 投影，一次采样。
3. 只有低于顶面阈值的陡面，才按 `normal * normal` 计算三向权重，并对 XY、
   XZ、ZY 三个投影采样后混合。
4. 材质边界仍由确定性的地形 mask/顶点属性决定，不从贴图里烘焙路线；这样
   同一 seed 的路线和纹理结果不会互相漂移。

这是一个需要实测而不是只凭常识的判断。独立 demo 会提供 full/hybrid 采样模式，
固定相机、固定 seed、固定渲染尺寸，记录同一窗口内的中位帧时间，并对顶面和陡面
分别做对照。报告最终以该实验结果为准；若 hybrid 在画面上出现接缝或实际帧时间
没有改善，会推翻这条结论。

## 2. 材质套数

首版生产四张资源：

- `grass-albedo.webp`：明亮偏黄绿，低对比度的小尺度色差。
- `route-albedo.webp`：奶油色沙石，低对比度、没有砖缝和方向性铺装图案。
- `rock-albedo.webp`：暖棕岩壁，只有很弱的层理暗示，不画一整块“岩石照片”。
- `surface-detail.webp`：所有材质共用的低对比度灰度细节，用来轻微打破完全均匀
  的平涂色；它不承担材质识别。

理由是三种颜色区域在参考图和产品构图里承担不同语义，而共享细节噪声只需要上传
一次。不会再增加一套水面/金属/苔藓材质：它们在这次地面问题里占不到足够屏幕像素，
却会增加下载、采样和来源维护成本。路径由几何/材质 mask 定义，不能依赖一张为某个
岛烘焙的路径图。

## 3. 法线、height 与 AO

首版**不生产和不采样法线贴图**。原因有三点：

- 当前风格是低多边形平涂，法线贴图会在近景制造不属于几何剪影的高频高光；
- triplanar 法线要么需要额外的切线空间变换，要么需要更多方向采样，成本高于它
  在目标屏幕像素上的可读收益；
- 真实地形起伏已经由程序化几何提供，贴图不应再次伪造大尺度高度。

donor 的 `displacement_map_256`、`displaced_normals_256`、`rocks_height_256`
和 `rocks_ao_256` 是它自己的 ground/density/path 组合的一部分，不能直接等价成
“所有程序化岛都需要 height/AO”。本 demo 会使用真实几何法线和灯光来验证材质本身；
不把烘焙 AO 写进 albedo。如果将来低镜头近景证明岩壁仍缺少层次，下一步优先试
单独的低频 height/bump（仍然是 hybrid 投影），而不是立刻加入 normal map。

## 4. Mipmap、过滤与各向异性

运行时约定如下：

- 资源保持 512×512、2 的幂尺寸；
- 颜色图标记 `SRGBColorSpace`，灰度细节图保持 `NoColorSpace`；
- `RepeatWrapping`，`LinearFilter` + `LinearMipmapLinearFilter`，保留自动 mipmap；
- 各向异性设为 `min(4, renderer.capabilities.getMaxAnisotropy())`，不盲目把设备
  上限当成免费预算；移动端只使用设备返回的上限并由 demo 显示实际值；
- 纹理的细节频率保持低，避免把“远处的 alias”误当成材质丰富度；
- shader 使用带普通隐式导数的 `texture2D()` 采样，让每个世界空间投影得到正确的
  mip 选择，不使用会锁死细节层级的 `textureLod`。

Three.js 当前版本的 `Texture` 文档明确了 mipmap、wrap、anisotropy 和颜色空间
属性；颜色图与非颜色图的标注规则来自 Three.js 的 Color Management 文档；
`WebGLRenderer.info.render.calls/triangles` 是本 demo 的 draw-call/三角形证据来源。
参考链接：

- <https://threejs.org/docs/pages/Texture.html>
- <https://threejs.org/manual/en/color-management.html>
- <https://threejs.org/docs/pages/WebGLRenderer.html>
- <https://wikis.khronos.org/opengl/Edge_Sampling>

## 5. 生产记录、工具与踩坑

按 `threejs-image-generator` 技能要求运行了凭据探测：

```text
uv run .agents/skills/threejs-image-generator/scripts/generate_image.py probe
GEMINI_API_KEY=MISSING
```

随后用登录 shell 复探，结果仍为：

```text
GEMINI_API_KEY=MISSING
```

因此不能声称本轮通过 Gemini API 生成了图片。本轮改用 Codex 内置图像生成能力产出
四张方形源图；接管复核时又针对岩石的平行层理重新生成了一张 `rock-generated-v2.png`。
随后统一用仓库内的确定性脚本做接缝修复、低频亮度压平、调色和 WebP 编码。
这两层职责分开：源图是 AI 生产，最终资源的可重复后处理是本地脚本，不能把其中一层
冒充成另一层。

调用时的核心约束 prompt（按材质替换第一句）是：`512x512 seamless tileable
orthographic top-down material reference, flat even lighting, albedo only, no
shadows, no highlights, no ambient occlusion, no vignette, no directional
gradient, low contrast, no objects, no text, no borders`。材质句分别是“明亮偏黄绿的
细草色差”“奶油色沙石路面”“暖棕色、极弱且破碎的岩层理”“中性灰、极低对比度的
共享表面细节”。生成后没有直接信任模型的“seamless”声明，而是统一走
`scripts/prepare-island-textures.py`。

实际踩到的坑：

1. Gemini 探测不到 key，不能继续假设 Gemini 可用；改走内置图像生成并在报告中留下
   这个事实。
2. 第一版岩石源图的横向层理太规则，像条形码；我打开 4×4 网格后否决它，重新生成
   `rock-generated-v2.png`，让层理变成不规则的碎裂块。第一版 detail 也几乎没有可读
   变化，随后换成更柔和的灰度细节。
3. AI 输出即使写着 seamless 仍需要实际做半幅 offset、中心/外圈周期接缝修补；验证
   指标必须在最终 WebP 解码后计算，不能只测压缩前的内存图。
4. 旧脚本把 `luma / blur_luma` 算出来后又乘回原亮度，实际会放大宽幅明暗；我把它
   改成 `mean_luma / blur_luma` 的方向，并在最终 WebP 解码后重新生成指标。
5. 先用无损 WebP 时总大小为 525,366 bytes，超过 500 KB；在视觉检查没有被破坏的
   前提下改为质量 88 的有损 WebP，最终四张运行时资源合计 21,734 bytes。

资源已放在新建的 `packages/world/public/island-textures/`：这个 package 原先没有
`public/` 目录，本轮新建后独立 demo 的 Vite root 会以 `packages/world` 为根，这个位置既
能被 demo 当作静态资源读取，又不会修改 `packages/world/src/island/**` 或任何现有
岛渲染文件。最终四张文件均为 512×512 WebP；大小、最终解码指标和 sha256 记录在
`island-texture-processing.json`，总运行时资源 21,734 bytes，远低于 500 KB。AI 源图
只属于生产中间物，不由 demo 加载。

## 6. 已完成的视觉与像素验证

以下证据都已实际打开查看，不是只看脚本通过：

1. [4×4 平铺验证图](island-texture-tiling-4x4.png)：四个材质区域均没有肉眼可见
   接缝；岩石使用 `rock-generated-v2.png` 后不再出现第一版那种平行条形码式重复，
   只留下低对比度的不规则碎裂纹。
2. [8×8 亮度压平验证图](island-texture-flatness-8x8.png)：四块缩小后的色块没有
   暗角或方向性渐变。最终解码后的 8×8 亮度范围分别为 grass 4.2860、route 2.0000、
   rock 2.4252、detail 1.0000；512² 全分辨率亮度标准差分别为 2.2795、1.1726、
   2.3975、0.6045，说明细节仍在但没有大面积明暗光照。
3. [近景 demo 截图](island-texture-demo-near.png)：低镜头下能直接读出黄绿顶面、
   奶油路线、暖棕岩壁；与 [无贴图基线](island-texture-demo-near-untextured.png)
   相比，贴图确实让大块材质分区和坡面起伏更容易读，且没有变成照片式高对比噪声。
4. [远景 demo 截图](island-texture-demo-far.png)：纹理缩小后仍是柔和色块，没有看到
   脏噪点、明显闪烁或 mip 接缝。远景细节当然不再承担近景的识别任务，这正符合本轮
   按屏幕像素分配预算的原则。
5. 同一 URL、同一 seed `17` 在本机两个独立浏览器会话中的画布 hash 均为
   `5bc04408`（近景、有贴图、multi、hybrid）；demo 和纹理处理脚本均没有使用
   `Math.random()`。

视觉上的诚实结论：**加贴图后比无贴图更好看，也更容易读材质和起伏；但 demo 本身
仍是规则矩形地形，不应被误读为产品岛造型已经解决。** 这轮只证明了无 UV 地形的
材质投影、颜色分区和 mip 行为；没有接入产品岛渲染管线，也没有修改岛的轮廓、树或
底盘构造。

## 7. 性能实测：改前、改后与投影开销

demo 通过 `WebGLRenderer.info.render.calls/triangles` 读取 draw call/三角形，通过
`EXT_disjoint_timer_query_webgl2` 读取 GPU elapsed time。每个表格单元是 3 次
benchmark 调用的中位数；每次调用内部再取 30 个 GPU query 的中位数。所有状态都是
同一张固定 seed 地形、同一 mesh、同一 draw call。

| 状态 | 投影 | GPU 帧时间中位数 | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: |
| demo 基线：无贴图 + 多材质 fallback | hybrid | 0.188 ms | 1 | 25,472 |
| 改后：四张贴图 + 多材质 | hybrid | 0.284 ms | 1 | 25,472 |
| 改后：四张贴图 + 单材质 | hybrid | 0.199 ms | 1 | 25,472 |
| 改后：四张贴图 + 多材质 | full triplanar | 0.583 ms | 1 | 25,472 |

所以贴图本身在这台机器上增加约 0.096 ms GPU render time，但不增加 draw call 或
三角形；hybrid 比 full triplanar 低约 51.3% 的 GPU 时间，且 4×4/近远景检查没有
发现接缝，因此保留 hybrid。这个测量环境是 HeadlessChrome 151，WebGL renderer
为 `ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max)`，不是目标的 Intel Iris、
基础款 Apple M 或中端手机；数值是本机的实测证据，不把它伪装成目标机上限。目标机
仍应在接入前用同一 demo 做一次硬件回归。

## 8. 最终交付与结论

交付物是一个独立模块 `packages/world/src/materials/triplanar-island.ts`、一个
独立页面 `packages/world/texture-demo/`、四张静态资源、两张纹理验证图和三张 demo
截图。模块不导入
任何受保护的 island/sky/planet/Stage/kit 文件。最终选择：**四张低对比度、无烘焙
光的 albedo/detail 资源 + world-space hybrid triplanar + 不使用 normal map +
512² mipmap + 各向异性上限 4**。这条结论同时通过了像素视觉检查和本机 GPU 对照，
但在目标设备上仍需按上面的硬件回归重新确认帧时间。
